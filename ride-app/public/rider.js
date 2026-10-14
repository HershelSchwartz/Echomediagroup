import {
  $, api, connectSocket, createMap, currentPosition, DEFAULT_CENTER, fmtLoc, loadSession, money, placeMarker, saveSession,
} from './common.js';

const STATUS_COPY = {
  searching: ['Finding your driver…', 'Offering your trip to drivers nearby.'],
  driver_assigned: ['Driver on the way', ''],
  driver_arrived: ['Your driver has arrived', 'Meet them at the pickup point.'],
  in_progress: ['On your way', 'Enjoy the ride.'],
  completed: ['You have arrived', 'Thanks for riding with EchoRide.'],
  cancelled: ['Ride cancelled', 'You were not charged.'],
  no_drivers: ['No drivers available', 'Nobody nearby could take this trip. Try again in a moment.'],
};
const FINISHED = new Set(['completed', 'cancelled', 'no_drivers']);

const state = { session: loadSession('rider'), pickup: null, dropoff: null, ride: null };
const markers = { pickup: null, dropoff: null, driver: null, nearby: [] };
const map = createMap(DEFAULT_CENTER);
let socket = null;

const show = (id) => ['signup', 'plan', 'trip'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
const showError = (err) => { $('error').textContent = err ? err.message ?? String(err) : ''; };

// ---- signup ---------------------------------------------------------------

$('signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    state.session = await api('/api/riders', { body: { name: $('name').value } });
    saveSession('rider', state.session);
    start();
  } catch (err) {
    showError(err);
  }
});

function start() {
  showError();
  $('greeting').textContent = `Where to, ${state.session.name}?`;
  show('plan');
  connect();
}

function connect() {
  socket?.close();
  socket = connectSocket({ role: 'rider', id: state.session.id, token: state.session.token });
  socket.on('connect_error', (err) => {
    // The server keeps accounts in memory, so a restart invalidates saved sessions.
    if (err.message === 'unauthorized') {
      socket.close();
      saveSession('rider', null);
      state.session = null;
      show('signup');
    }
  });
  socket.on('state', ({ ride }) => (ride ? renderRide(ride) : null));
  socket.on('ride:update', renderRide);
  socket.on('ride:driver_location', ({ rideId, location }) => {
    if (state.ride?.id !== rideId) return;
    state.ride.driver.location = location;
    markers.driver = placeMarker(map, markers.driver, location, 'car');
  });
}

// ---- planning a trip ------------------------------------------------------

map.on('click', (e) => {
  if (!state.session || state.ride) return;
  const point = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (!state.pickup || state.dropoff) {
    state.pickup = point;
    state.dropoff = null;
  } else {
    state.dropoff = point;
  }
  updatePlan();
});

$('useGps').addEventListener('click', async () => {
  const here = await currentPosition();
  if (!here) return showError(new Error('Location is unavailable; tap the map instead.'));
  state.pickup = here;
  state.dropoff = null;
  map.setView([here.lat, here.lng], 15);
  updatePlan();
});

$('reset').addEventListener('click', () => {
  state.pickup = state.dropoff = null;
  updatePlan();
});

async function updatePlan() {
  showError();
  markers.pickup = placeMarker(map, markers.pickup, state.pickup, 'pickup');
  markers.dropoff = placeMarker(map, markers.dropoff, state.dropoff, 'dropoff');
  $('pickupText').textContent = state.pickup ? fmtLoc(state.pickup) : 'Pickup not set';
  $('dropoffText').textContent = state.dropoff ? fmtLoc(state.dropoff) : 'Drop-off not set';
  $('hint').textContent = !state.pickup
    ? 'Tap the map to set your pickup.'
    : !state.dropoff
      ? 'Now tap your drop-off.'
      : 'Tap the map again to start over.';
  $('quote').classList.add('hidden');
  $('request').disabled = true;
  refreshNearby();
  if (!state.pickup || !state.dropoff) return;

  try {
    const q = await api('/api/estimate', { body: { pickup: state.pickup, dropoff: state.dropoff } });
    $('fare').textContent = money(q.fareCents, q.currency);
    $('quoteDetail').textContent =
      `${q.distanceKm} km · about ${q.durationMin} min` + (q.surge > 1 ? ` · ${q.surge}× busy pricing` : '');
    $('quote').classList.remove('hidden');
    $('request').disabled = false;
  } catch (err) {
    showError(err);
  }
}

async function refreshNearby() {
  markers.nearby.forEach((m) => m.remove());
  markers.nearby = [];
  if (state.ride) return;
  const c = state.pickup ?? { lat: map.getCenter().lat, lng: map.getCenter().lng };
  try {
    const cars = await api(`/api/drivers/nearby?lat=${c.lat}&lng=${c.lng}`);
    markers.nearby = cars.map((car) => placeMarker(map, null, car.location, 'idle'));
  } catch {
    // Nearby cars are decorative; ignore failures.
  }
}

$('request').addEventListener('click', async () => {
  $('request').disabled = true;
  try {
    const ride = await api('/api/rides', {
      body: { pickup: state.pickup, dropoff: state.dropoff },
      session: state.session,
    });
    renderRide(ride);
  } catch (err) {
    showError(err);
    $('request').disabled = false;
  }
});

// ---- active trip ----------------------------------------------------------

function renderRide(ride) {
  // Ignore stale updates for rides the rider has already moved on from.
  if (state.ride && ride.id !== state.ride.id && FINISHED.has(ride.status)) return;
  state.ride = ride;
  showError();
  show('trip');
  refreshNearby();

  const [title, detail] = STATUS_COPY[ride.status];
  $('tripTitle').textContent = title;
  $('tripDetail').textContent =
    ride.driver && ride.status === 'driver_assigned'
      ? `${ride.driver.name} is coming in a ${ride.driver.vehicle}.`
      : ride.driver && ride.status !== 'completed'
        ? `${detail} ${ride.driver.name} · ${ride.driver.vehicle}`
        : detail;
  $('tripPickup').textContent = fmtLoc(ride.pickup);
  $('tripDropoff').textContent = fmtLoc(ride.dropoff);
  $('tripFare').textContent = `${ride.status === 'completed' ? 'Charged' : 'Fare'} ${money(ride.quote.fareCents, ride.quote.currency)}`;

  const finished = FINISHED.has(ride.status);
  $('tripPulse').classList.toggle('hidden', finished);
  $('cancel').classList.toggle('hidden', finished || ride.status === 'in_progress');
  $('done').classList.toggle('hidden', !finished);

  markers.pickup = placeMarker(map, markers.pickup, ride.pickup, 'pickup');
  markers.dropoff = placeMarker(map, markers.dropoff, ride.dropoff, 'dropoff');
  markers.driver = placeMarker(map, markers.driver, finished ? null : ride.driver?.location, 'car');
}

$('cancel').addEventListener('click', async () => {
  try {
    renderRide(await api(`/api/rides/${state.ride.id}/cancel`, { method: 'POST', session: state.session }));
  } catch (err) {
    showError(err);
  }
});

$('done').addEventListener('click', () => {
  state.ride = null;
  state.pickup = state.dropoff = null;
  markers.driver = placeMarker(map, markers.driver, null);
  show('plan');
  updatePlan();
});

// ---- boot -----------------------------------------------------------------

if (state.session) start();
else show('signup');
currentPosition().then((here) => here && !state.pickup && map.setView([here.lat, here.lng], 14));
setInterval(() => !state.ride && state.session && refreshNearby(), 5000);
