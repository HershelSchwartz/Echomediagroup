import { test, expect, axe } from "./helpers";

test("landing, privacy and terms are public, accessible and branded", async ({ users }) => {
  const { page, check } = await users({ geo: false });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The price you see is the price you pay");
  await expect(page.getByRole("table")).toContainText("Standard");
  await expect(page).toHaveTitle(/Plainfare/);
  await axe(page);
  await page.screenshot({ path: "replica/clone-screens/landing.png", fullPage: true, caret: "initial" });
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await axe(page);
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await axe(page);
  check();
});
