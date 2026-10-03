import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Uncaught errors on the page, except network failures reaching Supabase
// (the check shouldn't fail because supabase.co had a blip) and React's
// hydration warning #418: Cloudflare, in front of the site, rewrites email
// addresses in the HTML (Email Address Obfuscation), so /privacy's email
// differs from what React renders. React recovers on its own.
function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (/supabase\.co|failed to fetch|networkerror|load failed|react error #418/i.test(`${error.message} ${error.stack ?? ""}`)) return;
    errors.push(error.message);
  });
  return errors;
}

// Accessibility (axe), light and dark: no serious or critical problems.
async function expectAccessible(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  }
}

// In the browser, not Playwright's request client: Cloudflare turns away
// requests that don't come from a browser (403).
test("home sends a logged-out visitor to /login, not the maintenance page", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "commit" });
  expect(response?.status()).toBe(200); // the maintenance page is a 503
  expect(new URL(response!.url()).pathname).toBe("/login");
});

test("the login page loads", async ({ page }) => {
  const errors = pageErrors(page);
  // ?error keeps it here: on the live site /login otherwise moves on to the shared login page.
  const response = await page.goto("/login?error=smoke");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  expect(errors).toEqual([]);
  await expectAccessible(page);
});

test("the privacy page loads with the brand", async ({ page }) => {
  const errors = pageErrors(page);
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Portuguese with Trevor").first()).toBeVisible();
  expect(errors).toEqual([]);
  await expectAccessible(page);
});
