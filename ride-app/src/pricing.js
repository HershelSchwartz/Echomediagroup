import { haversineKm } from './geo.js';

// All money is integer cents to avoid floating-point drift.
export const RATES = {
  currency: 'USD',
  baseCents: 250,
  perKmCents: 120,
  perMinCents: 30,
  bookingFeeCents: 150,
  minimumCents: 600,
  // Straight-line distance understates real roads; this pads it.
  roadFactor: 1.3,
  avgSpeedKmh: 28,
  maxSurge: 3,
};

/** Demand-based multiplier: open requests per available driver, clamped to [1, maxSurge]. */
export function surgeMultiplier(openRequests, availableDrivers, rates = RATES) {
  if (openRequests <= 0) return 1;
  const ratio = openRequests / Math.max(availableDrivers, 1);
  return Math.min(rates.maxSurge, Math.max(1, Math.round(ratio * 10) / 10));
}

/** Upfront quote for a trip. The fare is locked when the ride is requested. */
export function quote(pickup, dropoff, surge = 1, rates = RATES) {
  const distanceKm = haversineKm(pickup, dropoff) * rates.roadFactor;
  const durationMin = Math.max(1, Math.round((distanceKm / rates.avgSpeedKmh) * 60));
  const metered = rates.baseCents + rates.perKmCents * distanceKm + rates.perMinCents * durationMin;
  const fareCents = Math.max(rates.minimumCents, Math.round(metered * surge)) + rates.bookingFeeCents;
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
    surge,
    fareCents,
    currency: rates.currency,
  };
}
