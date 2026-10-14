import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversineKm, isValidLocation } from '../src/geo.js';
import { quote, RATES, surgeMultiplier } from '../src/pricing.js';

test('haversine distance matches a known value', () => {
  // One degree of latitude is ~111.2 km.
  assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111.19) < 0.1);
});

test('location validation rejects bad input', () => {
  assert.ok(isValidLocation({ lat: 40.7, lng: -74 }));
  for (const bad of [null, {}, { lat: '40', lng: 1 }, { lat: 91, lng: 0 }, { lat: 0, lng: NaN }]) {
    assert.equal(isValidLocation(bad), false);
  }
});

test('short trips are charged the minimum fare plus booking fee', () => {
  const q = quote({ lat: 40.7, lng: -74 }, { lat: 40.701, lng: -74 });
  assert.equal(q.fareCents, RATES.minimumCents + RATES.bookingFeeCents);
});

test('surge scales the metered fare but not the booking fee', () => {
  const a = { lat: 40.7, lng: -74 };
  const b = { lat: 40.8, lng: -73.9 };
  const normal = quote(a, b, 1);
  const surged = quote(a, b, 2);
  assert.equal(surged.fareCents - RATES.bookingFeeCents, 2 * (normal.fareCents - RATES.bookingFeeCents));
});

test('surge multiplier is clamped between 1 and the maximum', () => {
  assert.equal(surgeMultiplier(0, 0), 1);
  assert.equal(surgeMultiplier(1, 5), 1);
  assert.equal(surgeMultiplier(3, 2), 1.5);
  assert.equal(surgeMultiplier(50, 1), RATES.maxSurge);
});
