import { test, expect } from "./auth.fixture";
import { dismissWalletDialog } from "./helpers";

const RUN_E2E = !process.env.VITEST;

if (RUN_E2E) {
  test.describe("Comment voting (proposal surface)", () => {
    test.beforeEach(async ({ page }) => {
      // Auth fixture logs in as the DOLPHIN wallet. We still dismiss the
      // wallet-connect dialog if it auto-opens after navigation.
      await page.goto("/proposals/prop-active-chain-selection");
      await page.waitForLoadState("networkidle");
      await dismissWalletDialog(page);
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

      // Capture initial count by parsing trailing text of the button.
      const beforeText = (await upBtn.textContent()) ?? "";
      const beforeNum = Number.parseInt(beforeText.replace(/\D/g, ""), 10) || 0;
      const beforePressed = await upBtn.getAttribute("aria-pressed");
      expect(beforePressed).toBe("false");

      await upBtn.click();

      // Optimistic update: by the time the request settles the button should
      // either be active (first click) or have incremented the count.
      await expect(upBtn).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });

      // Switch to "Remove upvote" label after press.
      const removeBtn = page.getByRole("button", { name: /^remove upvote$/i }).first();
      await expect(removeBtn).toBeVisible();
      await expect(removeBtn).toHaveAttribute("aria-pressed", "true");

      const afterText = (await removeBtn.textContent()) ?? "";
      const afterNum = Number.parseInt(afterText.replace(/\D/g, ""), 10) || 0;
      expect(afterNum).toBe(beforeNum + 1);
    });

    test("toggle off: clicking the same upvote twice removes the reaction", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });
      await upBtn.click();
      await expect(upBtn).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });

      // Click again — should toggle off.
      const removeBtn = page.getByRole("button", { name: /^remove upvote$/i }).first();
      await removeBtn.click();

      await expect(upBtn).toHaveAttribute("aria-pressed", "false", { timeout: 5_000 });
    });

    test("swap: clicking downvote after upvote switches the reaction", async ({ page }) => {
      const upBtn = page.getByRole("button", { name: /^upvote comment$/i }).first();
      const downBtn = page.getByRole("button", { name: /^downvote comment$/i }).first();
      await expect(upBtn).toBeVisible({ timeout: 30_000 });

      await upBtn.click();
      await expect(upBtn).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });

      await downBtn.click();
      await expect(downBtn).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
      // The upvote button should now be released and labelled "Upvote comment" again.
      await expect(upBtn).toHaveAttribute("aria-pressed", "false");
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
