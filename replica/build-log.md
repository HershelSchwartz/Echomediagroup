# Build log

| screen | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S01-S03 sign in / code / profile | 2026-10-26 | done | rider photo moved to Account | — |
| S04 location permission | 2026-10-26 | done | | |
| S05 home | 2026-10-26 | done | | |
| S06 destination search | 2026-10-26 | done | | combobox + stops + guest in one sheet |
| S07 choose a ride | 2026-10-26 | done | | price-changed handling |
| S08 confirm pickup | 2026-10-26 | done (tap map to move pickup, in S07) | drag gesture | pickup labels for drivers (BUG-002) |
| S09 finding driver | 2026-10-26 | done | | dispatch without a worker: advanced on each poll |
| S10 driver on the way | 2026-10-26 | done | | |
| S11 chat | 2026-10-26 | done | masked calls | |
| S12 on trip | 2026-10-26 | done | automatic safety check-ins | |
| S13 rate / tip | 2026-10-26 | done | | |
| S14 receipt | 2026-10-26 | done | PDF receipt | |
| S15 activity | 2026-10-26 | done | | |
| S16 wallet | 2026-10-26 | done (Stripe Checkout setup + dev cards) | Stripe path untested without keys | |
| S17 account | 2026-10-26 | done (incl. delete account, photo) | | |
| S18 help | 2026-10-26 | done | | |
| S19 cancel | 2026-10-26 | done | | |
| S20 driver sign-up + documents | 2026-10-26 | done | background-check vendor | |
| S21 driver home | 2026-10-26 | done | | background location needs a native app |
| S22 offer | 2026-10-26 | done | Trip Radar | |
| S23-S24 to pickup / on trip | 2026-10-26 | done | | hold-to-confirm for start/end |
| S25 driver summary | 2026-10-26 | done | | |
| S26 earnings | 2026-10-26 | done | payouts (Stripe Connect) | |
| S27 destination filter | 2026-10-26 | done | | |
| S28 operations console | 2026-10-26 | done | | |

Bigger than it looked: real background location for drivers. A web app can't report location with the
screen off on iOS; the PWA keeps the screen awake and warns, but a pilot with real drivers needs the
Expo driver app. This is the top item after launch prep.
