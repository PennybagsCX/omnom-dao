import { test, expect } from "./auth.fixture";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  registerWalletDialogAutoDismiss,
} from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Voting hub (/vote), governance-vote-style single-vote page.
 *
 * The page shows ONE current vote (the most recently opened ACTIVE proposal —
 * the seeded Wave-1 quorum vote) in the FGE page's design language: hero
 * countdown, gold stats grid, cast-vote ballot, current results. Past votes
 * are rows linking to their dedicated pages (/governance-vote,
 * /proposals/[id]). Anonymous tests tolerate the dev-auth auto-login race;
 * the embedded-voting test uses the authenticated fixture.
 */
if (RUN_E2E) {
  test.describe("Vote hub — anonymous", () => {
    test.beforeEach(async ({ page }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
    });

    test("renders the current vote as the page hero", async ({ page }) => {
      await expect(
        page.getByRole("heading", {
          name: "Governance parameter: global default quorum",
        }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Active").first()).toBeVisible();
      await expect(page.locator('[data-testid="countdown-timer"]')).toBeVisible();
      // FGE-style gold stats grid.
      await expect(page.getByText("Voting power voted")).toBeVisible();
      await expect(page.getByText("Turnout", { exact: true })).toBeVisible();
      await expect(page.getByText("Quorum required")).toBeVisible();
      await expect(page.getByText(/voting closes/i).first()).toBeVisible();
    });

    test("shows only ONE vote — other live proposals stay on /proposals", async ({
      page,
    }) => {
      await expect(
        page.getByRole("heading", { name: /deflationary transaction burn/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: /chain migration/i }),
      ).toHaveCount(0);
      // The other live votes remain reachable.
      await expect(page.getByText(/more proposals are voting/i)).toBeVisible();
    });

    test("cast-vote ballot renders with connect prompt or choice buttons", async ({
      page,
    }) => {
      const panel = page.getByTestId("proposal-vote-panel");
      await expect(panel).toBeVisible({ timeout: 15_000 });
      const forButton = panel.getByRole("button", { name: /^for$/i });
      const connectPrompt = panel.getByText(/connect to vote/i);
      // Dev-auth e2e auto-logs-in, so the settled state is usually the
      // ballot; the connect branch is pinned in the component tests.
      await expect(forButton.or(connectPrompt).first()).toBeVisible({ timeout: 30_000 });
    });

    test("current results section renders the live tally", async ({ page }) => {
      const results = page.getByTestId("proposal-vote-results");
      await expect(
        page.getByRole("heading", { name: /current results/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(results.getByRole("img")).toBeVisible();
      await expect(
        results.getByText("Quorum", { exact: true }).first(),
      ).toBeVisible();
      await expect(results.getByRole("progressbar")).toBeVisible();
    });

    test("past votes link to their dedicated pages", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /past votes/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("past-vote-fge")).toHaveAttribute(
        "href",
        "/governance-vote",
      );
      await expect(
        page.getByTestId("past-vote-prop-passed-treasury-grant"),
      ).toHaveAttribute("href", "/proposals/prop-passed-treasury-grant");
      await expect(
        page.getByRole("link", { name: /browse the full outcomes archive/i }),
      ).toHaveAttribute("href", "/results");
    });

    test("header nav Vote link routes to /vote", async ({ page }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/");
      await dismissWalletDialog(page);
      await page.locator("header").getByRole("link", { name: /^Vote$/i }).click();
      await expect(page).toHaveURL(/\/vote$/);
    });

    test("is responsive at mobile viewport with a bottom-tab Vote link", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
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
      const panel = page.getByTestId("proposal-vote-panel");
      await expect(panel).toBeVisible({ timeout: 15_000 });

      // Settle the client state FIRST: sampling before useProposalDetail /
      // useCurrentUser resolve makes hasExistingVote always false (myVote has
      // not loaded), so an already-voted run takes the cast path, gets 409'd,
      // and still goes green on the voted chip once the query lands — a false
      // green that never exercises the cast path. Settled states: buttons
      // (unvoted) or the voted chip.
      const votedChip = panel.getByText(/you voted:/i);
      const forButton = panel.getByRole("button", { name: /^for$/i });
      await expect(votedChip.or(forButton).first()).toBeVisible({ timeout: 30_000 });

      const againstButton = panel.getByRole("button", { name: /^against$/i });
      const hasExistingVote = (await votedChip.count()) > 0;

      if (hasExistingVote) {
        await panel.getByRole("button", { name: /change vote/i }).click();
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
