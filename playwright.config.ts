import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial execution: the dev server compiles routes on demand, and parallel
  // workers queue those compiles behind each other, which blows navigation
  // timeouts on first hit of a route.
  workers: 1,
  reporter: "line",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Enable dev auth for both anonymous and authenticated E2E tests.
    // Auth fixtures simulate logged-in state without interactive wallet flow.
    command: "NEXT_PUBLIC_ENABLE_DEV_AUTH=true npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
