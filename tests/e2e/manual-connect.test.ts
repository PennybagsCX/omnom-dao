import { test, expect } from "@playwright/test";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Manual wallet connect flow (the fix for "I have to connect twice").
 *
 * Unlike the rest of the suite (which pre-mints sessions via the dev-login
 * fixture and auto-dismisses the wallet dialog), these tests drive the REAL
 * connect chain end-to-end:
 *
 *   header "Connect Wallet" → RainbowKit picker → injected mock wallet →
 *   siwe-auth-flow auto-open → nonce → personal_sign → verify.
 *
 * Isolation: the dev-login endpoint (api/v1/dev-login) is route-blocked so
 * AutoDevAuthTrigger's dev chain fails (devLogin throws → autoConnect never
 * runs) and the browser context starts anonymous with no persisted wagmi
 * connection.
 *
 * NOTE: do NOT register registerWalletDialogAutoDismiss here — the dialog
 * is the subject under test.
 */
if (RUN_E2E) {
  // In mock-DB mode the snapshot mock INCLUDES the anvil wallets, so the
  // real /api/v1/verify answers success for them. The happy-path test stubs
  // verify anyway, to keep the one-click assertion independent of snapshot
  // fixture drift; the pipeline test below exercises the real endpoints.
  const DOLPHIN = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
  const VERIFY_STUB = {
    success: true,
    data: {
      address: DOLPHIN,
      class: "DOLPHIN",
      balanceRaw: "50000000000000000000000000000",
      balanceFormatted: "50000000000",
      rank: 50,
      votingPower: 223606,
    },
  };

  async function isolateAnonymous(page: import("@playwright/test").Page) {
    await page.route("**/api/v1/dev-login", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "INTERNAL_ERROR", message: "blocked in test" },
        }),
      }),
    );
  }

  async function connectViaMockWallet(page: import("@playwright/test").Page) {
    // Exactly ONE click on the header CTA — the whole point of the fix.
    await expect(
      page
        .locator("header button")
        .filter({ hasText: /connect\s*wallet/i })
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .locator("header button")
      .filter({ hasText: /connect\s*wallet/i })
      .first()
      .click();

    // RainbowKit picker — the injected entry ("Browser Wallet") covers the
    // dev mock provider and every browser-extension hot wallet. Playwright
    // pierces AppKit's shadow DOM, which the a11y tree of headless tooling
    // otherwise hides.
    await page.getByRole("button", { name: /browser wallet/i }).first().click();
  }

  test.describe("Manual wallet connect", () => {
    test("one click: picker → mock wallet → auto-verify → success", async ({ page }) => {
      test.setTimeout(120_000);
      await isolateAnonymous(page);

      // Count nonce requests: a re-fired pipeline (the old double-run bug)
      // would overwrite the single-use nonce and show up here.
      let nonceCount = 0;
      await page.route("**/api/v1/nonce", async (route) => {
        nonceCount += 1;
        const response = await route.fetch();
        await route.fulfill({ response });
      });
      await page.route("**/api/v1/verify", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(VERIFY_STUB),
        }),
      );

      await page.goto("/");
      await connectViaMockWallet(page);

      // The SIWE dialog must auto-open and reach success with ZERO further
      // clicks — this is the regression assertion for the dead auto-open.
      await expect(page.getByText(/you're verified!/i)).toBeVisible({
        timeout: 30_000,
      });
      expect(nonceCount).toBe(1);
    });

    test("full server pipeline: real nonce → signature → verify succeeds end-to-end", async ({ page }) => {
      test.setTimeout(120_000);
      await isolateAnonymous(page);

      await page.goto("/");
      await connectViaMockWallet(page);

      // No verify stub: the mock snapshot includes the anvil wallets, so the
      // REAL endpoints run the whole pipeline — nonce → personal_sign →
      // verify → JWT cookie — and the dialog lands on success.
      await expect(page.getByText(/you're verified!/i)).toBeVisible({
        timeout: 30_000,
      });
    });
  });
}
