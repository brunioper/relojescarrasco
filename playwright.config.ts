import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for Relojes Carrasco.
 *
 * Requires a running local stack:
 *   1. supabase start && supabase db reset   (DB with seed data)
 *   2. Copy .env.example -> .env.local with local Supabase credentials
 *
 * The web server is started automatically by Playwright.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "es-UY",
    timezoneId: "America/Montevideo",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
