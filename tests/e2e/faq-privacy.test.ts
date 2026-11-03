import { test, expect } from "@playwright/test";
import { dismissWalletDialog } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2 — Route smoke: /faq and /privacy.
 *
 * The only two pages with zero e2e coverage before this file (see
 * DOCS/NEXT-STEPS-2026-11.md coverage-gap note). Both are fully public,
 * static content pages — no wallet, no live vote state. Assertions target
 * structural anchors (headings, badges, section titles) rather than exact
 * copy, so copy edits don't flip the smoke red; only real render breakage
 * does.
 */
if (RUN_E2E) {
  test.describe("FAQ & Privacy route smoke", () => {
    test("/faq renders the Governance Guide with answerable questions", async ({
      page,
    }) => {
      await page.goto("/faq");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);

      await expect(
        page.getByRole("heading", { name: /Governance Guide & FAQ/i }),
      ).toBeVisible({ timeout: 30_000 });
      // Per-route metadata lives in src/app/faq/layout.tsx.
      await expect(page).toHaveTitle(/Frequently Asked Questions/i);
      // Question-count badge — proves FAQ_SECTIONS hydrate server-side.
      await expect(page.getByText(/\d+ questions answered/i)).toBeVisible();
      // First seeded section + one stable question render in the accordion.
      await expect(
        page.getByRole("heading", { name: /Getting Started/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/What is \$OMNOM DAO\?/i).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Still have questions\?/i }),
      ).toBeVisible();
    });

    test("/privacy renders the policy document", async ({ page }) => {
      await page.goto("/privacy");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);

      await expect(
        page.getByRole("heading", { name: /Privacy Policy/i }),
      ).toBeVisible({ timeout: 30_000 });
      // Effective-date line and at least one policy section body.
      await expect(page.getByText(/^Effective:/i)).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      // Adopted from the sibling lane's static-pages smoke: title metadata.
      await expect(page).toHaveTitle(/Privacy Policy/i);
    });

    test("both pages render their headings at mobile viewport (390×844)", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/faq");
      await dismissWalletDialog(page);
      await expect(
        page.getByRole("heading", { name: /Governance Guide & FAQ/i }),
      ).toBeVisible({ timeout: 30_000 });

      await page.goto("/privacy");
      await dismissWalletDialog(page);
      await expect(
        page.getByRole("heading", { name: /Privacy Policy/i }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] FAQ & Privacy smoke — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
