import { test, expect, signIn, axe, sql } from "./helpers";

test("F09-H1: apply to drive, upload a document, get approved, go online", async ({ browser, users }) => {
  const d = await users();
  await signIn(d.page, "+15550000401", "/drive", "Robin Park");
  await expect(d.page.getByRole("heading", { name: "Drive with us" })).toBeVisible();
  await axe(d.page);
  await d.page.getByLabel("Driver's licence number").fill("NY-1234567");
  await d.page.getByLabel("Licence expiry date").fill("2030-01-31");
  await d.page.getByLabel("Make").fill("Kia");
  await d.page.getByLabel("Model").fill("Niro");
  await d.page.getByLabel("Colour").fill("Green");
  await d.page.getByLabel("Plate").fill("tst4401");
  await d.page.getByLabel("Year").fill("2021");
  await d.page.getByRole("button", { name: "Continue" }).click();
  await expect(d.page.getByText("We're reviewing your details")).toBeVisible();
  await d.page.locator('input[type=file]').first().setInputFiles({ name: "licence.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(d.page.getByText("licence.png · in review")).toBeVisible();
  await axe(d.page);

  const admin = await users();
  await signIn(admin.page, "+15550000001", "/admin");
  await admin.page.getByRole("tab", { name: /Drivers/ }).click();
  const row = admin.page.getByRole("row").filter({ hasText: "Robin Park" });
  await expect(row).toContainText("pending");
  await axe(admin.page);
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row).toContainText("approved");

  await d.page.goto("/drive");
  await d.page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(d.page.getByRole("heading", { name: "You're online" })).toBeVisible();
  d.check();
  admin.check();
});

test("F09-N1: riders can't open the operations console", async ({ browser, users }) => {
  const u = await users();
  await signIn(u.page, "+15550000100", "/admin");
  await expect(u.page.getByText("You don't have access")).toBeVisible();
  const r = await u.page.request.get("/api/admin/overview");
  expect(r.status()).toBe(403);
});

test("F09-N2: suspending a driver requires a reason they can read", async ({ users }) => {
  const admin = await users();
  await signIn(admin.page, "+15550000001", "/admin");
  const [d] = await sql`select user_id from driver_profiles dp join users u on u.id = dp.user_id where u.phone = '+15550000205'`;
  const bad = await admin.page.request.post(`/api/admin/drivers/${d.user_id}/review`, { data: { status: "suspended" } });
  expect(bad.status()).toBe(400);
  const ok = await admin.page.request.post(`/api/admin/drivers/${d.user_id}/review`, { data: { status: "suspended", note: "Three riders reported unsafe driving this week." } });
  expect(ok.ok()).toBe(true);
  const driver = await users();
  await signIn(driver.page, "+15550000205", "/drive");
  await expect(driver.page.getByText("Three riders reported unsafe driving this week.")).toBeVisible();
  await driver.page.getByLabel("Ask for a review").fill("Those were on a closed road with detours; I have dashcam video.");
  await driver.page.getByRole("button", { name: "Send for review" }).click();
  await expect(driver.page.getByText("A person on our team will review")).toBeVisible();
  await axe(driver.page);
  await sql`update driver_profiles set status = 'approved' where user_id = ${d.user_id}`;
  driver.check();
});
