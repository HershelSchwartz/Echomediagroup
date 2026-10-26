# Test plan: ride app

Build: 3306046+photos  Date: 2026-10-26  Env: local Next.js dev server, Postgres 16, seed data, Chromium (Pixel 7 viewport)

Automated: `npm run test:unit` (12 pricing/geo cases) and `npm run test:e2e` (14 Playwright specs). Every e2e spec
fails on any console error or 5xx response, and runs an axe WCAG 2 A/AA scan on each screen it visits.
Last run: 12/12 unit, 14/14 e2e passed.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | rider signs up | happy | phone, code, name, terms | lands on map, "Hi Jordan" | e2e | pass |
| F01-N1 | | negative: wrong code | enter 000000 | "That code didn't match" | e2e | pass |
| F01-E1 | | edge: location denied | deny geolocation, type pickup | warning banner, typed pickup works | e2e | pass |
| F01-N2 | | negative: signed out deep link | open /ride/wallet signed out | sign-in with next=/ride/wallet | e2e | pass (was BUG-001) |
| F01-N3 | | negative: code limit | 6th code in an hour | 429 "Too many codes" | unit-level (server) | manual |
| F02-H1 | rider requests | happy | Where to → Grand Central → Standard → Request | "Finding you a driver" | e2e | pass |
| F02-E1 | | edge: double tap Request | second POST /api/trips | 409, one live trip | API smoke | pass |
| F02-E2 | | edge: price rose >5% since quote | request with stale quote | 409 price_changed, new price shown | manual | not run |
| F02-E3 | | edge: pickup outside the city | quote outside the box | 422 "We don't serve…" | manual | not run |
| F02-N1 | | negative: no payment method | new rider requests | Request disabled, Wallet link | e2e (F08 setup) | pass |
| F03-H1 | driver takes trip | happy | Go → offer → Accept → Arrived → hold Start → hold End | rider sees each state | e2e | pass |
| F03-E1 | | edge: two accepts | accept twice / two drivers | second gets 409 | API smoke | pass |
| F03-E2 | | edge: offer expires | wait 15 s | next driver offered | manual | not run |
| F03-E3 | | edge: GPS pickup | rider asks from GPS | driver sees "Union Square", never "Current location" | e2e | pass (was BUG-002) |
| F04-H1 | trip completes | happy | end trip, rate 5★, tip $2 | fare + tip charged, receipt, driver earnings include tip | e2e | pass |
| F04-E1 | | edge: skip rating, reload | Not now, reload /ride | home screen, no rating prompt | e2e (F08) | pass (was BUG-003) |
| F04-N1 | | negative: rate twice | second rating | 409 already rated | API smoke | pass |
| F05-H1 | rider cancels | happy: while matching | Cancel → Cancel ride | no fee | e2e | pass |
| F05-E1 | | edge: after free window | cancel 3 min after accept | $5 fee shown and charged; driver told | e2e | pass |
| F05-E2 | | edge: no drivers | nobody online, 3 min | "No cars are free", Try again | e2e | pass |
| F05-E3 | | edge: driver late >5 min | cancel | fee waived | unit | pass |
| F05-E4 | | edge: driver no-show after wait | driver marks no-show | fee to rider; too early → refused | unit | pass |
| F06-H1 | dispute a fee | happy | Help → reason → admin refunds $5 | refund row, rider sees "Refunded" | e2e | pass |
| F07-H1 | share trip | happy | Share → open link signed out | status + driver first name + car; no rider name or phone | e2e | pass |
| F08-N1 | payments | negative: card declined | trip on 0002 card | unpaid balance blocks next ride; pay with 4242 clears it | e2e | pass |
| F09-H1 | driver onboarding | happy | apply → upload → admin approves → Go | online | e2e | pass |
| F09-N1 | | negative: rider opens admin | /admin, /api/admin/overview | no access, 403 | e2e | pass |
| SEC-1 | access | second user's data | other user GET /api/trips/:id | 404 | API smoke | pass |
| SEC-2 | access | rider calls driver action | rider POST /arrived | 403 | API smoke | pass |
| A11Y | all | axe on every visited screen | | 0 violations | e2e | pass (was BUG-004) |
| VIS-1 | maps | markers visible on tall phone | S07 screenshot | pickup and drop-off both on screen | e2e screenshot | pass (was BUG-005) |

Manual pass still owed (need real devices or provider keys): SMS delivery (Twilio), emails arriving
(Resend), a real Stripe test-mode card through Checkout and the webhook, Mapbox tiles/search,
background behaviour of the driver PWA on iOS and Android, multiple stops, change destination,
ride for someone else, cash, destination filter (built, not yet covered by e2e).
