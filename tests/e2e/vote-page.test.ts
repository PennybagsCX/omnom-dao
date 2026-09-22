import { test, expect } from "./auth.fixture";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  registerWalletDialogAutoDismiss,
} from "./helpers";

/** Standard preamble: auto-dismiss the wallet dialog + hide the dev-auth panel
 *  (it overlaps the mobile bottom nav and intercepts clicks there). */
async function openAnonymously(page: import("@playwright/test").Page, url: string) {
  await registerWalletDialogAutoDismiss(page);
  await page.goto(url);
  await page.waitForLoadState("domcontentloaded");
  await dismissWalletDialog(page);
  await hideDevAuthPanel(page);
}

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Voting hub (/vote).
 *
 * Covers the live-vote hero (with embedded cast-vote controls), the
 * past-votes dropdown archive (FGE + finalized proposals), the nav flip,
 * and responsive layout. Anonymous tests use plain visibility assertions;
 * the embedded-voting test uses the authenticated fixture (dev-login as a
 * mock-snapshot wallet, so casts really land).
 */
if (RUN_E2E) {
  test.describe("Vote hub — anonymous", () => {
    test.beforeEach(async ({ page }) => {
      await openAnonymously(page, "/vote");
    });

    test("renders the live hero for the seeded quorum vote", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /^vote$/i, exact: true }),
      ).toBeVisible();
      const card = page.getByTestId("vote-live-card-prop-active-quorum-default");
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.getByText("Governance parameter: global default quorum")).toBeVisible();
      await expect(card.getByText("Active")).toBeVisible();
      await expect(card.locator('[data-testid="countdown-timer"]')).toBeVisible();
      await expect(card.getByText(/quorum required:/i)).toBeVisible();
    });

    test("embeds vote controls on the live card", async ({ page }) => {
      // Dev-auth e2e auto-logs-in as the dev wallet, so the card settles in
      // one of two states depending on where the auto-login race lands:
      // three choice buttons (authenticated) or the connect prompt (not yet).
      // The unauthenticated branch is pinned deterministically in
      // proposal-vote-actions.test.tsx.
      const card = page.getByTestId("vote-live-card-prop-active-quorum-default");
      await expect(card.getByTestId("proposal-vote-actions")).toBeVisible({
        timeout: 15_000,
      });
      const forButton = card.getByRole("button", { name: /^for$/i });
      const connectPrompt = card.getByText(/connect your wallet to vote/i);
      await expect(forButton.or(connectPrompt)).toBeVisible({ timeout: 30_000 });
      if ((await forButton.count()) > 0) {
        // Row-variant buttons carry the 44px mobile touch target.
        expect(await forButton.getAttribute("class")).toContain("min-h-11");
      }
    });

    test("past-votes dropdown defaults to the FGE with its final outcome", async ({
      page,
    }) => {
      await expect(page.getByTestId("past-votes-select")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Winning choice")).toBeVisible();
      await expect(page.getByText(/65\.7% of 35 ballots/)).toBeVisible();
      await expect(
        page.getByRole("link", { name: /view full details/i }),
      ).toHaveAttribute("href", "/governance-vote");
    });

    test("selecting a finalized proposal shows its outcome and detail link", async ({
      page,
    }) => {
      await page.getByTestId("past-votes-select").click({ timeout: 15_000 });
      await page
        .getByRole("option", { name: /fund community tooling grant/i })
        .click();
      await expect(page.getByTestId("past-votes-summary").getByText("Passed")).toBeVisible();
      await expect(
        page.getByRole("link", { name: /view full details/i }),
      ).toHaveAttribute("href", "/proposals/prop-passed-treasury-grant");
    });

    test("header nav Vote link routes to /vote", async ({ page }) => {
      await openAnonymously(page, "/");
      await page.locator("header").getByRole("link", { name: /^Vote$/i }).click();
      await expect(page).toHaveURL(/\/vote$/);
    });

    test("is responsive at mobile viewport with a bottom-tab Vote link", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openAnonymously(page, "/vote");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);

      await page
        .getByRole("navigation", { name: "Primary" })
        .getByRole("link", { name: /^Vote$/i })
        .click();
      await expect(page).toHaveURL(/\/vote$/);
      await expect(
        page
          .getByRole("navigation", { name: "Primary" })
          .getByRole("link", { name: /^Vote$/i }),
      ).toHaveAttribute("aria-current", "page");
    });
  });

  test.describe("Vote hub — embedded voting (authenticated)", () => {
    test.beforeEach(async ({ page, authenticated: _authenticated }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
    });

    test("cast a vote from /vote and see it reflected on the detail page", async ({
      page,
    }) => {
      const card = page.getByTestId("vote-live-card-prop-active-quorum-default");
      await expect(card).toBeVisible({ timeout: 15_000 });

      // Settle the client state FIRST: sampling before useProposalDetail /
      // useCurrentUser resolve makes hasExistingVote always false (myVote has
      // not loaded), so an already-voted run takes the cast path, gets 409'd,
      // and still goes green on the voted chip once the query lands — a false
      // green that never exercises the cast path.
      const votedChip = card.getByText(/you voted:/i);
      const castPrompt = card.getByText(/^cast your vote$/i);
      await expect(votedChip.or(castPrompt).first()).toBeVisible({ timeout: 30_000 });
      const hasExistingVote = (await votedChip.count()) > 0;

      const forButton = card.getByRole("button", { name: /^for$/i });
      const againstButton = card.getByRole("button", { name: /^against$/i });

      if (hasExistingVote) {
        await card.getByRole("button", { name: /change vote/i }).click();
        // Wait for the auth-gated enabled state: clicking before the me-query
        // settles dispatches on a re-rendering tree and silently drops the vote.
        await expect(againstButton).toBeEnabled({ timeout: 30_000 });
        await againstButton.click();
        // Cast-specific consequence: the chip must now read AGAINST.
        await expect(votedChip.first()).toHaveText(/against/i, { timeout: 15_000 });
      } else {
        await expect(forButton).toBeEnabled({ timeout: 30_000 });
        await forButton.click();
        await expect(votedChip.first()).toHaveText(/for/i, { timeout: 15_000 });
      }

      // Same code path as the detail page — the cast shows up there too.
      await page.goto("/proposals/prop-active-quorum-default");
      await expect(
        page.getByText(/your vote has been recorded|you voted:/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Vote hub — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
