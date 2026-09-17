import { test, expect } from "@playwright/test";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Public governance results (/results).
 * Fully public server-rendered page: election outcome + finalized proposals.
 * No wallet required, no interactions — plain visibility assertions.
 */
if (RUN_E2E) {
  test.describe("Results page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/results");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders the page title and election section", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /governance results/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /foundational governance election/i }),
      ).toBeVisible();
      await expect(page.getByText("Ballots cast")).toBeVisible();
      await expect(page.getByText("Turnout", { exact: true })).toBeVisible();
    });

    test("shows a tally row for each of the four voting methods", async ({ page }) => {
      // Labels come from ELECTION_CHOICE_LABELS; the winner banner may repeat
      // one of them, so match the first occurrence.
      for (const label of [
        "Quadratic voting",
        "One wallet, one vote",
        "Tiered voting",
        "Linear token voting",
      ]) {
        await expect(page.getByText(label).first()).toBeVisible();
      }
    });

    test("shows finalized proposal outcomes or the empty state", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /proposal outcomes/i }),
      ).toBeVisible();
      // Prod currently has zero finalized proposals — accept either the
      // empty state or real outcome rows so the spec survives seeding.
      await expect(
        page
          .getByText(/no finalized proposals yet/i)
          .or(page.getByTestId("results-proposal-row").first()),
      ).toBeVisible();
    });

    test("links to the full election view", async ({ page }) => {
      await expect(
        page.getByRole("link", { name: /view the full election/i }),
      ).toBeVisible();
    });

    test("header nav exposes a Results link", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.locator("header").getByRole("link", { name: /^Results$/i }),
      ).toBeVisible();
    });

    test("is responsive at mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/results");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Results page — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
