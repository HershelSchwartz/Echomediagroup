# Fixes and positioning

Sample size: 0 verbatim reviews (sources unreachable from the build environment); evidence is the
linked secondary research in `feedback.md`. Re-rank once `reviews.csv` has 100+ real rows.

## 1. What they hate
1. **Being charged a cancellation fee when the driver was the problem.** 246 of 5,918 negative reviews in one analysis; 108 say the driver cancelled. One source (thin). [link](https://unstar.app/blog/uber-charged-cancellation-fee-driver-cancelled-reviews-2026)
2. **Prices that change after you agreed to them.** About a quarter of 1-star ride-app reviews in one analysis; older complaint listings agree. Two sources.
3. **Drivers: not knowing what the platform keeps.** Five sources, academic and press; Uber disputes the numbers.
4. **Drivers: deactivated with no reason and no appeal.** Three sources, self-selected surveys.

## 2. What is missing
- Per-trip fare split for drivers (Uber shows a weekly average only).
- A human, accountable review for deactivations.

## 3. What is unsolved
- **A ride service drivers would choose to drive for**, in a market where the supply side is the hard part.
  A clone starts with zero drivers (recon, out of scope): this is the one angle that helps recruit them.

## Fix plan (built)

| # | fix | size | where | evidence | status |
| --- | --- | --- | --- | --- | --- |
| 1 | Price lock: the upfront price is the charge; only wait time past the free minutes or a destination change the rider makes can change it; receipt says so | S | ChooseSheet, receipt | theme 2 | built |
| 2 | No cancellation fee if the driver made no progress toward the pickup (plus existing: late driver, driver cancels) | S | lib/pricing cancelFee | theme 1 | built, unit + e2e |
| 3 | Open fare split: every offer and every trip shows rider fare, driver share, platform cut | S | driver offer, earnings | theme 3 | built, e2e |
| 4 | Suspensions and rejections need a written reason the driver sees, and a one-tap human review | S | admin review API, /drive | theme 4 | built, e2e |
| 5 | First cancellation-fee dispute in 90 days refunded on the spot; everything else goes to a person | S | /api/support | themes 1, 5 | built, e2e |

Pricing and billing points (flat take rate, published) go to `/replica-launch`.

## Positioning angles

```
A. For riders who are tired of fees they didn't agree to,
   Ride locks the price before you book and never charges you for a driver's cancellation.
   Evidence: themes 1 and 2, 3 sources (one thin).

B. For drivers who can't see what the app keeps,
   Ride shows the full split on every trip: rider pays X, you get 80% plus all tips, we keep the rest.
   Evidence: theme 3, 5 sources.

C. For a city that wants a fair local ride service,
   Ride is open on both sides: a locked price for riders and a published, fixed cut for drivers.
   Evidence: themes 1-4.
```

**Recommended: C**, led by B in driver recruiting and A in rider marketing. A new ride service lives or
dies on getting drivers first; "open on both sides" is the one message that serves both. Don't name the
original in the app name, ads or listing; a comparison page is a question for a lawyer.
