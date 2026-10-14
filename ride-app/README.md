# EchoRide

A ride-hailing app built from scratch: a dispatch server plus a rider web app and a driver web app, with live maps and real-time trip updates.

## Run it

```bash
cd ride-app
npm install
npm start
```

Then open two browser tabs:

- Rider: http://localhost:3000/rider.html
- Driver: http://localhost:3000/driver.html

**Try a trip:**
1. In the driver tab, sign up, tap the map to place your car, then tap **Go online**.
2. In the rider tab, sign up, tap the map for your pickup and again for your drop-off, then tap **Request ride**.
3. The driver gets an offer and has 15 seconds to accept it.
4. The driver steps through **I've arrived**, **Start trip** and **Complete trip**. Tick **Simulate driving** to watch the car move on the rider's map.

Run the tests with `npm test`.

## Phone apps

The rider and driver apps also ship as native Android and iOS apps. See [`mobile/README.md`](mobile/README.md) for running them on your phone and publishing them to the stores.

## How it works

| Part | File | What it does |
| --- | --- | --- |
| Dispatch engine | `src/dispatch.js` | Accounts, driver availability, ride state machine, nearest-driver matching, offer timeouts |
| Pricing | `src/pricing.js` | Upfront fares (base + distance + time + booking fee, with a minimum) and demand-based surge |
| Geo | `src/geo.js` | Haversine distance and location validation |
| Server | `src/server.js` | REST API for riders, Socket.IO for live driver actions and push updates |
| Rider app | `public/rider.html`, `rider.js` | Pick stops on the map, see the fare, request, and track the driver |
| Driver app | `public/driver.html`, `driver.js` | Go online, accept or decline offers, run trips, use GPS or simulated driving |

**Ride lifecycle**

```
searching → driver_assigned → driver_arrived → in_progress → completed
searching → no_drivers          (every driver in range declined or timed out)
searching / driver_assigned / driver_arrived → cancelled   (by the rider)
```

**Matching.** A new ride goes to the closest available driver within 10 km. If they decline, ignore it for 15 seconds, or go offline, the offer moves to the next-closest driver. When nobody is left, the ride ends as `no_drivers`.

**Pricing.** The fare is quoted and locked in when the rider requests. Surge is open requests divided by available drivers, capped at 3×. Pricing settings are in `RATES` in `src/pricing.js`.

### API

All money is in integer cents. Rider endpoints that need a session send the `x-user-id` and `x-token` headers returned at sign-up.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/riders` | – | Register a rider `{name}` |
| POST | `/api/drivers` | – | Register a driver `{name, vehicle}` |
| POST | `/api/estimate` | – | Quote `{pickup, dropoff}` |
| GET | `/api/drivers/nearby?lat=&lng=` | – | Anonymised available cars near a point |
| POST | `/api/rides` | rider | Request a ride `{pickup, dropoff}` |
| GET | `/api/rides/:id` | rider | Ride status |
| POST | `/api/rides/:id/cancel` | rider | Cancel |

WebSocket clients connect with `auth: {role, id, token}`. Drivers send `driver:online`, `driver:offline`, `driver:location`, `ride:accept`, `ride:decline`, `ride:arrived`, `ride:start` and `ride:complete`, and each gets an `{ok, data | error}` reply. The server pushes `state`, `ride:offer`, `ride:update`, `ride:driver_location` and `ride:cancelled`.

## Before going to production

This is a working prototype. These are the next steps, roughly in priority order:

- **Database.** All data is kept in memory and lost on restart. Move it to Postgres with PostGIS (or Redis geo indexes for live driver positions).
- **Real accounts.** Add phone or email verification, password or OTP login, and driver onboarding (licence, insurance and vehicle checks).
- **Payments.** Add card capture at request time and charge on completion, through a payment provider such as Stripe.
- **Routing.** Fares and ETAs use straight-line distance × 1.3. Use a routing engine such as OSRM, Valhalla or a hosted directions API for real road distance and turn-by-turn directions.
- **Map tiles.** The public OpenStreetMap tile server is fine for development only. Production traffic needs a tile provider.
- **Phone apps.** The phone apps work while open. Drivers still need background location and push notifications; see `mobile/README.md`.
- **Ops.** Add ratings, receipts, trip history, support tools, rate limiting and scaling Socket.IO across servers with the Redis adapter.
