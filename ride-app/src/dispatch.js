import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { haversineKm, isValidLocation, toLocation } from './geo.js';
import { quote, surgeMultiplier } from './pricing.js';

export class DispatchError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Ride lifecycle:
//   searching -> driver_assigned -> driver_arrived -> in_progress -> completed
//   searching -> no_drivers            (nobody in range accepted)
//   searching | driver_assigned | driver_arrived -> cancelled   (by rider)
const CANCELLABLE = new Set(['searching', 'driver_assigned', 'driver_arrived']);
const MIN_TRIP_KM = 0.05;

function newToken() {
  return randomBytes(24).toString('base64url');
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cleanText(value, fallback, max = 40) {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return text || fallback;
}

function assertLocation(p, field) {
  if (!isValidLocation(p)) {
    throw new DispatchError('invalid_location', `${field} must be {lat, lng} with valid coordinates`);
  }
}

/**
 * In-memory dispatch engine: tracks riders, drivers and rides, and offers each
 * ride to the nearest available driver, moving on when a driver declines or
 * the offer times out. `notify(role, userId, event, payload)` pushes updates.
 */
export class Dispatcher {
  constructor({
    notify = () => {},
    offerTimeoutMs = 15_000,
    searchRadiusKm = 10,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    now = Date.now,
  } = {}) {
    Object.assign(this, { notify, offerTimeoutMs, searchRadiusKm, setTimer, clearTimer, now });
    this.riders = new Map();
    this.drivers = new Map();
    this.rides = new Map();
    this.offerTimers = new Map();
  }

  // ---- accounts -----------------------------------------------------------

  registerRider(name) {
    const rider = { id: randomUUID(), token: newToken(), name: cleanText(name, 'Rider'), rideId: null };
    this.riders.set(rider.id, rider);
    return rider;
  }

  registerDriver(name, vehicle) {
    const driver = {
      id: randomUUID(),
      token: newToken(),
      name: cleanText(name, 'Driver'),
      vehicle: cleanText(vehicle, 'Car', 60),
      status: 'offline', // offline | available | offered | on_trip
      location: null,
      rideId: null,
    };
    this.drivers.set(driver.id, driver);
    return driver;
  }

  authenticate(role, id, token) {
    const users = role === 'rider' ? this.riders : role === 'driver' ? this.drivers : null;
    const user = users?.get(id);
    if (!user || !sameToken(user.token, token)) {
      throw new DispatchError('unauthorized', 'Invalid or expired session', 401);
    }
    return user;
  }

  // ---- drivers ------------------------------------------------------------

  setDriverOnline(driverId, location) {
    const driver = this._driver(driverId);
    assertLocation(location, 'location');
    driver.location = toLocation(location);
    if (driver.status === 'offline') driver.status = 'available';
    return this.driverState(driverId);
  }

  setDriverOffline(driverId) {
    const driver = this._driver(driverId);
    if (driver.status === 'on_trip') {
      throw new DispatchError('on_trip', 'Finish or hand back your current trip before going offline', 409);
    }
    if (driver.status === 'offered') this.declineRide(driverId, driver.rideId);
    driver.status = 'offline';
    return this.driverState(driverId);
  }

  updateDriverLocation(driverId, location) {
    const driver = this._driver(driverId);
    assertLocation(location, 'location');
    driver.location = toLocation(location);
    if (driver.status === 'on_trip') {
      const ride = this.rides.get(driver.rideId);
      this.notify('rider', ride.riderId, 'ride:driver_location', { rideId: ride.id, location: driver.location });
    }
  }

  /** Anonymised positions of available drivers, for the rider's map. */
  nearbyDrivers(location, limit = 15) {
    assertLocation(location, 'location');
    return [...this.drivers.values()]
      .filter((d) => d.status === 'available' && d.location)
      .map((d) => ({ location: d.location, km: haversineKm(d.location, location) }))
      .filter((d) => d.km <= this.searchRadiusKm)
      .sort((a, b) => a.km - b.km)
      .slice(0, limit)
      .map(({ location: loc, km }) => ({ location: loc, etaMin: Math.max(1, Math.round((km / 28) * 60)) }));
  }

  // ---- rides --------------------------------------------------------------

  estimate(pickup, dropoff) {
    assertLocation(pickup, 'pickup');
    assertLocation(dropoff, 'dropoff');
    return quote(pickup, dropoff, this._surge(1));
  }

  requestRide(riderId, pickup, dropoff) {
    const rider = this._rider(riderId);
    if (rider.rideId) throw new DispatchError('ride_in_progress', 'You already have an active ride', 409);
    const fare = this.estimate(pickup, dropoff);
    if (haversineKm(pickup, dropoff) < MIN_TRIP_KM) {
      throw new DispatchError('trip_too_short', 'Pickup and drop-off are too close together');
    }
    const ride = {
      id: randomUUID(),
      riderId,
      driverId: null,
      offeredTo: null,
      declined: new Set(),
      pickup: toLocation(pickup),
      dropoff: toLocation(dropoff),
      quote: fare,
      status: 'searching',
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.rides.set(ride.id, ride);
    rider.rideId = ride.id;
    this._offerNext(ride);
    return this.rideView(ride);
  }

  acceptRide(driverId, rideId) {
    const { ride, driver } = this._pendingOffer(driverId, rideId);
    this._clearOfferTimer(ride.id);
    ride.offeredTo = null;
    ride.driverId = driverId;
    driver.status = 'on_trip';
    return this._transition(ride, 'driver_assigned');
  }

  declineRide(driverId, rideId) {
    const { ride, driver } = this._pendingOffer(driverId, rideId);
    this._clearOfferTimer(ride.id);
    ride.declined.add(driverId);
    ride.offeredTo = null;
    this._freeDriver(driver);
    this._offerNext(ride);
    return this.rideView(ride);
  }

  markArrived(driverId, rideId) {
    return this._driverStep(driverId, rideId, 'driver_assigned', 'driver_arrived');
  }

  startTrip(driverId, rideId) {
    return this._driverStep(driverId, rideId, 'driver_arrived', 'in_progress');
  }

  completeTrip(driverId, rideId) {
    const view = this._driverStep(driverId, rideId, 'in_progress', 'completed');
    const ride = this.rides.get(rideId);
    this._freeDriver(this.drivers.get(driverId));
    this.riders.get(ride.riderId).rideId = null;
    return view;
  }

  cancelRide(riderId, rideId) {
    const ride = this._ride(rideId);
    if (ride.riderId !== riderId) throw new DispatchError('forbidden', 'Not your ride', 403);
    if (!CANCELLABLE.has(ride.status)) {
      throw new DispatchError('invalid_transition', `A ${ride.status} ride can't be cancelled`, 409);
    }
    this._clearOfferTimer(ride.id);
    const driverId = ride.offeredTo ?? ride.driverId;
    if (driverId) {
      this._freeDriver(this.drivers.get(driverId));
      this.notify('driver', driverId, 'ride:cancelled', { rideId: ride.id });
    }
    ride.offeredTo = null;
    this.riders.get(riderId).rideId = null;
    return this._transition(ride, 'cancelled');
  }

  getRide(rideId, role, userId) {
    const ride = this._ride(rideId);
    const allowed = role === 'rider' ? ride.riderId === userId : ride.driverId === userId;
    if (!allowed) throw new DispatchError('forbidden', 'Not your ride', 403);
    return this.rideView(ride);
  }

  // ---- views --------------------------------------------------------------

  rideView(ride) {
    const driver = ride.driverId ? this.drivers.get(ride.driverId) : null;
    return {
      id: ride.id,
      status: ride.status,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      quote: ride.quote,
      rider: { name: this.riders.get(ride.riderId).name },
      driver: driver && { name: driver.name, vehicle: driver.vehicle, location: driver.location },
      createdAt: ride.createdAt,
      updatedAt: ride.updatedAt,
    };
  }

  riderState(riderId) {
    const rider = this._rider(riderId);
    const ride = rider.rideId ? this.rides.get(rider.rideId) : null;
    return { name: rider.name, ride: ride && this.rideView(ride) };
  }

  driverState(driverId) {
    const driver = this._driver(driverId);
    const ride = driver.rideId ? this.rides.get(driver.rideId) : null;
    return {
      name: driver.name,
      vehicle: driver.vehicle,
      status: driver.status,
      location: driver.location,
      ride: driver.status === 'on_trip' ? this.rideView(ride) : null,
      offer: driver.status === 'offered' ? this._offerPayload(ride, driver) : null,
    };
  }

  // ---- internals ----------------------------------------------------------

  _offerNext(ride) {
    const candidates = [...this.drivers.values()]
      .filter((d) => d.status === 'available' && d.location && !ride.declined.has(d.id))
      .map((d) => ({ driver: d, km: haversineKm(d.location, ride.pickup) }))
      .filter((c) => c.km <= this.searchRadiusKm)
      .sort((a, b) => a.km - b.km);

    if (candidates.length === 0) {
      this.riders.get(ride.riderId).rideId = null;
      this._transition(ride, 'no_drivers');
      return;
    }

    const { driver } = candidates[0];
    driver.status = 'offered';
    driver.rideId = ride.id;
    ride.offeredTo = driver.id;
    const timer = this.setTimer(() => {
      this.offerTimers.delete(ride.id);
      if (ride.status === 'searching' && ride.offeredTo === driver.id) this.declineRide(driver.id, ride.id);
    }, this.offerTimeoutMs);
    this.offerTimers.set(ride.id, timer);
    this.notify('driver', driver.id, 'ride:offer', this._offerPayload(ride, driver));
  }

  _offerPayload(ride, driver) {
    const kmToPickup = haversineKm(driver.location, ride.pickup);
    return {
      rideId: ride.id,
      riderName: this.riders.get(ride.riderId).name,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      quote: ride.quote,
      kmToPickup: Math.round(kmToPickup * 10) / 10,
      timeoutMs: this.offerTimeoutMs,
    };
  }

  _pendingOffer(driverId, rideId) {
    const driver = this._driver(driverId);
    const ride = this._ride(rideId);
    if (ride.status !== 'searching' || ride.offeredTo !== driverId) {
      throw new DispatchError('offer_unavailable', 'This offer is no longer available', 409);
    }
    return { ride, driver };
  }

  _driverStep(driverId, rideId, from, to) {
    const ride = this._ride(rideId);
    if (ride.driverId !== driverId) throw new DispatchError('forbidden', 'Not your ride', 403);
    if (ride.status !== from) {
      throw new DispatchError('invalid_transition', `Can't go from ${ride.status} to ${to}`, 409);
    }
    return this._transition(ride, to);
  }

  _transition(ride, status) {
    ride.status = status;
    ride.updatedAt = this.now();
    const view = this.rideView(ride);
    this.notify('rider', ride.riderId, 'ride:update', view);
    if (ride.driverId) this.notify('driver', ride.driverId, 'ride:update', view);
    return view;
  }

  _freeDriver(driver) {
    driver.rideId = null;
    if (driver.status !== 'offline') driver.status = 'available';
  }

  _clearOfferTimer(rideId) {
    const timer = this.offerTimers.get(rideId);
    if (timer !== undefined) {
      this.clearTimer(timer);
      this.offerTimers.delete(rideId);
    }
  }

  _surge(extraRequests = 0) {
    let open = extraRequests;
    let available = 0;
    for (const ride of this.rides.values()) if (ride.status === 'searching') open++;
    for (const d of this.drivers.values()) if (d.status === 'available') available++;
    return surgeMultiplier(open, available);
  }

  _rider(id) {
    const rider = this.riders.get(id);
    if (!rider) throw new DispatchError('not_found', 'Rider not found', 404);
    return rider;
  }

  _driver(id) {
    const driver = this.drivers.get(id);
    if (!driver) throw new DispatchError('not_found', 'Driver not found', 404);
    return driver;
  }

  _ride(id) {
    const ride = this.rides.get(id);
    if (!ride) throw new DispatchError('not_found', 'Ride not found', 404);
    return ride;
  }
}
