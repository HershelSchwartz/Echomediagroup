import { test, expect, signIn, goOnline, requestRide, hold, sql, axe } from "./helpers";

test("F08-N1: a declined card leaves an unpaid balance that blocks the next ride until paid", async ({ browser, users }) => {
  const rider = await users();
  await signIn(rider.page, "+15550000301", "/ride", "Casey Decline");
  await rider.page.goto("/ride/wallet");
  await expect(rider.page.getByText("No payment methods yet")).toBeVisible();
  await axe(rider.page);
  await rider.page.getByRole("button", { name: "Add test card (declines)" }).click();
  await expect(rider.page.getByText("•••• 0002")).toBeVisible();

  const driver = await users();
  await signIn(driver.page, "+15550000204", "/drive");
  await goOnline(driver.page);

  await requestRide(rider.page, "Chelsea Market");
  await driver.page.getByRole("button", { name: "Accept" }).click({ timeout: 20_000 });
  await driver.page.getByRole("button", { name: "I've arrived" }).click();
  await hold(driver.page, /Hold to start trip/);
  await hold(driver.page, /Hold to end trip/);
  await expect(driver.page.getByRole("heading", { name: "Trip complete" })).toBeVisible();

  await expect(rider.page.getByRole("heading", { name: /How was your ride/ })).toBeVisible();
  await rider.page.getByRole("button", { name: "Not now" }).click();

  // Next request is blocked.
  await requestRide(rider.page, "Times Square");
  await expect(rider.page.getByText("A past ride wasn't paid")).toBeVisible();

  // Pay it with a working card.
  await rider.page.goto("/ride/wallet");
  await expect(rider.page.getByText(/Unpaid balance/)).toBeVisible();
  await rider.page.getByRole("button", { name: "Add test card (works)" }).click();
  await rider.page.getByRole("listitem").filter({ hasText: "4242" }).getByRole("button", { name: "Make default" }).click();
  await rider.page.getByRole("button", { name: "Pay with default method" }).click();
  await expect(rider.page.getByText("Paid. Thanks!")).toBeVisible();
  const [{ n }] = await sql`select count(*)::int as n from charges c join users u on u.id = c.user_id
    where u.phone = '+15550000301' and c.kind = 'fare' and c.status = 'succeeded'`;
  expect(n).toBe(1);
  rider.check();
});
