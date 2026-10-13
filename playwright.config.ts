import { defineConfig, devices } from "@playwright/test";

// The smoke check (.github/workflows/smoke.yml): a few pages of the live site
// after each deploy. SMOKE_URL points it elsewhere, e.g. a local `next start`.
export default defineConfig({
  testDir: "e2e",
  retries: 1,
  use: {
    baseURL: process.env.SMOKE_URL || "https://schedule.englishandportuguesewithtrevor.com",
    ...devices["Desktop Chrome"],
  },
});
