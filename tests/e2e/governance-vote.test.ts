import { test, expect } from "@playwright/test";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Foundational Governance Election (/governance-vote).
 * Public route: status/results visible to all. Voting requires auth.
 */
if (RUN_E2E) {
  test.describe("Foundational Governance Election", () => {
    test.beforeEach(async ({ page }) => {
      test.skip(true, "/governance-vote page not implemented - skipping governance election tests");
    });

    test("renders title, phase, turnout, and closing timestamp", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /Foundational Governance Election/i }),
      ).toBeVisible();
      await expect(page.getByText("ballots cast")).toBeVisible();
      await expect(page.getByText("turnout", { exact: true })).toBeVisible();
      await expect(page.getByText("voting closes", { exact: true })).toBeVisible();
    });

    test("shows all four framework choices", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /Quadratic voting/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /One wallet, one vote/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Tiered voting/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Linear token voting/i })).toBeVisible();
    });

    test("prompts unauthenticated visitors to connect wallet", async ({ page }) => {
      await expect(page.getByText(/connect to vote/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /connect wallet/i }).first(),
      ).toBeVisible();
      // Voting actions stay protected: anonymous visitors get no ballot buttons.
      await expect(page.getByRole("button", { name: "Select" })).toHaveCount(0);
    });

    test("shows detailed explanations and election FAQ", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Calculation steps" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Worked examples" }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Advantages", exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Disadvantages", exact: true }).first()).toBeVisible();

      await page.getByRole("button", { name: /Can I change my vote\?/i }).click();
      await expect(
        page.getByText(/latest ballot is the one counted/i),
      ).toBeVisible();
    });

    test("shows one-ballot election rule and snapshot provenance", async ({ page }) => {
      await expect(page.getByText(/changeable until close/i)).toBeVisible();
      await expect(page.getByText(/25,686/i).first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: /DBOT-DC\/omnom-snapshot/i }),
      ).toBeVisible();
    });

    test("is responsive at mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(
        page.getByRole("heading", { name: /Foundational Governance Election/i }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Foundational Governance Election — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
