import { test, expect } from "./auth.fixture";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  hideReticleOverlay,
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
      await hideReticleOverlay(page);
    });

    test("renders the current vote as the page hero", async ({ page }) => {
      await expect(
        page.getByRole("heading", {
          name: "Governance parameter: global default quorum",
        }),
      ).toBeVisible({ timeout: 15_000 });
      // The title links to the full proposal page (owner fix).
      await expect(
        page.getByRole("link", {
          name: "Governance parameter: global default quorum",
        }),
      ).toHaveAttribute("href", "/proposals/prop-active-quorum-default");
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

    test("cast-vote ballot renders as FGE-style choice cards", async ({ page }) => {
      await expect(
        page.getByTestId("ballot-card-for"),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("ballot-card-against")).toBeVisible();
      await expect(page.getByTestId("ballot-card-abstain")).toBeVisible();
      // Settled ballot states: Select buttons (window open + authed),
      // the connect box (anonymous), or the opens-later notice (window
      // opens at noon Toronto). Each branch is pinned in component tests.
      const selectBtn = page.getByTestId("ballot-card-for").getByRole("button", { name: /^select$/i });
      const connectPrompt = page.getByText("Connect to vote");
      const opensLater = page.getByText(/voting has not started yet/i);
      await expect(
        selectBtn.or(connectPrompt).or(opensLater).first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    test("current results section renders the live tally", async ({ page }) => {
      const results = page.getByTestId("proposal-vote-results");
      await expect(
        page.getByRole("heading", { name: /current results/i }),
      ).toBeVisible({ timeout: 15_000 });
      // FGE-style per-choice rows: label + share + power count. Counts are
      // zero until ballots land (the demo window opens at noon Toronto), so
      // assert the structure, not specific numbers.
      await expect(results.getByText("Voting power for")).toBeVisible();
      await expect(results.getByText("Voting power withheld")).toBeVisible();
      await expect(
        results.getByText("Quorum", { exact: true }).first(),
      ).toBeVisible();
      await expect(results.getByRole("progressbar")).toBeVisible();
    });

    test("who-has-voted breakdown renders the holder-class rows", async ({
      page,
    }) => {
      await expect(
        page.getByText("Who has voted"),
      ).toBeVisible({ timeout: 15_000 });
      // Zero-ballot reset: the empty state renders until ballots land; with
      // ballots, the per-class rows do (spec survives both states).
      await expect(
        page
          .getByText(/no ballots yet/i)
          .or(page.getByText(/wallets voted/).first()),
      ).toBeVisible({ timeout: 15_000 });
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

    test("live proposal cards on /proposals link to /vote", async ({ page }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/proposals");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await hideReticleOverlay(page);
      // Owner directive: clicking a live-vote proposal goes to /vote.
      await expect(
        page.getByRole("link", { name: /vote now: governance parameter/i }),
      ).toHaveAttribute("href", "/vote");
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
      await hideReticleOverlay(page);
    });

    test("cast a vote from /vote and see it reflected on the detail page", async ({
      page,
    }) => {
      const ballot = page.getByTestId("proposal-vote-ballot");
      await expect(ballot).toBeVisible({ timeout: 15_000 });

      // Settle the client state FIRST: Select/Selected buttons render only
      // once auth + myVote have resolved (canVote). Sampling before that
      // would misread the current ballot.
      const forCardBtn = page
        .getByTestId("ballot-card-for")
        .getByRole("button", { name: /^(select|selected)$/i });
      // The seeded demo window opens at noon Toronto — before that the
      // ballot shows the opens-later notice and there is nothing to cast.
      const notStarted = page.getByText(/voting has not started yet/i);
      await expect(notStarted.or(forCardBtn).first()).toBeVisible({ timeout: 30_000 });
      test.skip(
        (await notStarted.count()) > 0,
        "demo window opens at noon Toronto — cast path re-armed after the window opens",
      );

      // Pick a target card that differs from the current ballot, so the run
      // is deterministic whether or not this wallet already voted.
      const btnText = (await forCardBtn.textContent()) ?? "";
      const currentIsFor = /selected/i.test(btnText);
      const target = currentIsFor ? "against" : "for";
      const targetCard = page.getByTestId(`ballot-card-${target}`);
      await targetCard.click();

      // The clicked choice must become the current ballot — the gold badge
      // lands on the card that was clicked.
      await expect(
        targetCard.getByText(/current ballot/i),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        targetCard.getByRole("button", { name: /^selected$/i }),
      ).toBeVisible({ timeout: 15_000 });

      // …and the same ballot shows on the detail page (shared code path).
      await page.goto("/proposals/prop-active-quorum-default");
      await expect(
        page.getByText(/your vote has been recorded|you voted:/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    test("comments and emoji reactions transfer between /vote and the detail page", async ({
      page,
    }) => {
      // Comment from /vote — the discussion island posts through the same
      // mutation the detail page uses, so the thread is shared.
      const commentText = `Sync check ${Date.now()}`;
      const composer = page.getByRole("textbox", { name: /add a comment/i });
      await expect(composer).toBeVisible({ timeout: 15_000 });
      await composer.fill(commentText);
      await page.getByRole("button", { name: /post comment/i }).click();
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 15_000 });

      // Reaction from /vote — the seeded thumbs-up chip renders in the
      // Proposal card; toggling it counts the fixture wallet.
      const reactions = page.getByTestId("proposal-vote-reactions");
      const thumbChip = reactions.getByRole("button", { name: /thumbs up/i });
      await expect(thumbChip).toBeVisible({ timeout: 15_000 });
      await thumbChip.click();
      await expect(thumbChip).toHaveAttribute("aria-pressed", "true", {
        timeout: 15_000,
      });

      // The detail page shares the same query key: comment AND reaction
      // must both be there.
      await page.goto("/proposals/prop-active-quorum-default");
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole("button", { name: /thumbs up.*you reacted/i }),
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
