import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/server.js';

const PICKUP = { lat: 40.7128, lng: -74.006 };
const DROPOFF = { lat: 40.7306, lng: -73.9866 };

let server, base;
const sockets = [];

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.httpServer.listen(0, resolve));
  base = `http://localhost:${server.httpServer.address().port}`;
});

after(async () => {
  sockets.forEach((s) => s.close());
  server.io.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
});

async function api(path, body, user) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(user && { 'x-user-id': user.id, 'x-token': user.token }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function socketFor(role, user) {
  const socket = connect(base, { auth: { role, id: user.id, token: user.token }, transports: ['websocket'] });
  sockets.push(socket);
  return socket;
}

const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const emit = (socket, event, arg) =>
  new Promise((resolve, reject) =>
    socket.emit(event, arg, (r) => (r.ok ? resolve(r.data) : reject(new Error(r.error)))),
  );

test('rider and driver complete a trip over HTTP and WebSockets', async () => {
  const driver = (await api('/api/drivers', { name: 'Dee', vehicle: 'Blue Sedan' })).body;
  const driverSocket = socketFor('driver', driver);
  await once(driverSocket, 'state');
  await emit(driverSocket, 'driver:online', { lat: 40.715, lng: -74.0 });

  const rider = (await api('/api/riders', { name: 'Ray' })).body;
  const riderSocket = socketFor('rider', rider);
  await once(riderSocket, 'state');

  const estimate = await api('/api/estimate', { pickup: PICKUP, dropoff: DROPOFF });
  assert.equal(estimate.status, 200);
  assert.ok(estimate.body.fareCents > 0);

  const offer = once(driverSocket, 'ride:offer');
  const ride = await api('/api/rides', { pickup: PICKUP, dropoff: DROPOFF }, rider);
  assert.equal(ride.status, 201);
  assert.equal((await offer).rideId, ride.body.id);

  const assigned = once(riderSocket, 'ride:update');
  await emit(driverSocket, 'ride:accept', ride.body.id);
  assert.equal((await assigned).driver.name, 'Dee');

  const moved = once(riderSocket, 'ride:driver_location');
  await emit(driverSocket, 'driver:location', { lat: 40.714, lng: -74.003 });
  assert.deepEqual((await moved).location, { lat: 40.714, lng: -74.003 });

  await emit(driverSocket, 'ride:arrived', ride.body.id);
  await emit(driverSocket, 'ride:start', ride.body.id);
  const done = await emit(driverSocket, 'ride:complete', ride.body.id);
  assert.equal(done.status, 'completed');
  assert.equal((await api(`/api/rides/${ride.body.id}`, null, rider)).body.status, 'completed');
});

test('requests without valid credentials are rejected', async () => {
  const res = await api('/api/rides', { pickup: PICKUP, dropoff: DROPOFF }, { id: 'nope', token: 'nope' });
  assert.equal(res.status, 401);

  const socket = socketFor('driver', { id: 'nope', token: 'nope' });
  const err = await once(socket, 'connect_error');
  assert.equal(err.message, 'unauthorized');
});

test('bad input returns a 400 with an error code', async () => {
  const res = await api('/api/estimate', { pickup: { lat: 'x' }, dropoff: DROPOFF });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_location');
});
