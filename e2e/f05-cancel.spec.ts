import { test, expect, signIn, requestRide, goOnline, sql } from "./helpers";

test("F05-H1: rider cancels while matching, no fee", async ({ browser, users }) => {
  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await requestRide(rider.page, "Times Square");
  await expect(rider.page.getByRole("heading", { name: "Finding you a driver" })).toBeVisible();
  await rider.page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(rider.page.getByText("You won't be charged.")).toBeVisible();
  await rider.page.getByRole("button", { name: "Cancel ride" }).click();
  await expect(rider.page.getByRole("heading", { name: /where to\?/i })).toBeVisible();
  const [t] = await sql`select status, cancel_fee_cents from trips order by requested_at desc limit 1`;
  expect(t.status).toBe("cancelled_by_rider");
  expect(t.cancel_fee_cents).toBe(0);
  rider.check();
});

test("F05-E1: cancelling after the free window shows and charges the fee", async ({ browser, users }) => {
  const driver = await users();
  await signIn(driver.page, "+15550000203", "/drive");
  await goOnline(driver.page);
  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await requestRide(rider.page, "Penn Station");
  await driver.page.getByRole("button", { name: "Accept" }).click({ timeout: 20_000 });
  await expect(rider.page.getByTestId("driver-card")).toBeVisible();
  // Move the acceptance 3 minutes into the past, with the driver most of the way there.
  await sql`update trips set accepted_at = now() - interval '3 minutes', pickup_eta_at = now() + interval '2 minutes', accept_distance_m = 2000 where status = 'accepted'`;
  await rider.page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(rider.page.getByText(/costs \$5\.00/)).toBeVisible();
  await rider.page.getByRole("button", { name: "Cancel ride" }).click();
  await expect(rider.page.getByRole("heading", { name: /where to\?/i })).toBeVisible();
  const [c] = await sql`select kind, amount_cents, status from charges where kind = 'cancellation' order by created_at desc limit 1`;
  expect(c).toMatchObject({ kind: "cancellation", amount_cents: 500, status: "succeeded" });
  await expect(driver.page.getByRole("heading", { name: "The rider cancelled" })).toBeVisible();
  rider.check();
  driver.check();
});

test("F05-E3: no fee when the driver never headed to the pickup", async ({ users }) => {
  const driver = await users();
  await signIn(driver.page, "+15550000202", "/drive");
  await driver.page.getByLabel("Simulate driving (development only)").uncheck();
  await driver.page.context().setGeolocation({ latitude: 40.745, longitude: -73.988 });
  await goOnline(driver.page);
  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await requestRide(rider.page, "Penn Station");
  await driver.page.getByRole("button", { name: "Accept" }).click({ timeout: 20_000 });
  await expect(rider.page.getByTestId("driver-card")).toBeVisible();
  await sql`update trips set accepted_at = now() - interval '3 minutes', pickup_eta_at = now() + interval '2 minutes' where status = 'accepted'`;
  await rider.page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(rider.page.getByText("You won't be charged.")).toBeVisible();
  await rider.page.getByRole("button", { name: "Cancel ride" }).click();
  const [t] = await sql`select cancel_fee_cents from trips order by requested_at desc limit 1`;
  expect(t.cancel_fee_cents).toBe(0);
  rider.check();
});

test("F05-E2: no drivers online ends in a clear no-cars state, no charge", async ({ browser, users }) => {
  await sql`update driver_profiles set online = false`;
  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await requestRide(rider.page, "Times Square");
  await expect(rider.page.getByRole("heading", { name: "Finding you a driver" })).toBeVisible();
  await sql`update trips set requested_at = now() - interval '4 minutes' where status = 'matching'`;
  await expect(rider.page.getByRole("heading", { name: "No cars are free right now" })).toBeVisible({ timeout: 15_000 });
  await rider.page.getByRole("button", { name: "Try again" }).click();
  await expect(rider.page.getByRole("radiogroup", { name: "Ride options" })).toBeVisible();
  rider.check();
});
