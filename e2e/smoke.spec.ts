import { expect, test, type Page } from "@playwright/test";

// Uncaught errors on the page, except network failures reaching Supabase
// (the check shouldn't fail because supabase.co had a blip).
function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (/supabase\.co|failed to fetch|networkerror|load failed/i.test(`${error.message} ${error.stack ?? ""}`)) return;
    errors.push(error.message);
  });
  return errors;
}

test("home sends a logged-out visitor to /login, not the maintenance page", async ({ request }) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(307);
  expect(new URL(home.headers().location, "http://x").pathname).toBe("/login");

  const login = await request.get("/login");
  expect(login.status()).toBe(200);
  expect(await login.text()).not.toContain("updating the site");
});

test("the login page loads", async ({ page }) => {
  const errors = pageErrors(page);
  // ?error keeps it here: on the live site /login otherwise moves on to the shared login page.
  const response = await page.goto("/login?error=smoke");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the privacy page loads with the brand", async ({ page }) => {
  const errors = pageErrors(page);
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Portuguese with Trevor").first()).toBeVisible();
  expect(errors).toEqual([]);
});
