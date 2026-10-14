import {
  $, api, applyServerField, connectSocket, createMap, currentPosition, DEFAULT_CENTER, fmtLoc, loadSession, money, placeMarker, saveSession,
} from './common.js';

// What the driver does next at each stage of a trip.
const STEPS = {
  driver_assigned: { title: 'Head to pickup', action: 'ride:arrived', label: "I've arrived", target: 'pickup' },
  driver_arrived: { title: 'Waiting for rider', action: 'ride:start', label: 'Start trip', target: null },
  in_progress: { title: 'Drive to drop-off', action: 'ride:complete', label: 'Complete trip', target: 'dropoff' },
};
const SIM_STEP_KM = 0.12;

const state = { session: loadSession('driver'), status: 'offline', location: null, offer: null, ride: null };
const markers = { me: null, pickup: null, dropoff: null };
const map = createMap(DEFAULT_CENTER);
let socket = null;
let countdownTimer = null;
let gpsWatch = null;
let simTimer = null;
let wasOnline = false;

const show = (id) => ['signup', 'home', 'offer', 'trip'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
const showError = (err) => { $('error').textContent = err ? err.message ?? String(err) : ''; };

function send(event, arg) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, arg, (timeoutErr, reply) => {
      if (timeoutErr) return reject(new Error('The server did not respond'));
      if (!reply.ok) return reject(new Error(reply.message));
      resolve(reply.data);
    });
  });
}

// ---- signup / connection --------------------------------------------------

$('signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    applyServerField();
    state.session = await api('/api/drivers', { body: { name: $('name').value, vehicle: $('vehicle').value } });
    saveSession('driver', state.session);
    connect();
  } catch (err) {
    showError(err);
  }
});

function connect() {
  showError();
  socket?.close();
  socket = connectSocket({ role: 'driver', id: state.session.id, token: state.session.token });
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') {
      socket.close();
      saveSession('driver', null);
      state.session = null;
      show('signup');
    }
  });
  socket.on('state', (s) => {
    state.status = s.status;
    $('vehicleText').textContent = `${s.name} · ${s.vehicle}`;
    if (s.location) setLocation(s.location, false);
    // Reconnecting while online re-announces position so offers keep flowing.
    if (state.status === 'offline' && wasOnline && state.location) goOnline();
    if (s.ride) renderRide(s.ride);
    else if (s.offer) renderOffer(s.offer);
    else renderHome();
  });
  socket.on('ride:offer', renderOffer);
  socket.on('ride:update', (ride) => (ride.status === 'cancelled' ? null : renderRide(ride)));
  socket.on('ride:cancelled', () => {
    showError(new Error('The rider cancelled the trip.'));
    clearTrip();
    state.status = 'available';
    renderHome();
  });
}

// ---- location -------------------------------------------------------------

function setLocation(location, broadcast = true) {
  state.location = location;
  markers.me = placeMarker(map, markers.me, location, 'car');
  if (broadcast && state.status !== 'offline') send('driver:location', location).catch(showError);
}

map.on('click', (e) => {
  if (!state.session || $('gps').checked) return;
  setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
  if (state.status === 'offline') renderHome();
});

$('gps').addEventListener('change', () => {
  if (gpsWatch !== null) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = null;
  if (!$('gps').checked) return;
  if (!navigator.geolocation) {
    $('gps').checked = false;
    return showError(new Error('GPS is not available in this browser.'));
  }
  gpsWatch = navigator.geolocation.watchPosition(
    (p) => setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => showError(new Error('Could not read your location.')),
    { enableHighAccuracy: true },
  );
});

// ---- online / offline -----------------------------------------------------

async function goOnline() {
  if (!state.location) {
    state.location = { lat: map.getCenter().lat, lng: map.getCenter().lng };
    markers.me = placeMarker(map, markers.me, state.location, 'car');
  }
  const s = await send('driver:online', state.location);
  state.status = s.status;
  wasOnline = true;
}

$('toggleOnline').addEventListener('click', async () => {
  showError();
  try {
    if (state.status === 'offline') await goOnline();
    else {
      state.status = (await send('driver:offline')).status;
      wasOnline = false;
    }
    renderHome();
  } catch (err) {
    showError(err);
  }
});

function renderHome() {
  show('home');
  const online = state.status !== 'offline';
  $('statusBadge').textContent = online ? 'Online' : 'Offline';
  $('toggleOnline').textContent = online ? 'Go offline' : 'Go online';
  $('homeHint').textContent = online
    ? 'Waiting for ride requests nearby. Tap the map to move your car.'
    : state.location
      ? 'Ready when you are.'
      : 'Tap the map to place your car, then go online.';
}

// ---- offers ---------------------------------------------------------------

function renderOffer(offer) {
  state.offer = offer;
  state.status = 'offered';
  show('offer');
  $('offerDetail').textContent = `${offer.riderName} · ${offer.kmToPickup} km to pickup · ${offer.quote.distanceKm} km trip`;
  $('offerFare').textContent = money(offer.quote.fareCents, offer.quote.currency);
  $('offerPickup').textContent = fmtLoc(offer.pickup);
  $('offerDropoff').textContent = fmtLoc(offer.dropoff);
  markers.pickup = placeMarker(map, markers.pickup, offer.pickup, 'pickup');
  markers.dropoff = placeMarker(map, markers.dropoff, offer.dropoff, 'dropoff');

  const deadline = Date.now() + offer.timeoutMs;
  clearInterval(countdownTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    $('countdown').textContent = left;
    if (left === 0) {
      // The server has already passed the offer on.
      clearInterval(countdownTimer);
      clearTrip();
      state.status = 'available';
      renderHome();
    }
  };
  tick();
  countdownTimer = setInterval(tick, 250);
}

async function answerOffer(event) {
  clearInterval(countdownTimer);
  const rideId = state.offer.rideId;
  state.offer = null;
  try {
    const result = await send(event, rideId);
    if (event === 'ride:accept') return renderRide(result);
  } catch (err) {
    showError(err);
  }
  clearTrip();
  state.status = 'available';
  renderHome();
}

$('accept').addEventListener('click', () => answerOffer('ride:accept'));
$('decline').addEventListener('click', () => answerOffer('ride:decline'));

// ---- trip -----------------------------------------------------------------

function renderRide(ride) {
  state.ride = ride;
  state.status = 'on_trip';
  if (ride.status === 'completed') {
    showError();
    clearTrip();
    state.status = 'available';
    renderHome();
    $('homeHint').textContent = `Trip complete · you earned ${money(ride.quote.fareCents, ride.quote.currency)}.`;
    return;
  }
  const step = STEPS[ride.status];
  if (!step) return;
  show('trip');
  $('tripTitle').textContent = step.title;
  $('tripDetail').textContent = `${ride.rider.name} · ${money(ride.quote.fareCents, ride.quote.currency)}`;
  $('tripPickup').textContent = fmtLoc(ride.pickup);
  $('tripDropoff').textContent = fmtLoc(ride.dropoff);
  $('step').textContent = step.label;
  $('step').disabled = false;
  markers.pickup = placeMarker(map, markers.pickup, ride.status === 'in_progress' ? null : ride.pickup, 'pickup');
  markers.dropoff = placeMarker(map, markers.dropoff, ride.dropoff, 'dropoff');
  syncSimulation();
}

$('step').addEventListener('click', async () => {
  $('step').disabled = true;
  try {
    renderRide(await send(STEPS[state.ride.status].action, state.ride.id));
  } catch (err) {
    showError(err);
    $('step').disabled = false;
  }
});

function clearTrip() {
  state.ride = null;
  state.offer = null;
  clearInterval(simTimer);
  simTimer = null;
  $('autodrive').checked = false;
  markers.pickup = placeMarker(map, markers.pickup, null);
  markers.dropoff = placeMarker(map, markers.dropoff, null);
}

// ---- simulated driving (for demos without a moving phone) ----------------

$('autodrive').addEventListener('change', syncSimulation);

function syncSimulation() {
  clearInterval(simTimer);
  simTimer = null;
  const target = state.ride && STEPS[state.ride.status]?.target;
  if (!$('autodrive').checked || !target || !state.location) return;
  simTimer = setInterval(() => {
    const goal = state.ride?.[target];
    if (!goal) return clearInterval(simTimer);
    const from = L.latLng(state.location.lat, state.location.lng);
    const km = from.distanceTo([goal.lat, goal.lng]) / 1000;
    const t = km <= SIM_STEP_KM ? 1 : SIM_STEP_KM / km;
    setLocation({
      lat: state.location.lat + (goal.lat - state.location.lat) * t,
      lng: state.location.lng + (goal.lng - state.location.lng) * t,
    });
    if (t === 1) clearInterval(simTimer);
  }, 1000);
}

// ---- boot -----------------------------------------------------------------

if (state.session) connect();
else show('signup');
currentPosition().then((here) => here && !state.location && map.setView([here.lat, here.lng], 14));
