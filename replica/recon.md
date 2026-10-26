# Recon map: Uber (iOS + Android, rider app and driver app)

Scope: ride-hailing core loop only. Rider requests a ride, a nearby driver is
matched, the trip runs with live tracking, the rider pays, both sides rate.
Covers the rider app and the minimum driver app needed to make the loop work,
plus a thin ops/admin console. Uber Eats, Freight, Business, Reserve, Rent,
transit and the Uber One subscription are out of this slice.
For: Echo Media Group. Proposed default: a ride-hailing app for one city or
niche (e.g. airport runs, a campus, a community car service) to own and sell.
Confirm or change this before /replica-architect.
Date: 2026-10-26

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center: request a ride / price estimate | https://help.uber.com/h/67f41961-e0aa-4670-af32-58be02c7c492 | "Where to?", swipe up for vehicle types, confirm pickup pin, match ETA, alternate type when none available, multiple stops, saved places, cash must be picked before request |
| 2 | help center: how does Uber work | https://help.uber.com/h/738d1ff7-5fe0-4383-b34c-4a2480efd71e | overview of the loop |
| 3 | marketing: request for a guest | https://www.uber.com/ride/how-it-works/request-for-a-guest | rider switcher above the address box |
| 4 | driver basics: taking trips | https://www.uber.com/gb/en/drive/basics/how-to-take-trips | Go online, exclusive request with timer, Trip Radar (multi-driver, "Match"), navigate to pickup, start, end |
| 5 | driver basics: driver destinations | https://www.uber.com/us/en/drive/basics/driver-destinations/ | filter requests toward a set destination |
| 6 | driver app marketing page | https://www.uber.com/drive/driver-app/ | earnings, navigation, ratings |
| 7 | help center: wait time fees | https://help.uber.com/h/22b6db22-0f86-4765-ac72-da549a2302d7 | grace period 2 min economy / 5 min premium, starts at arrival or ETA whichever later, per-minute after |
| 8 | help center: how wait time fees are calculated | https://help.uber.com/h/7f41997f-a853-46ae-8001-8ab9dee504b0 | |
| 9 | help center: review cancellation fee | https://help.uber.com/h/6bec690f-ee35-40ba-96ee-c38a8ae796e0 | fee after 2 min (economy) / 5 min (premium) post-accept, or driver waited 7/10/15 min |
| 10 | blog: changes to cancellation fees (UK) | https://www.uber.com/gb/en/blog/changes-to-cancellation-fees | fee waived if driver is 5+ min past ETA or moving away |
| 11 | in-app tips | https://www.uber.com/ie/en/ride/how-it-works/tips/ | rate first, then tip; tip window 30-90 days by region; receipt email |
| 12 | rider pro tips (older) | https://www.uber.com/blog/protips | split fare, share ETA / send status |
| 13 | rider pro tips (India newsroom) | https://www.uber.com/in/en/newsroom/rider-pro-tips/ | |
| 14 | App Store listing | https://apps.apple.com/us/app/uber-request-a-ride/id368677368 | not reachable from this environment; open on a phone and save screenshots to `replica/screens/` |
| 15 | public Riders API docs | https://developer.uber.com/docs/riders/references/api | not reachable from this environment; known public objects: products, price/time estimates, ride requests and status |
| 16 | the user's own account | — | not used yet. A walk-through of your own rider account (not driver; driver terms apply) would firm up the screens marked medium/guess |

Terms note: Uber's terms of use restrict commercial use of the service. Use
your own rider account only to observe flows, at normal speed, and do not
sign up as a driver to study the driver app; work from the public driver
pages above instead.

## Core loop

A rider types a destination, sees prices per vehicle type, requests, is
matched to a nearby driver, watches them arrive and drive the trip on a live
map, is charged automatically, and rates/tips at the end.

## Screens

Rider app (R), driver app (D), admin console (A). Confidence of each screen
existing as described: H high (in sources), M medium (well-known product
behaviour, not in sources fetched).

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | R: Welcome / phone entry | first launch | sign up or log in by phone number | phone input with country code, social sign-in buttons | empty, invalid number (M) |
| S02 | R: OTP verify | after S01 | confirm phone with SMS code | 4-digit code input, resend timer | wrong code, expired, resend (M) |
| S03 | R: Profile setup | first sign-up | name, email, terms acceptance | text inputs, checkbox | filled, error (M) |
| S04 | R: Location permission | first sign-up | ask for location | permission sheet | granted, denied -> manual address (M) |
| S05 | R: Home | app open | map with current location, "Where to?" bar, saved places, shortcuts | map, search bar, saved-place chips | no location, no drivers nearby (H, src 1) |
| S06 | R: Destination search | tap "Where to?" | pick pickup and drop-off, add stops, choose who's riding | two address inputs, autocomplete list, saved places, "add stop", rider switcher | empty, results, no results (H, src 1, 3) |
| S07 | R: Choose a ride | after S06 | vehicle types with price and ETA, payment method row | bottom sheet of product cards, route on map, payment row, request button | loading prices, unavailable type, surge/busy note (H, src 1) |
| S08 | R: Confirm pickup | after request tap (when asked) | drag pin or pick a suggested pickup spot | map pin, pickup suggestion list, confirm button | pin off-road, out of service area (H, src 1) |
| S09 | R: Finding your driver | after confirm | matching in progress | pulsing map, ETA to match, cancel button | searching, no drivers -> retry/alternate (H, src 1) |
| S10 | R: Driver on the way | driver accepted | live driver position and ETA, driver + car details, contact, cancel | map with car marker, driver card (photo, name, rating, plate, car), call/message buttons, share status | en route, arriving, arrived + wait timer, driver cancelled (H, src 1, 7) |
| S11 | R: Chat with driver | from S10 | in-app messaging, masked phone call | message list, composer, quick replies | empty, sent, unread (M) |
| S12 | R: On trip | trip started | live route to destination, ETA, share trip, change destination, safety | map, trip sheet, share button, safety shield | on trip, destination changed (M, src 12) |
| S13 | R: Trip complete / rate | trip ended | rate driver 1-5 stars, then tip, compliments | star row, tags, tip chips, custom tip, done | skipped, submitted (H, src 11) |
| S14 | R: Receipt | email, or Activity -> trip | fare breakdown, route, driver | fare line items, map snapshot | normal, adjusted, refund (H, src 11) |
| S15 | R: Activity (trip history) | menu -> Activity | past and upcoming trips | list of trip rows | empty, filled (M) |
| S16 | R: Wallet / payment methods | menu -> Wallet | add card, choose default, cash where offered | payment list, add card form | none, card declined, cash (H, src 1) |
| S17 | R: Account / settings | menu -> Account | profile, saved places, safety prefs, privacy | list rows | — (M) |
| S18 | R: Help / trip issues | menu -> Help | report a problem with a trip, dispute cancellation fee | category list, trip picker, issue form | submitted, resolved (H, src 9, 4) |
| S19 | R: Cancel ride sheet | from S09/S10 | confirm cancel, warn about fee | modal, fee warning | free cancel, fee applies (H, src 9) |
| S20 | D: Driver sign-up and documents | first launch | driver profile, licence, vehicle, insurance, background check consent | multi-step form, document upload | pending review, approved, rejected (M) |
| S21 | D: Home (offline/online) | app open | Go online, see map, earnings today | big Go button, map, earnings pill | offline, online-searching (H, src 4) |
| S22 | D: Trip request card | while online | accept or decline an exclusive request with timer; Trip Radar list with "Match" | request card (pickup distance, destination, fare), countdown ring, accept button | exclusive, radar, expired, missed (H, src 4) |
| S23 | D: Navigate to pickup | after accept | route to rider, contact rider, arrive | map + turn-by-turn handoff, rider card, "Arrived" | en route, arrived + wait timer, rider no-show -> cancel (H, src 4, 7) |
| S24 | D: On trip | after "Start trip" | route to destination, end trip | map, "End trip" slider | on trip, stop added, destination changed (H, src 4) |
| S25 | D: Rate rider / trip summary | after end | fare earned, rate rider | earnings line, stars | — (M) |
| S26 | D: Earnings | menu -> Earnings | per trip, daily and weekly totals, payouts | chart, trip list | empty, filled (H, src 6) |
| S27 | D: Destination filter | from S21 | only get requests heading toward a place | address search, toggle | set, unset (H, src 5) |
| S28 | A: Ops console | web | view live trips, drivers, approve driver documents, refunds, pricing per zone | tables, map, detail drawers | — (guess; Uber's internal tools are not public) |

## Flows

```
F01 Rider signs up
    S01 -> S02 -> S03 -> S04 -> S05
    happy path clicks: ~6 (phone, continue, code auto-fill, name, agree, allow location)
    edge: SMS never arrives, number already used, location denied

F02 Rider requests a ride (the core loop, request half)
    S05 -> S06 -> S07 -> S08 -> S09 -> S10
    happy path clicks: 4 (Where to?, pick a suggestion, Choose UberX, Confirm pickup)
    edge: no drivers for that type (suggest alternate), pickup outside service area,
          price changes while sheet is open, card declined at request, no GPS

F03 Driver goes online and takes a trip (driver half)
    S21 Go -> S22 accept -> S23 arrived -> S24 start / end -> S25 rate
    happy path clicks: 5 (Go, Accept, Arrived, Start trip, End trip)
    edge: request timer expires, two drivers tap Match on a Trip Radar request,
          rider no-show after wait (cancel with fee), GPS drift, app killed mid-trip

F04 Trip runs and completes (rider side)
    S10 -> S12 -> S13 -> S14
    happy path clicks: 2 (5 stars, Done) + optional tip
    edge: rider changes destination mid-trip, multiple stops, payment fails after trip
          (debt on account), driver ends trip early

F05 Rider cancels
    S09 or S10 -> S19 -> S05
    happy path clicks: 2
    edge: inside free window (no fee), after 2/5 min post-accept (fee), driver late past
          ETA (fee waived), driver cancels instead (auto re-match)

F06 Rider disputes a charge
    S15 -> S14 -> S18
    happy path clicks: ~4
    edge: cancellation fee review, wrong route, lost item

F07 Rider shares trip status / rides for someone else
    S12 share -> system share sheet ; S06 rider switcher -> pick contact
    edge: guest has no app (SMS link with live tracking page)

F08 Rider manages payment
    S16 add card -> set default ; choose cash before request
    edge: 3-D Secure challenge, card expired

F09 Driver onboarding
    S20 -> (admin S28 approves) -> S21
    edge: document rejected, expired licence

F10 Driver checks earnings
    S21 -> S26
```

Numbers to beat: 4 taps from home to a requested ride (F02), 2 taps to rate (F04).

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (black), secondary, ghost, danger, big round "Go" | default, pressed, disabled, loading | all |
| Map view | rider home, route preview, live tracking, pickup pin | loading tiles, no GPS, following car | S05-S12, S21-S24 |
| Car marker | rider view, driver self | moving (interpolated), heading rotation | S05, S10, S12, S23 |
| Pickup pin | draggable, snapped to suggested spot | dragging, invalid spot | S08 |
| Bottom sheet | collapsed, half, full | dragging | S05-S12, S21-S24 |
| Search bar / address input | "Where to?", pickup, drop-off, stop | empty, focused, filled | S05, S06, S27 |
| Autocomplete row | place, saved place, recent | — | S06, S27 |
| Product card | vehicle type with icon, seats, ETA, price | selected, unavailable, surge | S07 |
| Driver card | photo, name, rating, car, plate | arriving, arrived | S10, S12 |
| Request card (driver) | exclusive with countdown ring, Trip Radar row | live, expired, taken | S22 |
| Slide-to-confirm | start trip, end trip | idle, sliding, done | S24 |
| Star rating | 1-5 | empty, picked | S13, S25 |
| Tip chips | preset amounts, custom | selected | S13 |
| Chat bubble + composer | sent, received, quick reply | sending, failed | S11 |
| OTP input | 4-6 digits | focused, error | S02 |
| Modal / confirm sheet | cancel ride, fee warning | — | S19 |
| Toast / banner | info, warning (surge, no drivers) | — | S07, S09 |
| List row | menu, setting, trip history | — | S15-S18, S26 |
| Countdown / wait timer | match ETA, wait-time grace, request timer | counting, expired | S09, S10, S22, S23 |
| Document upload tile | licence, insurance, vehicle photo | empty, uploading, pending, rejected | S20 |

## Inferred data model

```
User        id, phone (unique), email, name, photo_url, role (rider | driver | admin),
            rating_avg, rating_count, created_at
            evidence: S01-S03, S10 driver card shows rating
            confidence: high

DriverProfile  user_id, licence_no, licence_expiry, status (pending | approved | rejected
               | suspended), online (bool), last_lat, last_lng, last_seen_at, heading,
               destination_filter (point, nullable)
            evidence: S20, S21, S27, src 4, 5
            confidence: high (fields), medium (exact statuses)

Vehicle     id, driver_id, make, model, colour, plate, year, seats, product_ids
            evidence: S10 driver card
            confidence: high

Product     id, name (e.g. economy, XL, premium), seats, base_fare, per_km, per_min,
            min_fare, booking_fee, wait_grace_min, wait_per_min,
            cancel_free_window_min, cancel_fee, city_id
            evidence: S07, src 7, 9; public Riders API "products"
            confidence: high

City / Zone id, name, service_area (polygon), currency, timezone
            evidence: "out of service area" state, per-city fees
            confidence: medium

PlaceSaved  id, user_id, label (home | work | custom), address, lat, lng
            evidence: S05, S06, src 1
            confidence: high

Trip        id, rider_id, driver_id (nullable until matched), product_id, vehicle_id,
            status (requested | matching | accepted | arriving | arrived | in_progress
                    | completed | cancelled_by_rider | cancelled_by_driver | no_drivers),
            pickup (lat, lng, address), dropoff (lat, lng, address),
            quoted_fare, final_fare, surge_multiplier, distance_m, duration_s,
            requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at,
            cancel_reason, for_guest_name, for_guest_phone, payment_method_id
            evidence: S07-S14, S19, src 1, 3, 7, 9; public Riders API request statuses
            confidence: high (shape), medium (exact status names)

TripStop    id, trip_id, seq, lat, lng, address, arrived_at
            evidence: "add stop", src 1
            confidence: high

TripLocation  trip_id, ts, lat, lng (driver breadcrumb, for route + receipt + disputes)
            evidence: S14 route map on receipt
            confidence: medium

Dispatch    id, trip_id, driver_id, kind (exclusive | radar), offered_at, expires_at,
            response (accepted | declined | expired | lost)
            evidence: S22, src 4
            confidence: medium

PaymentMethod  id, user_id, kind (card | cash | wallet), processor_token, brand, last4,
               is_default
            evidence: S16, src 1
            confidence: high

Charge      id, trip_id, amount, kind (fare | tip | cancellation | wait_time | adjustment
            | refund), status, processor_ref, created_at
            evidence: S13, S14, S18, src 7, 9, 11
            confidence: high

Rating      id, trip_id, from_user_id, to_user_id, stars, tags, comment
            evidence: S13, S25, src 11
            confidence: high

Message     id, trip_id, sender_id, body, created_at, read_at
            evidence: S11
            confidence: medium

SupportTicket  id, trip_id, user_id, category, body, status, resolution, refund_charge_id
            evidence: S18, src 9
            confidence: medium

Payout      id, driver_id, period_start, period_end, amount, status
            evidence: S26, src 6
            confidence: medium

ShareLink   id, trip_id, token, expires_at  (public live-tracking page)
            evidence: F07, src 12
            confidence: medium
```

Relationships: User 1-1 DriverProfile, DriverProfile 1-n Vehicle, City 1-n Product,
User(rider) 1-n Trip, User(driver) 1-n Trip, Trip 1-n TripStop, Trip 1-n Dispatch,
Trip 1-n Charge, Trip 1-n Rating (max 2), Trip 1-n Message, User 1-n PaymentMethod,
User 1-n PlaceSaved, User(driver) 1-n Payout.

## Feature matrix

See `features.csv`. Must: 25, should: 13, could: 9, skip: 8.

## Out of scope (cannot or should not be cloned)

- **The network.** Uber's drivers and riders are the product's value. A clone
  starts with zero drivers; recruiting a supply side in one area is a business
  problem, not a build task. Plan launch around one city or niche.
- **Uber's brand and assets.** Name, logo, the black/white car icons, the app's
  wording, map styling. /replica-brand replaces all of it.
- **Uber's map, routing and ETA models, dispatch and surge algorithms.** Rebuild
  simple versions on licensed providers (Mapbox / Google Maps Platform for maps,
  routing and places; your own nearest-driver matching; a simple busy multiplier).
- **Regulated licences and insurance.** Operating rides for hire needs a TNC or
  private-hire operator licence in most places, commercial insurance and driver
  background checks through a licensed vendor. Check your city before launch.
- **Partner deals.** Airport pickup agreements, Uber One, Eats cross-sell,
  rental/transit partners, corporate (Uber for Business) contracts.
- **Data Uber owns.** Trip history, ratings and driver records of its users.

## Size

Screens 28 (19 rider, 8 driver, 1 admin), flows 10, entities 16.
Hard parts:
1. **Realtime location and dispatch.** Driver GPS streaming every few seconds,
   nearest-driver search (geo index), offer/timeout/accept with no double-accept
   race, live car marker on the rider map.
2. **Two native mobile apps with background location.** Driver app must keep
   reporting location while backgrounded; iOS/Android background rules and
   battery. Plus push notifications for requests with a short timer.
3. **Payments and pricing.** Card on file, charge after trip, tips, cancellation
   and wait-time fees, refunds, and driver payouts (Stripe Connect or similar).
Also: maps/routing/ETA provider costs, phone-number masking for calls (Twilio),
SMS OTP, trip-state machine that survives app restarts.

Size: **L** (a quarter) for a one-city MVP of rider app + driver app + admin.
Full Uber feature parity is XL; keep this to the musts.
