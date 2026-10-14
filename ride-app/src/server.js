import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { Dispatcher, DispatchError } from './dispatch.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const leafletDir = fileURLToPath(new URL('../node_modules/leaflet/dist', import.meta.url));

export function createApp({ dispatcherOptions = {} } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const dispatcher = new Dispatcher({
    ...dispatcherOptions,
    notify: (role, id, event, payload) => io.to(`${role}:${id}`).emit(event, payload),
  });

  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(publicDir));
  app.use('/vendor/leaflet', express.static(leafletDir));

  // Every authenticated request carries x-user-id and x-token from registration.
  const auth = (role) => (req, _res, next) => {
    try {
      req.user = dispatcher.authenticate(role, req.get('x-user-id'), req.get('x-token'));
      next();
    } catch (err) {
      next(err);
    }
  };
  const session = (user) => ({ id: user.id, token: user.token, name: user.name });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/riders', (req, res) => {
    res.status(201).json(session(dispatcher.registerRider(req.body?.name)));
  });

  app.post('/api/drivers', (req, res) => {
    const driver = dispatcher.registerDriver(req.body?.name, req.body?.vehicle);
    res.status(201).json({ ...session(driver), vehicle: driver.vehicle });
  });

  app.post('/api/estimate', (req, res) => {
    res.json(dispatcher.estimate(req.body?.pickup, req.body?.dropoff));
  });

  app.get('/api/drivers/nearby', (req, res) => {
    const location = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
    res.json(dispatcher.nearbyDrivers(location));
  });

  app.post('/api/rides', auth('rider'), (req, res) => {
    res.status(201).json(dispatcher.requestRide(req.user.id, req.body?.pickup, req.body?.dropoff));
  });

  app.get('/api/rides/:id', auth('rider'), (req, res) => {
    res.json(dispatcher.getRide(req.params.id, 'rider', req.user.id));
  });

  app.post('/api/rides/:id/cancel', auth('rider'), (req, res) => {
    res.json(dispatcher.cancelRide(req.user.id, req.params.id));
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found', message: 'No such endpoint' }));

  app.use((err, _req, res, _next) => {
    if (err instanceof DispatchError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: 'Malformed JSON' });
    console.error(err);
    res.status(500).json({ error: 'internal', message: 'Something went wrong' });
  });

  io.use((socket, next) => {
    const { role, id, token } = socket.handshake.auth ?? {};
    try {
      dispatcher.authenticate(role, id, token);
      socket.data = { role, id };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { role, id } = socket.data;
    const room = `${role}:${id}`;
    socket.join(room);
    socket.emit('state', role === 'rider' ? dispatcher.riderState(id) : dispatcher.driverState(id));
    if (role !== 'driver') return;

    // Driver actions reply through the Socket.IO acknowledgement callback.
    const handle = (event, action) => {
      socket.on(event, (arg, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          reply({ ok: true, data: action(arg) ?? null });
        } catch (err) {
          if (!(err instanceof DispatchError)) console.error(err);
          reply({ ok: false, error: err.code ?? 'internal', message: err.message });
        }
      });
    };
    handle('driver:online', (location) => dispatcher.setDriverOnline(id, location));
    handle('driver:offline', () => dispatcher.setDriverOffline(id));
    handle('driver:location', (location) => dispatcher.updateDriverLocation(id, location));
    handle('ride:accept', (rideId) => dispatcher.acceptRide(id, rideId));
    handle('ride:decline', (rideId) => dispatcher.declineRide(id, rideId));
    handle('ride:arrived', (rideId) => dispatcher.markArrived(id, rideId));
    handle('ride:start', (rideId) => dispatcher.startTrip(id, rideId));
    handle('ride:complete', (rideId) => dispatcher.completeTrip(id, rideId));

    // A driver who closes the app between trips stops receiving offers.
    socket.on('disconnect', async () => {
      const remaining = await io.in(room).fetchSockets();
      const driver = dispatcher.drivers.get(id);
      if (remaining.length === 0 && driver && driver.status !== 'on_trip') dispatcher.setDriverOffline(id);
    });
  });

  return { app, httpServer, io, dispatcher };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const { httpServer } = createApp();
  httpServer.listen(port, () => {
    console.log(`EchoRide running at http://localhost:${port}`);
    console.log(`  Rider app:  http://localhost:${port}/rider.html`);
    console.log(`  Driver app: http://localhost:${port}/driver.html`);
  });
}
