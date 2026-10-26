import { test } from "node:test";
import assert from "node:assert/strict";
import { fare, surge, waitFee, cancelFee, driverEarnings, tipOptions, type PriceRule } from "../../lib/pricing.ts";
import { haversine, stepToward, inArea } from "../../lib/geo.ts";

const rule: PriceRule = {
  base_cents: 250, per_km_cents: 110, per_min_cents: 32, min_fare_cents: 900, booking_fee_cents: 250,
  wait_grace_min: 2, wait_per_min_cents: 40, cancel_free_min: 2, cancel_fee_cents: 500, no_show_min: 5,
};
const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 12, 0) + min * 60000);

test("fare: distance + time + booking fee", () => {
  // 250 + 110*5 + 32*15 = 1280, + 250 booking
  assert.equal(fare(rule, 5000, 900), 1530);
});
test("fare: minimum applies", () => {
  assert.equal(fare(rule, 500, 60), 900 + 250);
});
test("fare: surge multiplies ride, not booking fee, and is capped", () => {
  assert.equal(fare(rule, 5000, 900, 1.5), Math.round(1280 * 1.5) + 250);
  assert.equal(fare(rule, 5000, 900, 9), Math.round(1280 * 2) + 250);
  assert.equal(fare(rule, 5000, 900, 0.5), 1530);
});
test("surge: 1 when supply covers demand, rises and caps", () => {
  assert.equal(surge(1, 2, 5), 1);
  assert.equal(surge(1, 5, 1), 2);
  assert.equal(surge(1, 3, 2), 1.13);
  assert.equal(surge(1.5, 0, 3), 1.5);
  assert.equal(surge(1, 1, 0), 1.25);
});
test("wait fee: grace then per started minute; grace starts at the later of arrival and promise", () => {
  assert.equal(waitFee(rule, t(0), null, t(2)), 0);
  assert.equal(waitFee(rule, t(0), null, t(3.5)), 80);
  assert.equal(waitFee(rule, t(0), t(3), t(4)), 0);
});
test("cancel: rider free before accept and inside the free window", () => {
  assert.equal(cancelFee(rule, { by: "rider", now: t(5), acceptedAt: null, arrivedAt: null, promisedAt: null }), 0);
  assert.equal(cancelFee(rule, { by: "rider", now: t(1), acceptedAt: t(0), arrivedAt: null, promisedAt: t(6) }), 0);
});
test("cancel: rider pays after the window", () => {
  assert.equal(cancelFee(rule, { by: "rider", now: t(3), acceptedAt: t(0), arrivedAt: null, promisedAt: t(6) }), 500);
});
test("cancel: waived when the driver is over 5 minutes late", () => {
  assert.equal(cancelFee(rule, { by: "rider", now: t(12), acceptedAt: t(0), arrivedAt: null, promisedAt: t(6) }), 0);
});
test("cancel: waived when the driver made no progress toward the pickup", () => {
  const base = { by: "rider" as const, now: t(3), acceptedAt: t(0), arrivedAt: null, promisedAt: t(6) };
  assert.equal(cancelFee(rule, { ...base, acceptDistanceM: 1200, currentDistanceM: 1180 }), 0);
  assert.equal(cancelFee(rule, { ...base, acceptDistanceM: 1200, currentDistanceM: 1300 }), 0);
  assert.equal(cancelFee(rule, { ...base, acceptDistanceM: 1200, currentDistanceM: 600 }), 500);
  // A driver who accepted from very close needs only half the distance as progress.
  assert.equal(cancelFee(rule, { ...base, acceptDistanceM: 100, currentDistanceM: 40 }), 500);
});
test("cancel: driver no-show only after waiting", () => {
  assert.equal(cancelFee(rule, { by: "driver", now: t(4), acceptedAt: t(0), arrivedAt: t(1), promisedAt: null }), 0);
  assert.equal(cancelFee(rule, { by: "driver", now: t(6), acceptedAt: t(0), arrivedAt: t(1), promisedAt: null }), 500);
  assert.equal(cancelFee(rule, { by: "driver", now: t(6), acceptedAt: t(0), arrivedAt: null, promisedAt: null }), 0);
});
test("driver earnings keep the tip and wait fee", () => {
  assert.equal(driverEarnings(1530, 0, 0, 250), 1024);
  assert.equal(driverEarnings(1610, 80, 300, 250), 1024 + 80 + 300);
});
test("tip options are distinct whole amounts", () => {
  assert.deepEqual(tipOptions(1530), [200, 300, 400]);
  assert.deepEqual(tipOptions(5000), [500, 800, 1000]);
});
test("geo helpers", () => {
  const a = { lat: 40.7359, lng: -73.9911 }, b = { lat: 40.7527, lng: -73.9772 };
  const d = haversine(a, b);
  assert.ok(d > 2100 && d < 2300, String(d));
  const s = stepToward(a, b, 100);
  assert.ok(Math.abs(haversine(a, s) - 100) < 1);
  assert.deepEqual(stepToward(a, b, 1e6), b);
  assert.ok(inArea(a, { min_lat: 40, max_lat: 41, min_lng: -75, max_lng: -73 }));
});
