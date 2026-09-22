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

    test("cast-vote ballot renders as FGE-style choice cards", async ({ page }) => {
      await expect(
        page.getByTestId("ballot-card-for"),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("ballot-card-against")).toBeVisible();
      await expect(page.getByTestId("ballot-card-abstain")).toBeVisible();
      // Dev-auth e2e usually auto-logs-in; anonymous visitors get the
      // connect box instead of Select buttons (branch pinned in component
      // tests — here we accept either settled state).
      const selectBtn = page.getByTestId("ballot-card-for").getByRole("button", { name: /^select$/i });
      const connectPrompt = page.getByText("Connect to vote");
      await expect(selectBtn.or(connectPrompt).first()).toBeVisible({ timeout: 30_000 });
    });

    test("current results section renders the live tally", async ({ page }) => {
      const results = page.getByTestId("proposal-vote-results");
      await expect(
        page.getByRole("heading", { name: /current results/i }),
      ).toBeVisible({ timeout: 15_000 });
      // FGE-style per-choice rows: label + share + power count.
      await expect(results.getByText("Voting power for")).toBeVisible();
      await expect(results.getByText("9,867,109")).toBeVisible();
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
      const ballot = page.getByTestId("proposal-vote-ballot");
      await expect(ballot).toBeVisible({ timeout: 15_000 });

      // Settle the client state FIRST: Select/Selected buttons render only
      // once auth + myVote have resolved (canVote). Sampling before that
      // would misread the current ballot.
      const forCardBtn = page
        .getByTestId("ballot-card-for")
        .getByRole("button", { name: /^(select|selected)$/i });
      await expect(forCardBtn).toBeVisible({ timeout: 30_000 });

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
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Vote hub — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
