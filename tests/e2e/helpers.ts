/**
 * Shared E2E test helpers.
 *
 * Provides proper UI dismissal without DOM surgery (which breaks React's
 * synthetic event system). The old "removeConnectWalletDialog" approach
 * removed DOM nodes out from under React, causing force-clicks on Next <Link>
 * to silently no-op.
 */

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Dismiss the ConnectWalletDialog that auto-opens in dev-auth E2E mode.
 *
 * This dialog appears when the dev-auth auto-connect chain runs
 * (AutoDevAuthTrigger → devLogin → autoConnect → siwe-auth-flow open effect).
 *
 * The helper clicks real dialog affordances (X button, Escape, overlay)
 * instead of removing DOM. It never clicks "Continue" — that button
 * navigates to /verify/result and would break test navigation assertions.
 *
 * Tolerates dialog absence: if no dialog appears within ~4s, returns
 * silently. Call this after page.goto() in tests that might race the dialog.
 *
 * @example
 * await page.goto("/");
 * await dismissWalletDialog(page);
 * await expect(page.getByRole("link", { name: /view proposals/i })).toBeVisible();
 */
export async function dismissWalletDialog(page: Page): Promise<void> {
  try {
    // Wait up to ~4s for the dialog to appear (tolerate absence)
    const dialog = page.getByRole("dialog");

    try {
      await dialog.waitFor({ state: "attached", timeout: 4000 });
    } catch {
      // No dialog appeared — common case when session cookie is already set
      return;
    }

    // Dismiss via real affordances in order of preference:
    // 1. X button (sr-only "Close" label, present on every phase)
    // 2. Escape key (Radix default)
    // 3. Overlay click (Radix onPointerDownOutside default)
    //
    // Never click "Continue" — it navigates to /verify/result and would
    // break the test's own navigation expectations.
    const closeButton = page.getByRole("button", { name: /^close$/i });
    if (await closeButton.count() > 0) {
      await closeButton.first().click();
      await page.waitForTimeout(200);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // Confirm dialog is gone
    await expect(dialog).toHaveCount(0, { timeout: 2000 });
  } catch (_e) {
    // Dismissal failed — log and continue (most assertions don't depend on it)
    console.log("Note: Dialog dismissal failed or dialog already gone");
  }
}

/**
 * Hide the Dev Auth Panel via CSS (no DOM removal).
 *
 * The Dev Auth Panel (dev-login-panel.tsx) is a fixed bottom-right card
 * (z-50) that auto-mounts in dev-auth mode. On mobile viewports it can
 * overlap the MobileVoteBar's Change button and intercept clicks.
 *
 * This helper hides it with a style tag — React tree untouched, no
 * synthetic event breakage. Desktop tests generally don't need it.
 *
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await page.goto("/proposals");
 *   await dismissWalletDialog(page);
 *   await hideDevAuthPanel(page); // Mobile-specific
 * });
 */
export async function hideDevAuthPanel(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `.fixed.bottom-4.right-4.z-50 { display: none !important; }`,
  });
  await page.waitForTimeout(100);
}
