import { test, expect } from "@playwright/test";

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

    test("shows a visible Connect Wallet CTA for anonymous visitors", async ({ page }) => {
      await expect(page.getByRole("button", { name: /Connect Wallet/i }).first()).toBeVisible();
    });

    test('"View Proposals" navigates to /proposals', async ({ page }) => {
      const link = page.getByRole("link", { name: /View Proposals/i }).first();
      await link.click();
      await page.waitForURL(/\/proposals/, { timeout: 30_000 });
    });

    test("brand logo links back home", async ({ page }) => {
      await page.goto("/proposals");
      await page.getByRole("link", { name: /OMNOM.*DAO/i }).first().click();
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
      await expect(page.getByRole("heading", { name: /Your voice\. Your \$OMNOM\. Your DAO\./i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Connect Wallet/i }).first()).toBeVisible();
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
