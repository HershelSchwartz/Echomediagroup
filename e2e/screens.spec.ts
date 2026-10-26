import { test, expect, signIn, axe } from "./helpers";

// Screenshots at the original's phone viewport for replica-diff, plus an axe pass on each.
const SHOTS: [string, string][] = [
  ["S05", "/ride"], ["S15", "/ride/activity"], ["S16", "/ride/wallet"], ["S17", "/ride/account"], ["S18", "/ride/help"],
];

test("clone screenshots and accessibility on rider screens", async ({ browser, users }) => {
  const u = await users();
  await signIn(u.page, "+15550000100");
  for (const [id, path] of SHOTS) {
    await u.page.goto(path);
    await u.page.waitForLoadState("networkidle");
    await axe(u.page);
    await u.page.screenshot({ path: `replica/clone-screens/${id}.png`, caret: "initial" });
  }
  await u.page.goto("/ride");
  await u.page.getByRole("button", { name: "Where to?" }).click();
  await u.page.screenshot({ path: "replica/clone-screens/S06.png", caret: "initial" });
  await u.page.getByRole("combobox", { name: "Drop-off" }).fill("Grand Central");
  await u.page.getByRole("option").filter({ hasText: "Grand Central" }).first().getByRole("button").click();
  await u.page.getByRole("radiogroup", { name: "Ride options" }).waitFor();
  await axe(u.page);
  await u.page.screenshot({ path: "replica/clone-screens/S07.png", caret: "initial" });
  await u.page.goto("/login");
  await u.page.screenshot({ path: "replica/clone-screens/S01.png", caret: "initial" });
  await u.page.goto("/design");
  await axe(u.page);
  await u.page.screenshot({ path: "replica/clone-screens/design.png", fullPage: true, caret: "initial" });
  u.check();
});
