import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Dispatcher } from '../src/dispatch.js';

const PICKUP = { lat: 40.7128, lng: -74.006 };
const DROPOFF = { lat: 40.7306, lng: -73.9866 };
const near = (km) => ({ lat: PICKUP.lat + km / 111.2, lng: PICKUP.lng });

let d, events, timers;

beforeEach(() => {
  events = [];
  timers = [];
  d = new Dispatcher({
    notify: (role, id, event, payload) => events.push({ role, id, event, payload }),
    setTimer: (fn) => timers.push({ fn, cleared: false }) - 1,
    clearTimer: (i) => { timers[i].cleared = true; },
    offerTimeoutMs: 1000,
  });
});

const eventsFor = (id, event) => events.filter((e) => e.id === id && e.event === event);
const fireTimer = (i) => { if (!timers[i].cleared) timers[i].fn(); };

function onlineDriver(km) {
  const driver = d.registerDriver('Dee', 'Blue Sedan');
  d.setDriverOnline(driver.id, near(km));
  return driver;
}

test('ride is offered to the nearest available driver', () => {
  const far = onlineDriver(3);
  const close = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const ride = d.requestRide(rider.id, PICKUP, DROPOFF);
  assert.equal(ride.status, 'searching');
  assert.equal(eventsFor(close.id, 'ride:offer').length, 1);
  assert.equal(eventsFor(far.id, 'ride:offer').length, 0);
});

test('full happy path from request to completion', () => {
  const driver = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);

  assert.equal(d.acceptRide(driver.id, id).status, 'driver_assigned');
  assert.equal(d.riderState(rider.id).ride.driver.vehicle, 'Blue Sedan');
  d.updateDriverLocation(driver.id, near(0.5));
  assert.equal(eventsFor(rider.id, 'ride:driver_location').length, 1);

  d.markArrived(driver.id, id);
  d.startTrip(driver.id, id);
  assert.equal(d.completeTrip(driver.id, id).status, 'completed');

  assert.equal(d.driverState(driver.id).status, 'available');
  assert.equal(d.riderState(rider.id).ride, null);
  const statuses = eventsFor(rider.id, 'ride:update').map((e) => e.payload.status);
  assert.deepEqual(statuses, ['driver_assigned', 'driver_arrived', 'in_progress', 'completed']);
});

test('decline moves the offer to the next driver, then no_drivers', () => {
  const first = onlineDriver(1);
  const second = onlineDriver(2);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);

  d.declineRide(first.id, id);
  assert.equal(eventsFor(second.id, 'ride:offer').length, 1);
  assert.equal(d.driverState(first.id).status, 'available');

  d.declineRide(second.id, id);
  assert.equal(d.riderState(rider.id).ride, null);
  assert.equal(eventsFor(rider.id, 'ride:update').at(-1).payload.status, 'no_drivers');
});

test('an unanswered offer times out and moves on', () => {
  const first = onlineDriver(1);
  const second = onlineDriver(2);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  fireTimer(0);
  assert.equal(eventsFor(second.id, 'ride:offer').length, 1);
  assert.throws(() => d.acceptRide(first.id, id), { code: 'offer_unavailable' });
});

test('accepting clears the offer timer', () => {
  const driver = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  d.acceptRide(driver.id, id);
  assert.equal(timers[0].cleared, true);
});

test('drivers outside the search radius are not offered rides', () => {
  const driver = onlineDriver(50);
  const rider = d.registerRider('Ray');
  assert.equal(d.requestRide(rider.id, PICKUP, DROPOFF).status, 'no_drivers');
  assert.equal(eventsFor(driver.id, 'ride:offer').length, 0);
});

test('rider cancellation frees the assigned driver and notifies them', () => {
  const driver = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  d.acceptRide(driver.id, id);
  assert.equal(d.cancelRide(rider.id, id).status, 'cancelled');
  assert.equal(d.driverState(driver.id).status, 'available');
  assert.equal(eventsFor(driver.id, 'ride:cancelled').length, 1);
});

test('a ride cannot be cancelled once the trip has started', () => {
  const driver = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  d.acceptRide(driver.id, id);
  d.markArrived(driver.id, id);
  d.startTrip(driver.id, id);
  assert.throws(() => d.cancelRide(rider.id, id), { code: 'invalid_transition' });
});

test('only the assigned driver can advance a ride, in order', () => {
  const driver = onlineDriver(1);
  const other = onlineDriver(2);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  d.acceptRide(driver.id, id);
  assert.throws(() => d.markArrived(other.id, id), { code: 'forbidden' });
  assert.throws(() => d.startTrip(driver.id, id), { code: 'invalid_transition' });
});

test('a rider can only have one active ride', () => {
  onlineDriver(1);
  const rider = d.registerRider('Ray');
  d.requestRide(rider.id, PICKUP, DROPOFF);
  assert.throws(() => d.requestRide(rider.id, PICKUP, DROPOFF), { code: 'ride_in_progress' });
});

test('going offline with a pending offer passes it on', () => {
  const first = onlineDriver(1);
  const second = onlineDriver(2);
  const rider = d.registerRider('Ray');
  d.requestRide(rider.id, PICKUP, DROPOFF);
  assert.equal(d.setDriverOffline(first.id).status, 'offline');
  assert.equal(eventsFor(second.id, 'ride:offer').length, 1);
});

test('a driver on a trip cannot go offline', () => {
  const driver = onlineDriver(1);
  const rider = d.registerRider('Ray');
  const { id } = d.requestRide(rider.id, PICKUP, DROPOFF);
  d.acceptRide(driver.id, id);
  assert.throws(() => d.setDriverOffline(driver.id), { code: 'on_trip' });
});

test('authentication requires the matching token', () => {
  const rider = d.registerRider('Ray');
  assert.equal(d.authenticate('rider', rider.id, rider.token).id, rider.id);
  assert.throws(() => d.authenticate('rider', rider.id, 'wrong'), { code: 'unauthorized' });
  assert.throws(() => d.authenticate('driver', rider.id, rider.token), { code: 'unauthorized' });
});

test('invalid locations are rejected', () => {
  const rider = d.registerRider('Ray');
  assert.throws(() => d.requestRide(rider.id, { lat: 'x' }, DROPOFF), { code: 'invalid_location' });
});
