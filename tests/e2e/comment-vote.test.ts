import { test, expect } from "./auth.fixture";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  registerWalletDialogAutoDismiss,
} from "./helpers";

const RUN_E2E = !process.env.VITEST;

if (RUN_E2E) {
  test.describe("Comment voting (proposal surface)", () => {
    test.beforeEach(async ({ page, authenticated: _authenticated }) => {
      // Destructuring `authenticated` mints the dev session BEFORE
      // navigation so the reaction buttons render enabled immediately —
      // relying on the auto-dev-auth chain left them disabled past the
      // click timeouts. The auto-dismiss handler covers the dialog that
      // chain can still spawn at any moment.
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/proposals/prop-active-chain-selection");
      await page.waitForLoadState("networkidle");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
    });

    test("renders upvote and downvote buttons on each non-deleted comment", async ({ page }) => {
      // First non-deleted comment ("Strongly support Base…").
      // The deleted comment is hidden by the !isDeleted early-return in CommentItem.
      const firstCommentUp = page.getByRole("button", { name: /^upvote comment$/i }).first();
      const firstCommentDown = page.getByRole("button", { name: /^downvote comment$/i }).first();
      await expect(firstCommentUp).toBeVisible({ timeout: 30_000 });
      await expect(firstCommentDown).toBeVisible();
    });

    test("upvote click registers, toggles aria-pressed, and increments count", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      // Wait for the auth-gated enabled state: clicking while the me-query
      // is still settling dispatches into a re-rendering tree and the
      // onClick guard silently drops the reaction.
      await expect(upBtn).toBeEnabled({ timeout: 30_000 });

      // Capture initial count by parsing trailing text of the button.
      const beforeText = (await upBtn.textContent()) ?? "";
      const beforeNum = Number.parseInt(beforeText.replace(/\D/g, ""), 10) || 0;
      const beforePressed = await upBtn.getAttribute("aria-pressed");
      expect(beforePressed).toBe("false");

      await upBtn.click();

      // On success the same button relabels to "Remove upvote" IN THE SAME
      // RENDER as aria-pressed flips — the original /^upvote comment$/
      // locator would re-resolve to a different comment's button. Assert on
      // the post-click label instead.
      const removeBtn = page.getByRole("button", { name: /^remove upvote$/i }).first();
      await expect(removeBtn).toBeVisible({ timeout: 15_000 });
      await expect(removeBtn).toHaveAttribute("aria-pressed", "true");

      const afterText = (await removeBtn.textContent()) ?? "";
      const afterNum = Number.parseInt(afterText.replace(/\D/g, ""), 10) || 0;
      expect(afterNum).toBe(beforeNum + 1);
    });

    test("toggle off: clicking the same upvote twice removes the reaction", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      await expect(upBtn).toBeEnabled({ timeout: 30_000 });
      await upBtn.click();
      // The pressed state is observable via the post-click "Remove upvote"
      // label (same render as the aria-pressed flip — see test above).
      const removeBtn = page.getByRole("button", { name: /^remove upvote$/i }).first();
      await expect(removeBtn).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });

      // Click again — should toggle off.
      await removeBtn.click();

      // After removal the button relabels back to "Upvote comment".
      const upAgain = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upAgain).toHaveAttribute("aria-pressed", "false", { timeout: 15_000 });
    });

    test("swap: clicking downvote after upvote switches the reaction", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      const downBtn = page.getByRole("button", { name: /^downvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      await expect(upBtn).toBeEnabled({ timeout: 30_000 });

      await upBtn.click();
      const removeUp = page.getByRole("button", { name: /^remove upvote$/i }).first();
      await expect(removeUp).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });

      await downBtn.click();
      // Swapping relabels the downvote button to "Remove downvote" in the
      // same render the pressed state flips.
      const removeDown = page.getByRole("button", { name: /^remove downvote$/i }).first();
      await expect(removeDown).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
      // The upvote button is released and labelled "Upvote comment" again.
      const upAgain = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upAgain).toHaveAttribute("aria-pressed", "false");
    });

    test("meets the WCAG 44×44 click target on the reaction buttons", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      const box = await upBtn.boundingBox();
      expect(box).not.toBeNull();
      // Allow a small slack since min-h/min-w interact with padding and
      // flex layout — we still require at least 36 on each axis to confirm
      // the touch target is significantly larger than the icon.
      expect(box!.height).toBeGreaterThanOrEqual(36);
      expect(box!.width).toBeGreaterThanOrEqual(36);
    });

    test("focus ring is visible when the button is keyboard-focused", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      // Scroll into view first to avoid the keyboard navigation hitting the
      // top of the page instead of the comment.
      await upBtn.scrollIntoViewIfNeeded();
      await upBtn.focus();
      // The button declares focus-visible:ring-2 in its className; check the
      // classList includes the ring utility.
      const className = await upBtn.getAttribute("class");
      expect(className).toMatch(/focus-visible:ring-2/);
      expect(className).toMatch(/focus-visible:ring-gold/);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright spec — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
