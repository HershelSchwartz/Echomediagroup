import { test, expect, signIn, goOnline, requestRide, sql, axe } from "./helpers";

test("F07-H1: share a live trip; the public page shows status without the rider's details", async ({ browser, users }) => {
  const driver = await users();
  await signIn(driver.page, "+15550000205", "/drive");
  await goOnline(driver.page);
  const rider = await users();
  await signIn(rider.page, "+15550000100");
  await requestRide(rider.page, "Lincoln Center");
  await driver.page.getByRole("button", { name: "Accept" }).click({ timeout: 20_000 });
  await expect(rider.page.getByTestId("driver-card")).toBeVisible();
  await rider.page.getByRole("button", { name: "Share" }).click();
  const note = rider.page.getByText(/Link ready:/);
  await expect(note).toBeVisible();
  const url = (await note.textContent())!.replace("Link ready: ", "").trim();

  const { page: guest } = await users({ geo: false });
  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: /Driver on the way/ })).toBeVisible();
  await expect(guest.getByText("Mia")).toBeVisible();
  await expect(guest.getByText("Alex")).toHaveCount(0);
  await expect(guest.getByText("+1555")).toHaveCount(0);
  await axe(guest);

  // Clean up: driver backs out, rider cancels.
  await rider.page.getByRole("button", { name: "Cancel", exact: true }).click();
  await rider.page.getByRole("button", { name: "Cancel ride" }).click();
  rider.check();
});

test("F06-H1: first cancellation-fee dispute is refunded on the spot", async ({ users }) => {
  const [trip] = await sql`select t.id from trips t join users u on u.id = t.rider_id
    where u.phone = '+15550000100' and t.cancel_fee_cents > 0 order by t.requested_at desc limit 1`;
  test.skip(!trip, "needs the cancellation-fee trip from f05");
  const rider = await users();
  await signIn(rider.page, "+15550000100", `/ride/help?trip=${trip.id}`);
  await rider.page.getByLabel("I shouldn't have paid a cancellation fee").check();
  await rider.page.getByLabel("Tell us what happened").fill("The driver was going the wrong way so I cancelled.");
  await rider.page.getByRole("button", { name: "Send" }).click();
  await expect(rider.page.getByText("We've refunded $5.00")).toBeVisible();
  await axe(rider.page);
  const [r] = await sql`select amount_cents from charges where trip_id = ${trip.id} and kind = 'refund'`;
  expect(r.amount_cents).toBe(-500);
  rider.check();
});

test("F06-H2: other requests go to a person, who replies in the console", async ({ users }) => {
  const rider = await users();
  await signIn(rider.page, "+15550000100", "/ride/help");
  await rider.page.getByLabel("I left something in the car").check();
  await rider.page.getByLabel("Tell us what happened").fill("I left a blue umbrella on the back seat.");
  await rider.page.getByRole("button", { name: "Send" }).click();
  await expect(rider.page.getByText("a person will reply")).toBeVisible();

  const admin = await users();
  await signIn(admin.page, "+15550000001", "/admin");
  await admin.page.getByRole("tab", { name: /Support/ }).click();
  await admin.page.getByRole("button", { name: "Resolve" }).first().click();
  await admin.page.getByLabel("Reply to the rider").fill("Found it. Your driver will drop it off tomorrow.");
  await admin.page.getByRole("button", { name: "Send" }).click();
  await expect(admin.page.getByText("No open requests.")).toBeVisible();

  await rider.page.reload();
  await expect(rider.page.getByText("Found it. Your driver will drop it off tomorrow.")).toBeVisible();
  rider.check();
  admin.check();
});
