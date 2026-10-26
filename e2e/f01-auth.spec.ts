import { test, expect, signIn, axe } from "./helpers";

test("F01-H1: new rider signs up with a phone code and lands on the map", async ({ browser, users }) => {
  const u = await users();
  await u.page.goto("/login");
  await axe(u.page);
  await signIn(u.page, "+1 (555) 000-0777", "/ride", "Jordan Lee");
  await expect(u.page.getByRole("heading", { name: "Hi Jordan, where to?" })).toBeVisible();
  u.check();
});

test("F01-N1: a wrong code is rejected with a clear message", async ({ browser, users }) => {
  const u = await users();
  await u.page.goto("/login");
  await u.page.getByLabel("Mobile number").fill("+15550000778");
  await u.page.getByRole("button", { name: "Send code" }).click();
  await u.page.getByLabel("6-digit code").fill("000000");
  await u.page.getByRole("button", { name: "Continue" }).click();
  await expect(u.page.getByText("That code didn't match")).toBeVisible();
  await axe(u.page);
});

test("F01-E1: location denied still lets the rider type a pickup", async ({ browser, users }) => {
  const u = await users({ geo: false });
  await signIn(u.page, "+15550000100");
  await expect(u.page.getByText("We can't see your location")).toBeVisible();
  await u.page.getByRole("button", { name: "Where to?" }).click();
  await u.page.getByRole("combobox", { name: "Pickup" }).fill("Union");
  await u.page.getByRole("option").filter({ hasText: "Union Square" }).first().getByRole("button").click();
  await u.page.getByRole("combobox", { name: "Drop-off" }).fill("Hudson");
  await u.page.getByRole("option").filter({ hasText: "Hudson Yards" }).first().getByRole("button").click();
  await expect(u.page.getByRole("radiogroup", { name: "Ride options" })).toBeVisible();
  u.check();
});

test("F01-N2: signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/ride/wallet");
  await expect(page).toHaveURL(/\/login\?next=%2Fride%2Fwallet$/);
});
