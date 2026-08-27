import { test, expect } from "@playwright/test";
import { dismissWalletDialog } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Proposals list page (/proposals).
 * Public route. Filter-UI assertions are unconditional; card assertions guard
 * on seeded data.
 */
if (RUN_E2E) {
  test.describe("Proposals list", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/proposals");
      await page.waitForLoadState("networkidle");
      // Remove any blocking UI elements
      await dismissWalletDialog(page);
    });

    test("renders the status filter tabs", async ({ page }) => {
      // Wait for client-side hydration and tabs to appear
      await page.waitForSelector('[role="tab"]', { timeout: 10_000 });
      await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Passed" })).toBeVisible();
    });

    test("clicking the Active tab updates the URL status filter", async ({ page }) => {
      // Wait for client-side hydration and tabs to appear
      await page.waitForSelector('[role="tab"]', { timeout: 10_000 });
      await page.getByRole("tab", { name: "Active" }).click();
      await expect(page).toHaveURL(/status=ACTIVE/);
    });

    test("the type select offers the documented proposal types", async ({ page }) => {
      // Wait for client-side hydration and selects to appear
      await page.waitForSelector("[role='combobox']", { timeout: 10_000 });
      await page.locator("[role='combobox']").first().click();
      await expect(page.getByRole("option", { name: "Chain Selection" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Treasury" })).toBeVisible();
    });

    test("the sort dropdown offers Newest / Ending Soon options", async ({ page }) => {
      // Wait for client-side hydration and selects to appear
      await page.waitForSelector("[role='combobox']", { timeout: 10_000 });
      const sortTrigger = page.locator("[role='combobox']").last();
      await sortTrigger.click();
      await expect(page.getByRole("option", { name: "Newest" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Ending Soon" })).toBeVisible();
    });

    test("search input filters the visible proposals", async ({ page }) => {
      // Wait for client-side hydration and search input to appear
      await page.waitForSelector("input[placeholder*='search' i]", { timeout: 10_000 });
      const search = page.getByPlaceholder(/search/i);
      await expect(search).toBeVisible();
      await search.fill("zzz-no-such-proposal-xyz");
      await page.waitForTimeout(500);
      const cards = page.locator("a[href*='/proposals/']").filter({ hasNotText: /Create/i });
      await expect(cards).toHaveCount(0);
    });

    test("clicking a proposal card navigates to its detail page", async ({ page }) => {
      // Wait for client-side hydration and proposal cards to appear
      await page.waitForSelector("a[href*='/proposals/']", { timeout: 10_000 });
      const card = page.locator("a[href*='/proposals/']").filter({ hasNotText: /Create/i }).first();
      const count = await card.count();
      test.skip(count === 0, "no proposals seeded — skipping card navigation");
      await card.click();
      await expect(page).toHaveURL(/\/proposals\/[^/]+$/, { timeout: 30_000 });
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
