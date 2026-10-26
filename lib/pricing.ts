// Pure fare rules. Unit tested in tests/unit/pricing.test.ts.

export type PriceRule = {
  base_cents: number;
  per_km_cents: number;
  per_min_cents: number;
  min_fare_cents: number;
  booking_fee_cents: number;
  wait_grace_min: number;
  wait_per_min_cents: number;
  cancel_free_min: number;
  cancel_fee_cents: number;
  no_show_min: number;
};

export const MAX_SURGE = 2.0;

/** Upfront fare in cents for a route. Surge applies to the ride, not the booking fee. */
export function fare(rule: PriceRule, distanceM: number, durationS: number, surge = 1): number {
  const ride = rule.base_cents + (rule.per_km_cents * distanceM) / 1000 + (rule.per_min_cents * durationS) / 60;
  const s = Math.min(Math.max(surge, 1), MAX_SURGE);
  return Math.round(Math.max(rule.min_fare_cents, ride) * s) + rule.booking_fee_cents;
}

/**
 * Automatic busy multiplier: open requests vs idle drivers nearby, times the
 * city's manual multiplier, capped. 1.0 when supply covers demand.
 */
export function surge(cityMultiplier: number, openRequests: number, idleDrivers: number): number {
  const ratio = idleDrivers <= 0 ? (openRequests > 0 ? 2 : 1) : openRequests / idleDrivers;
  const auto = ratio <= 1 ? 1 : Math.min(1 + (ratio - 1) * 0.25, MAX_SURGE);
  return Math.round(Math.min(cityMultiplier * auto, MAX_SURGE) * 100) / 100;
}

const minutes = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60000;

/**
 * Wait fee: per started minute after the grace period. The grace period starts at the
 * later of the driver's arrival and the pickup time we promised.
 */
export function waitFee(rule: PriceRule, arrivedAt: Date, promisedAt: Date | null, startedAt: Date): number {
  const from = promisedAt && promisedAt > arrivedAt ? promisedAt : arrivedAt;
  const billable = minutes(from, startedAt) - rule.wait_grace_min;
  return billable > 0 ? Math.ceil(billable) * rule.wait_per_min_cents : 0;
}

export type CancelInput = {
  by: "rider" | "driver";
  now: Date;
  acceptedAt: Date | null;
  arrivedAt: Date | null;
  promisedAt: Date | null;
  /** metres from the pickup when the driver accepted, and now (rider cancels only) */
  acceptDistanceM?: number | null;
  currentDistanceM?: number | null;
};

/** The driver must have closed at least this much distance toward the pickup for a fee to apply. */
export const MIN_PROGRESS_M = 150;

/**
 * Cancellation fee charged to the rider, in cents.
 * Rider cancels: free before a driver accepts and within the free window after; free if the
 * driver is more than 5 minutes past the promised pickup time and has not arrived.
 * Driver cancels: the rider pays only for a no-show, after the driver waited no_show_min.
 */
export function cancelFee(rule: PriceRule, c: CancelInput): number {
  if (c.by === "driver") {
    if (!c.arrivedAt) return 0;
    return minutes(c.arrivedAt, c.now) >= rule.no_show_min ? rule.cancel_fee_cents : 0;
  }
  if (!c.acceptedAt) return 0;
  if (!c.arrivedAt && c.promisedAt && minutes(c.promisedAt, c.now) > 5) return 0;
  // Never charge when the driver wasn't actually coming: no progress toward the pickup.
  if (!c.arrivedAt && c.acceptDistanceM != null && c.currentDistanceM != null
      && c.acceptDistanceM - c.currentDistanceM < Math.min(MIN_PROGRESS_M, c.acceptDistanceM * 0.5)) return 0;
  return minutes(c.acceptedAt, c.now) > rule.cancel_free_min ? rule.cancel_fee_cents : 0;
}

/** Driver earnings: fare minus the platform's take, plus all of the tip and wait fee. */
export const PLATFORM_TAKE = 0.2;
export function driverEarnings(fareCents: number, waitFeeCents: number, tipCents: number, bookingFeeCents: number): number {
  const ride = Math.max(0, fareCents - waitFeeCents - bookingFeeCents);
  return Math.round(ride * (1 - PLATFORM_TAKE)) + waitFeeCents + tipCents;
}

/** Three tip suggestions from the fare (about 10/15/20%), whole currency units, each at least 1 more than the last. */
export function tipOptions(fareCents: number): number[] {
  const out: number[] = [];
  for (const p of [0.1, 0.15, 0.2]) {
    const v = Math.max(100, Math.round((fareCents * p) / 100) * 100);
    out.push(out.length ? Math.max(v, out[out.length - 1] + 100) : v);
  }
  return out;
}
