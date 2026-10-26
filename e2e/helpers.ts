import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";

export const UNION_SQUARE = { latitude: 40.7359, longitude: -73.9911 };
export const sql = postgres(process.env.DATABASE_URL || "postgres://ride:ride@localhost:5432/ride", { onnotice: () => {} });

/** Fails the test on console errors and 5xx responses. */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`); });
  return () => expect(problems, problems.join("\n")).toEqual([]);
}

type NewUser = (opts?: { geo?: boolean }) => Promise<{ ctx: BrowserContext; page: Page; check: () => void }>;

/** `users()` opens a signed-out browser context; all are closed and drivers set offline after each test. */
export const test = base.extend<{ users: NewUser }>({
  users: async ({ browser }, use) => {
    const made: BrowserContext[] = [];
    await use(async (opts) => {
      const u = await newUser(browser, opts);
      made.push(u.ctx);
      return u;
    });
    for (const c of made) await c.close();
    await sql`update driver_profiles set online = false`;
    await sql`update trips set status = 'cancelled_by_rider', cancelled_at = now() where status in ('matching','accepted','arrived','in_progress')`;
  },
});
export { expect };

async function newUser(browser: Browser, opts: { geo?: boolean } = {}) {
  const ctx = await browser.newContext({
    geolocation: opts.geo === false ? undefined : UNION_SQUARE,
    permissions: opts.geo === false ? [] : ["geolocation"],
  });
  const page = await ctx.newPage();
  return { ctx, page, check: watch(page) };
}

// Session cookies per phone for this run: each phone signs in through the screens once,
// which keeps the run under the real per-phone code limit (5 an hour).
const sessions = new Map<string, Awaited<ReturnType<BrowserContext["cookies"]>>>();

/** Signs in through the real screens, reading the code from the development banner. */
export async function signIn(page: Page, phone: string, next = "/ride", name?: string) {
  const cached = sessions.get(phone);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto(next);
    return;
  }
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const banner = page.getByText(/Your code is/);
  await expect(banner).toBeVisible();
  const code = (await banner.locator("strong").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  if (name) {
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Done" }).click();
  }
  await page.waitForURL(`**${next}`);
  sessions.set(phone, (await page.context().cookies()).filter((c) => c.name === "sid"));
}

export async function axe(page: Page) {
  // Let client-side refreshes settle (the title is briefly empty mid-refresh).
  await expect(page).toHaveTitle(/\S/);
  await page.waitForLoadState("networkidle").catch(() => {});
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(bad, bad.join("\n")).toEqual([]);
}

export async function goOnline(page: Page) {
  await page.goto("/drive");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're online" })).toBeVisible();
}

export async function hold(page: Page, name: RegExp | string) {
  const b = page.getByRole("button", { name });
  await b.scrollIntoViewIfNeeded();
  const box = (await b.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
}

export async function requestRide(page: Page, to = "Grand Central", product = "Standard") {
  await page.goto("/ride");
  await page.getByRole("button", { name: "Where to?" }).click();
  const drop = page.getByRole("combobox", { name: "Drop-off" });
  await drop.fill(to);
  await page.getByRole("option").filter({ hasText: to }).first().getByRole("button").click();
  await expect(page.getByRole("radiogroup", { name: "Ride options" })).toBeVisible();
  await page.getByRole("radio", { name: new RegExp(`^${product}`) }).click();
  await page.getByRole("button", { name: `Request ${product}` }).click();
}
