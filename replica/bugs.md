# Bugs

Severity: S1 data loss/security/payments/core flow blocked · S2 feature broken, no workaround · S3 broken with workaround or visibly wrong · S4 cosmetic.
Open: none. All found bugs were reproduced by a failing test first and fixed in 3306046 (BUG-001..005) unless noted.

### BUG-001: signing in from a deep link drops the page you asked for
- Severity: S3 · Flow: F01-N2 · Screen: S01
- Steps: signed out, open /ride/wallet. Expected: sign in returns to /ride/wallet. Actual: returned to /ride.
- Evidence: e2e F01-N2 (URL was /login?next=/ride). Cause: layouts can't see the path. Fix: `proxy.ts` passes the path; layouts redirect with it.
- Status: fixed in 3306046

### BUG-002: driver sees "Current location" as the pickup address
- Severity: S3 · Flow: F03 · Screen: S22, S23
- Steps: rider requests from GPS. Expected: a place the driver can find. Actual: "Current location".
- Evidence: e2e F02/F03 failed on getByText("Union Square"). Fix: `describePoint` labels GPS and pinned points (Mapbox reverse, else nearest landmark).
- Status: fixed in 3306046

### BUG-003: skipping the rating blocks the home screen on every reload
- Severity: S2 · Flow: F04-E1 · Screen: S13, S05
- Steps: finish a trip, tap Not now, reload /ride. Expected: home screen. Actual: rating sheet again; "Where to?" unreachable until rated.
- Evidence: e2e F08 timed out waiting for "Where to?". Fix: skipped ratings are remembered on the device; the trip stays rateable and tippable from Activity.
- Status: fixed in 3306046

### BUG-004: invalid description-list markup on trip summaries
- Severity: S3 · Screens: S10, S12, S14, S22
- Evidence: axe "definition-list (serious)". Fix: only dt/dd inside each group.
- Status: fixed in 3306046

### BUG-005: map crops the pickup and drop-off on tall phone screens
- Severity: S3 · Screen: S07 (and every map without provider tiles)
- Evidence: replica/clone-screens/S07.png showed the route running off screen with no markers. Fix: map bounds now match the container's shape.
- Status: fixed in 3306046

## To check (not reproduced)
- Price change between quote and request (F02-E2) and offer expiry hand-off (F03-E2) are covered by server logic but not yet by a test.
