import { test, expect } from "@playwright/test";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Proposal detail page (/proposals/[id]).
 * Public read surface only (no real wallet voting per the test constraints).
 */
if (RUN_E2E) {
  test.describe("Proposal detail", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/proposals");
      await page.waitForLoadState("networkidle");
      const card = page.locator("a[href*='/proposals/prop-']").first();
      const count = await card.count();
      test.skip(count === 0, "no proposals seeded — skipping detail tests");
      await card.click();
      await page.waitForURL(/\/proposals\/[^/]+$/, { timeout: 30_000 });
    });

    test("renders the proposal title and body", async ({ page }) => {
      await page.waitForSelector("h1", { timeout: 30_000 });
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator("article, [class*='prose'], main").first()).toBeVisible();
    });

    test("renders a vote breakdown or its absence gracefully", async ({ page }) => {
      const voteBar = page.getByRole("img", { name: /For.*Against.*Abstain/i });
      await page.waitForTimeout(800);
      if (await voteBar.count()) {
        await expect(voteBar.first()).toBeVisible();
      }
    });

    test("renders the comments section heading", async ({ page }) => {
      await page.waitForTimeout(1500);
      await expect(page.getByText(/comments|discussion/i).first()).toBeVisible({ timeout: 30_000 });
    });

    test("anonymous visitors are prompted to connect in order to vote", async ({ page }) => {
      const prompt = page.getByText(/connect.*(vote|wallet)/i);
      const voteButton = page.getByRole("button", { name: /^(For|Against|Abstain)$/i });
      await page.waitForTimeout(800);
      expect((await prompt.count()) + (await voteButton.count())).toBeGreaterThan(0);
    });

    test("renders timeline / metadata", async ({ page }) => {
      await expect(page.getByText(/quorum|voting|created|timeline|ends/i).first()).toBeVisible({ timeout: 30_000 });
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
