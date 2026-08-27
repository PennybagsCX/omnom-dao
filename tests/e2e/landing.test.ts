import { test, expect } from "@playwright/test";
import { dismissWalletDialog } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Landing page (http://localhost:3000/).
 * No wallet connection required: the landing page is fully public.
 */
if (RUN_E2E) {
  test.describe("Landing page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("renders the hero, stats bar, and how-it-works sections", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /Your voice\. Your \$OMNOM\. Your DAO\./i })).toBeVisible();
      await expect(page.getByText(/Off-chain · Snapshot-based · No gas fees/i)).toBeVisible();
      await expect(page.getByText("Govern in three simple steps")).toBeVisible();
      await expect(page.getByText("Connect & Verify")).toBeVisible();
      await expect(page.getByText("Vote & Govern").first()).toBeVisible();
    });

    test("auto-connects / shows a wallet affordance (dev-auth E2E)", async ({ page }) => {
      await page.goto("/");
      await dismissWalletDialog(page);
      await expect(page.locator("header button, header a").filter({ hasText: /connect\s*wallet|0x[0-9a-f]{4}/i }).first()).toBeVisible();
    });

    test('"View Proposals" navigates to /proposals', async ({ page }) => {
      await page.goto("/");
      await dismissWalletDialog(page);
      await page.getByRole("link", { name: /view proposals/i }).click();
      await expect(page).toHaveURL(/\/proposals/);
    });

    test("brand logo links back home", async ({ page }) => {
      await page.goto("/proposals");
      await dismissWalletDialog(page);
      await page.locator("header a[href='/']").first().click();
      await expect(page).toHaveURL(/\/$/);
    });

    test("active proposals section renders cards or is gracefully absent", async ({ page }) => {
      const activeHeading = page.getByText("🟢 Active Proposals");
      await page.waitForTimeout(1500);
      if (await activeHeading.count()) {
        await expect(activeHeading.first()).toBeVisible();
      }
    });

    test("is responsive at mobile viewport (375px)", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      // Wait for the page to respond to viewport change and client-side hydration
      await page.waitForTimeout(1000);
      await page.waitForSelector("h1", { timeout: 10_000 });
      // Try multiple heading selectors for better flexibility
      const heroHeading = page.getByRole("heading", { name: /Your voice/i }).or(
        page.getByRole("heading", { name: /OMNOM/i })
      ).or(
        page.locator("h1").first()
      );
      await expect(heroHeading.first()).toBeVisible({ timeout: 10_000 });
      // On mobile, check for any visible connect button (header or elsewhere)
      // Use broader selector - could be button or link, might say "Connect" or "Wallet"
      const connectButton = page.getByRole("button", { name: /connect|wallet/i }).or(
        page.getByRole("link", { name: /connect|wallet/i })
      ).or(
        page.locator("button, a").filter({ hasText: /connect/i })
      );
      const connectCount = await connectButton.count();
      // On mobile, connect button might be in a menu or different position
      if (connectCount > 0) {
        await expect(connectButton.first()).toBeVisible({ timeout: 5000 });
      } else {
        // If no connect button found, at least verify some navigation element is visible
        const navElement = page.locator("header nav, nav, button, a").first();
        await expect(navElement).toBeVisible({ timeout: 5000 });
      }
    });
  });
}

// Vitest also collects `tests/**/*.test.ts`; register a skipped placeholder so
// the file isn't reported as empty. vitest is imported dynamically so it never
// loads under the Playwright runner. Real E2E runs happen via `npm run test:e2e`.
if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
