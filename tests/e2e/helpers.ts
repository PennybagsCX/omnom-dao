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
  } catch {
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
    // The panel container is `fixed bottom-4 right-4 z-40` (dev-login-panel.tsx).
    // Match the position classes without pinning the z-index so this keeps
    // working if the layering tweaks again — a stale z-50 selector here once
    // made every hide call a silent no-op and the panel kept intercepting
    // clicks on the controls it overlaps.
    content: `.fixed.bottom-4.right-4 { display: none !important; }`,
  });
  await page.waitForTimeout(100);
}

/**
 * Auto-dismiss the ConnectWalletDialog whenever it appears.
 *
 * The dev-auth auto-connect chain can open the wallet dialog at any point
 * during a test. The one-shot dismissWalletDialog() races this: when the
 * dialog appears after its ~4s tolerance window (slow route compiles, slow
 * runners), the modal overlay silently intercepts every subsequent click —
 * vote buttons, proposal cards, wizard controls — until timeout.
 * addLocatorHandler() re-dismisses it each time it shows up, right before
 * any action it would block.
 *
 * Matched by accessible name so dialogs tests open on purpose (e.g. the
 * WYSIWYG link editor) are never dismissed.
 *
 * Register BEFORE the first page.goto() — handlers persist across
 * navigations but cannot retroactively cover an already-blocked page.
 */
export async function registerWalletDialogAutoDismiss(page: Page): Promise<void> {
  await page.addLocatorHandler(
    page.getByRole("dialog", { name: /connect your wallet/i }),
    async () => {
      await page.keyboard.press("Escape").catch(() => {});
      // Escape is Radix's default close; fall back to the X button in case
      // a phase ever swallows the keydown.
      await page
        .getByRole("button", { name: /^close$/i })
        .first()
        .click({ timeout: 2_000 })
        .catch(() => {});
    },
  );
}


/**
 * Block until the app's client JS is live (hydrated) and authenticated.
 *
 * Filling inputs right after domcontentloaded races React hydration: the
 * input event fires before listeners exist, then hydration re-renders the
 * controlled input with its initial (empty) state and WIPES the value — no
 * debounce, no query, "element(s) not found" for the results. On 2-core CI
 * runners hydration takes seconds; locally it always wins the race, which
 * is why the failure never reproduced.
 *
 * The header wallet affordance is the gate: the connected address (0x…)
 * only renders after client JS resolves the session — it cannot exist in
 * SSR output. Requires the authenticated fixture (or dev-auth) so the
 * address form appears.
 */
export async function awaitAppHydration(page: Page): Promise<void> {
  await expect(
    page
      .locator("header button, header a")
      .filter({ hasText: /0x[0-9a-f]|connect\s*wallet/i })
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}
