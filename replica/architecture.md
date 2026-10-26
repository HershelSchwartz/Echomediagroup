# Architecture: ride-hailing app (a rebuild of Uber's core ride features)

Reads: `replica/recon.md`, `replica/features.csv`. Schema: `db/migrations/001_init.sql`.

## Stack

| layer | choice | why |
| --- | --- | --- |
| app | Next.js (App Router) + TypeScript, one app, three surfaces: rider `/ride`, driver `/drive`, admin `/admin` | one codebase and one deploy; phone-first web app (installable PWA) ships today, no app-store review needed for a one-city pilot |
| mobile | PWA now; Expo (React Native) wrappers later | native apps are needed for reliable background location on the driver side (see "parts that bite"); the API below is already the mobile API |
| styling | Tailwind v4, tokens from replica-design as CSS variables | role-named tokens, so the rebrand swaps values only |
| database | Postgres (Neon in production, local Postgres 16 in dev) | one database; relational trips, money and constraints |
| data access | `postgres` (porsager) tagged-template SQL, plain SQL migrations + a 40-line runner | no ORM magic around the dispatch transaction; every query visible |
| auth | phone number + SMS one-time code, own sessions table, http-only cookie | the original signs in by phone; Twilio Verify sends the code in production, dev prints it |
| maps / routing / search | provider adapter: Mapbox (tiles, Directions, Geocoding) when `MAPBOX_TOKEN` is set; built-in fallback otherwise (schematic map, straight-line x1.35 distance, seeded places list) | works with no keys in dev and tests; never Uber's maps or endpoints |
| realtime | short polling (2 s rider, 3 s driver) over JSON routes | works on serverless hosts with no extra service; swap for Ably/Supabase Realtime at scale |
| payments | Stripe: Checkout in `setup` mode to save a card (no card forms), off-session PaymentIntents for fare, tip and fees; dev adapter when no key | card on file, charged after the trip, like the original |
| driver payouts | earnings ledger in the database now; Stripe Connect Express later | payouts need the operator's Stripe platform approval |
| email / SMS | Resend (email) and Twilio (SMS) through an `outbox` table; dev marks rows `logged` | every message is visible in admin even before keys exist |
| jobs | none needed for the MVP: dispatch timeouts advance lazily on the next poll; Vercel Cron hourly for cleanup (expired sessions, OTPs, share links) | no worker to run |
| files | driver documents as `bytea` in Postgres with a 5 MB limit | simplest for a pilot; move to Cloudflare R2 past a few hundred drivers |
| hosting | Vercel + Neon | managed, free tier at zero users |

## Schema

Tables: 23 (`cities, users, sessions, otp_codes, products, driver_profiles,
vehicles, driver_documents, saved_places, places, payment_methods, trips,
trip_stops, trip_locations, dispatch_offers, charges, ratings, messages,
support_tickets, share_links, payouts, outbox, webhook_events`).
Access rules: data-layer checks. Every route calls `requireUser()` /
`requireRole()` and every trip read goes through `loadTripFor(user, id)`,
which returns nothing unless the user is the trip's rider, its driver, or an
admin.

Hard constraints in the database, not the UI:

- `one_live_trip_per_rider`, `one_live_trip_per_driver`: partial unique indexes,
  so double-tapping Request or two accepts can never create two live trips.
- `one_pending_offer_per_trip`, `one_pending_offer_per_driver`: a request is
  offered to one driver at a time, and a driver sees one offer at a time.
- Accept is `update trips set driver_id = $d, status = 'accepted' where id = $t
  and status = 'matching'` inside the same transaction as the offer update: the
  loser of a race gets 0 rows and a "this request was taken" message.
- `charges.idempotency_key unique`: fare, tip and fee charges are created once
  per trip even if the end-trip call is retried. The same key goes to Stripe.

## API

All JSON, all under `/api`. "rider", "driver", "admin" mean a signed-in user
with that role; "trip party" means the trip's rider or driver.

### Auth (F01)

| method path | does | who | input | output |
| --- | --- | --- | --- | --- |
| POST /api/auth/start | send a 6-digit code | anyone, rate limited 5/hour/phone | phone | ok (+ `devCode` when no SMS provider) |
| POST /api/auth/verify | check code, create session cookie | anyone, 5 tries per code | phone, code | user, `needsProfile` |
| POST /api/auth/logout | end session | user | | ok |
| GET/PATCH /api/me | profile | user | name, email | user |
| DELETE /api/me | delete account (anonymise, end sessions) | user | | ok |

### Rider (F02, F04, F05, F07, F08)

| method path | does | who | input | output |
| --- | --- | --- | --- | --- |
| GET /api/places/search?q= | address autocomplete | user | q, near | places |
| GET/POST/DELETE /api/saved-places | saved places | rider (own) | label, address, lat, lng | places |
| POST /api/quotes | prices for every product | rider | pickup, dropoff, stops | products with fare, ETA to pickup, surge |
| POST /api/trips | request a ride | rider | productId, pickup, dropoff, stops, guest, paymentMethodId | trip |
| GET /api/trips/current | live trip, driver position, ETA; advances dispatch | rider | | trip or null |
| GET /api/trips/:id | one trip | trip party / admin | | trip |
| POST /api/trips/:id/cancel | cancel, fee rules applied | trip party | reason | trip, fee |
| POST /api/trips/:id/destination | change destination mid-trip, re-quote | rider | dropoff | trip |
| POST /api/trips/:id/rate | rate the other side | trip party | stars, tags, comment | ok |
| POST /api/trips/:id/tip | tip after rating | rider | cents | charge |
| GET/POST /api/trips/:id/messages | chat | trip party | body | messages |
| POST /api/trips/:id/share | create a public status link | rider | | url |
| GET /api/share/:token | public live status, no personal data beyond driver first name + car | anyone with token | | status |
| GET /api/trips | history | user | | trips |
| GET/POST /api/payment-methods | list, add (Stripe Checkout setup or dev card), set default, cash | rider | | methods / checkout url |
| POST /api/support | open a ticket on a trip | user | tripId, category, body | ticket |

### Driver (F03, F09, F10)

| method path | does | who | input | output |
| --- | --- | --- | --- | --- |
| POST /api/driver/apply | create driver profile + vehicle | user | licence, vehicle | profile |
| POST /api/driver/documents | upload a document (5 MB, jpeg/png/pdf) | driver (own) | file, kind | doc |
| POST /api/driver/online | go online / offline | approved driver | online | profile |
| POST /api/driver/location | report position (also breadcrumbs the live trip) | driver | lat, lng, heading | ok |
| GET /api/driver/state | profile, pending offer, live trip; advances dispatch | driver | | state |
| POST /api/driver/offers/:id/accept | accept | driver (offer's) | | trip or 409 taken |
| POST /api/driver/offers/:id/decline | decline | driver (offer's) | | ok |
| POST /api/trips/:id/arrived, /start, /complete | trip state machine | trip's driver | | trip |
| POST /api/driver/destination | destination filter | driver | lat, lng, label or null | profile |
| GET /api/driver/earnings | totals by day/week + trips | driver | | earnings |

### Admin (S28)

| method path | does | who |
| --- | --- | --- |
| GET /api/admin/overview | live trips, online drivers, open tickets, today's numbers | admin |
| POST /api/admin/drivers/:id/review | approve / reject / suspend | admin |
| GET /api/admin/drivers/:id/documents/:docId | view a document | admin |
| POST /api/admin/trips/:id/refund | refund part of a fare | admin |
| POST /api/admin/tickets/:id/resolve | resolve with optional refund | admin |
| PATCH /api/admin/products/:id | edit pricing | admin |
| PATCH /api/admin/cities/:id | surge multiplier, service area | admin |
| GET /api/admin/outbox | sent emails and SMS | admin |

Webhooks in: `POST /api/webhooks/stripe` (signature verified, event id stored
in `webhook_events`, handlers idempotent): `checkout.session.completed`
(setup mode: save the card), `payment_intent.succeeded`,
`payment_intent.payment_failed`.
Webhooks out: none.
Jobs: `GET /api/cron/cleanup` hourly (Vercel Cron, `CRON_SECRET` header):
deletes expired sessions, OTPs and share links; expires stale offers;
marks `matching` trips older than 3 minutes `no_drivers`.

## Dispatch

1. Rider requests: trip row `matching`, then `dispatchNext(trip)`.
2. `dispatchNext`: nearest approved, online driver in the trip's city whose
   last ping is under 30 s old, who has no live trip and no pending offer, has
   a vehicle with enough seats, was not already offered this trip, is within
   8 km, and (if they set a destination filter) whose destination is closer to
   the trip's drop-off than to their current spot. Offer for 15 s.
3. Every poll (rider or driver) calls `advanceDispatch(trip)`: expired offers
   become `expired` and the next driver is offered. After 6 offers or 3
   minutes the trip becomes `no_drivers` and the rider sees "try again".
4. Driver cancels after accepting: trip goes back to `matching` and is
   re-dispatched (the rider keeps the place in line).

## Pricing

`fare = max(min_fare, base + per_km x km + per_min x min) x surge + booking_fee`,
upfront: the quote is the fare unless the destination changes (re-quoted) or
wait time is added. Wait fee: per minute after `wait_grace_min` from the later
of arrival or the promised pickup time, until the trip starts.
Cancellation fee, rider side: free within `cancel_free_min` of the driver
accepting; after that the product's fee, waived if the driver is more than 5
minutes past the promised pickup time. Driver marks a no-show only after
`no_show_min` of waiting; the rider pays the cancellation fee.
Surge: the city's multiplier (set in admin) times an automatic factor from
open requests vs idle drivers, capped at 2.0.

## The parts that bite

- **Background location**: browsers stop `watchPosition` when the driver app is
  in the background or the phone locks. The PWA keeps the screen awake (Wake
  Lock API) and warns the driver; the real fix is the Expo driver app with
  background location. Must happen before scaling past a pilot.
- **Races**: double-tap Request, two drivers accepting, rider cancelling while a
  driver accepts. All resolved by the unique indexes and conditional updates
  above, never by UI disabling alone.
- **Idempotency**: Stripe retries webhooks and our end-trip call can be
  retried; `webhook_events` primary key + `charges.idempotency_key`.
- **Time zones**: all stored UTC; shown in the city's zone on receipts.
- **Rate limits**: OTP send 5/hour/phone and 20/hour/IP; verify 5 tries per code.
- **Realtime cost**: polling is fine to a few hundred concurrent trips; move to
  a push channel before that.
- **Privacy**: rider and driver never see each other's phone number; the share
  page shows first name, car and position only; trip breadcrumbs kept 90 days.
- **Regulation**: operator licence, insurance and background checks are outside
  the code (see recon "Out of scope").

## Build order

1. **Vertical slice**: S01, S02, S05, S06, S07, S09, S10, S12, S13 + S21, S22,
   S23, S24. Tables: users, sessions, otp_codes, cities, products, places,
   driver_profiles, vehicles, trips, dispatch_offers, trip_locations. Routes:
   auth, quotes, trips, driver state/location/offers/trip actions.
2. **Must-haves**: payments (S16, charges), cancel rules (S19), ratings (S13,
   S25), history + receipt (S14, S15), admin approve + live trips (S28),
   no-drivers and out-of-area states.
3. **Should-haves**: driver onboarding + documents (S20), tips, wait fee, chat
   (S11), share link (F07), multiple stops, change destination, earnings (S26),
   support tickets (S18), refunds, surge.
4. **Could-haves**: ride for someone else, cash, destination filter (S27).
5. **Fixes from replica-entrepreneur**: added after that step runs.
