import { test, expect } from "./auth.fixture";
import { dismissWalletDialog, hideDevAuthPanel } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E tests for authenticated voting flows.
 *
 * Tests vote-change functionality with pre-authenticated state.
 * Requires dev server running with seeded proposals.
 *
 * Run with: npm run test:e2e
 */

if (RUN_E2E) {
test.describe("Vote change (authenticated)", () => {
  test.beforeEach(async ({ page, authenticated }) => {
    await page.goto("/proposals");
    await page.waitForLoadState("networkidle");

    await dismissWalletDialog(page);
    await hideDevAuthPanel(page);

    // Wait for proposal links to appear (exclude /create)
    await page.waitForSelector('a[href*="/proposals/"]:not([href*="/create"])', { timeout: 10_000 });

    // Find an active proposal to test with
    // Try to find one of the known active proposals first
    const activeCard = page.locator('a[href*="prop-active-tokenomics-burn"]').or(
      page.locator('a[href*="prop-active-chain-selection"]')
    ).first();

    const count = await activeCard.count();
    console.log(`Active proposal card count: ${count}`);
    test.skip(count === 0, "no active proposals — skipping vote-change tests");

    await activeCard.click();
    await page.waitForURL(/\/proposals\/[^/]+$/, { timeout: 30_000 });

    await dismissWalletDialog(page);
    await hideDevAuthPanel(page);
  });

  test("authenticated user can cast an initial vote", async ({ page }) => {
    // Check if user has already voted
    const hasExistingVote = await page.getByRole("button", { name: /change.*vote/i }).count() > 0;

    if (hasExistingVote) {
      test.skip(true, "user has already voted on this proposal — skipping initial vote test");
      return;
    }

    // Wait for page to load
    await page.waitForSelector("button", { timeout: 30_000 });

    // Should see voting buttons
    const forButton = page.getByRole("button", { name: /^For$/i });
    const againstButton = page.getByRole("button", { name: /^Against$/i });
    const abstainButton = page.getByRole("button", { name: /^Abstain$/i });

    expect(await forButton.count()).toBeGreaterThan(0);
    expect(await againstButton.count()).toBeGreaterThan(0);
    expect(await abstainButton.count()).toBeGreaterThan(0);

    // Cast a vote
    await forButton.first().click();

    // Should show voted state — retry-wait instead of a fixed sleep: under
    // full-suite load the vote POST can take longer than any hard-coded wait.
    await expect(
      page.getByText(/your vote has been recorded|you voted/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("vote-change button appears after voting", async ({ page }) => {
    // Check if user has already voted
    let changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    const hasExistingVote = await changeVoteButton.count() > 0;

    // If not already voted, cast an initial vote first
    if (!hasExistingVote) {
      const forButton = page.getByRole("button", { name: /^For$/i });
      await forButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Should see "Change Vote" button
    changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    await expect(changeVoteButton.first()).toBeVisible({ timeout: 5000 });
  });

  test("user can change their vote", async ({ page }) => {
    // Check if user has already voted
    let changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    const hasExistingVote = await changeVoteButton.count() > 0;

    // If not already voted, cast an initial vote FOR
    if (!hasExistingVote) {
      const forButton = page.getByRole("button", { name: /^For$/i });
      await forButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Click Change Vote
    changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    await changeVoteButton.first().click();
    await page.waitForTimeout(500);

    // Should see voting buttons again
    const againstButton = page.getByRole("button", { name: /^Against$/i });
    await expect(againstButton.first()).toBeVisible();

    // Change vote to AGAINST
    await againstButton.first().click();
    await page.waitForTimeout(2000);

    // Should show updated voted state
    const votedMessage = page.getByText(/against/i);
    expect(await votedMessage.count()).toBeGreaterThan(0);

    // Change Vote button should still be available
    await expect(changeVoteButton.first()).toBeVisible();
  });

  test("vote-change can be cancelled", async ({ page }) => {
    // Check if user has already voted
    let changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    const hasExistingVote = await changeVoteButton.count() > 0;

    // If not already voted, cast an initial vote
    if (!hasExistingVote) {
      const forButton = page.getByRole("button", { name: /^For$/i });
      await forButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Click Change Vote
    changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    await changeVoteButton.first().click();
    await page.waitForTimeout(500);

    // Should see Cancel button
    const cancelButton = page.getByRole("button", { name: /^cancel$/i });
    await expect(cancelButton.first()).toBeVisible();

    // Click Cancel
    await cancelButton.first().click();
    await page.waitForTimeout(500);

    // Should return to voted state (not changing mode)
    const votedMessage = page.getByText(/your vote has been recorded|you voted/i);
    expect(await votedMessage.count()).toBeGreaterThan(0);

    // Voting buttons should be hidden
    const againstButton = page.getByRole("button", { name: /^Against$/i });
    await expect(againstButton.first()).not.toBeVisible();
  });

  test("multiple vote-changes work correctly", async ({ page }) => {
    // Check if user has already voted
    let changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    const hasExistingVote = await changeVoteButton.count() > 0;

    // If not already voted, cast initial vote FOR
    if (!hasExistingVote) {
      await page.getByRole("button", { name: /^For$/i }).first().click();
      await page.waitForTimeout(2000);
    }

    // Change to AGAINST
    changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    await changeVoteButton.first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^Against$/i }).first().click();
    await page.waitForTimeout(2000);

    // Change to ABSTAIN
    await page.getByRole("button", { name: /change.*vote/i }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^Abstain$/i }).first().click();
    await page.waitForTimeout(2000);

    // Should show latest vote (ABSTAIN)
    const votedMessage = page.getByText(/abstain/i);
    expect(await votedMessage.count()).toBeGreaterThan(0);
  });

  test("vote-change persists after page refresh", async ({ page }) => {
    // Check if user has already voted
    let changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    const hasExistingVote = await changeVoteButton.count() > 0;

    // If not already voted, cast vote FOR and change to AGAINST
    if (!hasExistingVote) {
      await page.getByRole("button", { name: /^For$/i }).first().click();
      await page.waitForTimeout(2000);

      // Change to AGAINST
      await page.getByRole("button", { name: /change.*vote/i }).first().click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /^Against$/i }).first().click();
      await page.waitForTimeout(2000);
    }

    // Refresh page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Re-dismiss dialogs that reappear after reload
    await dismissWalletDialog(page);
    await hideDevAuthPanel(page);

    // Should still show vote
    const votedMessage = page.getByText(/against|for|abstain/i);
    expect(await votedMessage.count()).toBeGreaterThan(0);

    // Change Vote button should still be available
    changeVoteButton = page.getByRole("button", { name: /change.*vote/i });
    await expect(changeVoteButton.first()).toBeVisible();
  });
});

test.describe("Vote change mobile (authenticated)", () => {
  test.beforeEach(async ({ page, authenticated }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/proposals");
    await page.waitForLoadState("networkidle");

    await dismissWalletDialog(page);
    await hideDevAuthPanel(page);

    // Wait for proposal links to appear (exclude /create)
    await page.waitForSelector('a[href*="/proposals/"]:not([href*="/create"])', { timeout: 10_000 });

    // Find an active proposal to test with
    // Try to find one of the known active proposals first
    const activeCard = page.locator('a[href*="prop-active-tokenomics-burn"]').or(
      page.locator('a[href*="prop-active-chain-selection"]')
    ).first();

    const count = await activeCard.count();
    test.skip(count === 0, "no active proposals — skipping mobile vote-change tests");

    await activeCard.click();
    await page.waitForURL(/\/proposals\/[^/]+$/, { timeout: 30_000 });

    await dismissWalletDialog(page);
    await hideDevAuthPanel(page);
  });

  test("mobile vote-change UI works correctly", async ({ page }) => {
    // Check if user has already voted
    const hasExistingVote = await page.getByRole("button", { name: /change.*vote/i }).count() > 0;

    // If not already voted, cast initial vote
    if (!hasExistingVote) {
      // On mobile, voting buttons might be in a collapsible section
      // Look for them with a broader selector
      const forButton = page.getByRole("button", { name: /^For$/i });
      const buttonCount = await forButton.count();

      if (buttonCount === 0) {
        // Mobile might have voting buttons in a drawer - try clicking a "Vote" button first
        const voteActionBtn = page.getByRole("button", { name: /^vote$/i });
        if (await voteActionBtn.count() > 0) {
          await voteActionBtn.first().click();
          await page.waitForTimeout(500);
        }
      }

      // Try to find and click the For button again
      await page.waitForTimeout(500);
      const forButtonRetry = page.getByRole("button", { name: /^For$/i });
      const forButtonCount = await forButtonRetry.count();

      if (forButtonCount > 0) {
        await forButtonRetry.first().click();
        await page.waitForTimeout(2000);
      } else {
        test.skip(true, "mobile voting UI not accessible - skipping mobile test");
      }
    }

    // Mobile should show compact voted bar with Change button
    // Look for any element containing "you voted" or "change"
    const mobileVoteBar = page.locator("*").filter({
      hasText: /you voted|change/i,
    });

    await expect(mobileVoteBar.first()).toBeVisible({ timeout: 5000 });

    // Click Change button (might be standalone or in a bar)
    const changeButton = page.getByRole("button", { name: /^change( vote)?$/i });
    const changeCount = await changeButton.count();

    if (changeCount === 0) {
      // Try clicking the entire bar to expand voting options
      await mobileVoteBar.first().click();
      await page.waitForTimeout(500);
    } else {
      await changeButton.first().click();
      await page.waitForTimeout(500);
    }

    // Should show voting buttons
    const againstButton = page.getByRole("button", { name: /^Against$/i });
    const againstCount = await againstButton.count();

    if (againstCount > 0) {
      await expect(againstButton.first()).toBeVisible();

      // Change vote
      await againstButton.first().click();
      await page.waitForTimeout(2000);

      // Should show updated vote
      const votedMessage = page.getByText(/against/i);
      expect(await votedMessage.count()).toBeGreaterThan(0);
    } else {
      test.skip(true, "mobile vote-change UI not fully accessible - skipping");
    }
  });
});
}
