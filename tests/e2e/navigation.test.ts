import { test, expect } from "@playwright/test";
import { dismissWalletDialog } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Site navigation (header, mobile nav, footer, protected routes).
 */
if (RUN_E2E) {
  test.describe("Navigation", () => {
    test("header nav links route to the correct pages", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Remove any blocking UI elements
      await dismissWalletDialog(page);

      await page.getByRole("link", { name: /^Proposals$/i }).first().click();
      await page.waitForURL(/\/proposals/, { timeout: 30_000 });
    });

    test("mobile nav is visible at mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/");
      await expect(page.getByRole("link", { name: /Proposals/i }).first()).toBeVisible();
    });

    test("footer is present", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("footer")).toBeVisible();
    });

    test("the Create nav link points at the proposal creation flow", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Remove any blocking UI elements
      await dismissWalletDialog(page);

      await page.locator("header").getByRole("link", { name: /^Create$/i }).first().click({ timeout: 30_000 });
      await page.waitForURL(/\/proposals\/create/, { timeout: 30_000 });
    });

    test("protected routes do not expose an authorized shell anonymously", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      const onDashboard = page.url().includes("/dashboard");
      if (onDashboard) {
        await expect(page.getByText(/connect|sign in|wallet/i).first()).toBeVisible();
      }
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
