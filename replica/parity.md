## Parity: 87.3 / 100

features 87.3  (47 counted, must-haves 22 of 25 done)

Not shippable yet: 3 must-have features are not done.

## By area, weakest first
- platform                       0.0  (1 features)
- notifications                 50.0  (1 features)
- communication                 50.0  (2 features)
- payments                      75.0  (9 features)
- driver                        82.1  (6 features)
- safety                        83.3  (2 features)
- dispatch                      92.3  (5 features)
- request                       95.5  (9 features)
- onboarding                   100.0  (3 features)
- trip                         100.0  (3 features)
- ratings                      100.0  (1 features)
- history                      100.0  (1 features)
- admin                        100.0  (2 features)
- support                      100.0  (1 features)
- pricing                      100.0  (1 features)

## Missing, in build order
- [must] driver: Driver background location reporting, partial  (hard part; browser only reports while the screen is on; needs the native driver app)
- [must] notifications: Push notifications (request matched arriving arrived), partial  (in-app live updates and SMS to guest riders; no push)
- [must] payments: Card on file and automatic charge after trip, partial  (S16 Stripe; dev card path e2e tested; Stripe path written but untested until keys are added)
- [should] communication: Masked phone call between rider and driver, no  (Twilio proxy numbers; needs Twilio Proxy numbers)
- [should] driver: Driver onboarding with document upload, partial  (S20 background check via licensed vendor; form and uploads done; background-check vendor not integrated)
- [should] payments: Driver payouts, partial  (Stripe Connect; earnings ledger; Stripe Connect payouts not built)
- [could] dispatch: Trip Radar (offer to several drivers), no  (S22)
- [could] payments: Promo codes, no
- [could] payments: Split fare, no
- [could] platform: Multi-language, no
- [could] request: Scheduled rides (reserve), no
- [could] safety: Safety toolkit (emergency button trip check-ins), partial  (911, share, report; no automatic check-ins)

## Left out on purpose (not scored)
- Uber's driver and rider network: the users are not part of the product you can rebuild
- Uber brand name logo icons and copy: owned assets; /replica-brand replaces them
- Uber's dispatch surge and ETA algorithms: proprietary; build simple versions
- Uber Eats delivery: outside this slice
- Uber for Business and corporate accounts: outside this slice and partner contracts
- Uber One subscription: outside this slice
- Airport and partner agreements: partner deals
- Operating licence insurance and background checks: get your own TNC/private-hire licence and use a licensed vendor

## Yours, not in the original (not scored)
- Price lock: the upfront price is the charge (only wait time or a rider's destination change can move it)
- No cancellation fee when the driver never headed to the pickup
- Open fare split: driver sees rider fare and platform cut on every offer and trip
- Driver suspensions need a written reason and a one-tap human review
- First cancellation-fee dispute refunded instantly

## Layout score

Not measured. There are no reference screenshots of the original in `replica/screens/` (the App Store and
uber.com were unreachable from the build environment, and a layout diff should use your own phone's
screenshots). The clone's screens are in `replica/clone-screens/`. To score layout: save the original's
screens at 1080x2200 (or any phone size) as `replica/screens/S05.png`, `S07.png`, ... then run
`python3 .claude/skills/replica-diff/imgdiff.py replica/screens/S07.png replica/clone-screens/S07.png --json > replica/diffs/S07.json`.

## Behaviour diff

| flow | original does | clone does | fix or keep |
| --- | --- | --- | --- |
| F02 request | Where to → pick place → choose ride → confirm pickup → request (about 4 taps) | Where to → pick place (auto-advances to prices) → Request: 3 taps from home, 2 with a saved place | keep: fewer taps |
| F02 pickup | drag the pin on a street-level map | tap the map to move pickup; label resolved to a place name for the driver | fix later: drag gesture on the Mapbox map |
| F03 offer | exclusive offer with timer; Trip Radar multi-offer | exclusive 15 s offer, one driver at a time | keep for a pilot; Trip Radar is a could |
| F04 end | rating then tip, tip window 30 to 90 days | rating then tip on the spot; tip later from Activity for 30 days | keep |
| F04 skip rating | prompt shows once | prompt shows once per device (BUG-003 fixed) | keep |
| F05 cancel | fee after 2 min, waived if driver very late | same rules, shown in the cancel dialog before you confirm | keep: the fee is shown up front |
| F06 support | in-app help flows, mostly automated | ticket to the operations console, human reply by email, refund in one step | keep for a pilot |
| F07 share | live status link | live status link with no rider name or phone | keep |
| F08 payments | card on file, unpaid balance blocks riding | same | keep |
| realtime | push channel, native background location | 2 to 3 s polling, driver screen must stay on | fix: Expo driver app (top item) |
| notifications | push for matched, arriving, arrived | live in-app updates; SMS to guest riders | fix: push in the native apps |

## Verdict

**Not shippable yet**: 3 must-haves are partial, and all three depend on things outside this repo:
1. Driver background location: needs the native (Expo) driver app.
2. Push notifications: arrive with the native apps (Expo push).
3. Card charges through Stripe: the code is written; it needs your Stripe test keys and one end-to-end run.

No open S1 or S2 bugs. Feature score 87.3. Once the three above are done, the verdict is shippable. The five
replica-entrepreneur fixes are already built (price lock, no-progress fee waiver, open fare split, fair driver
reviews, instant first dispute refund), so at that point it is "better than the original".

## Top five to build next

1. Expo driver app with background location and push (closes 2 must-haves).
2. Run the Stripe path with test keys: add a card through Checkout, finish a trip, refund it.
3. Expo rider app (push for matched, arriving, arrived).
4. Masked calls through Twilio Proxy.
5. Stripe Connect payouts for drivers.
