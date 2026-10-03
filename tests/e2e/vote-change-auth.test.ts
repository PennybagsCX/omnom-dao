import { test, expect } from "./auth.fixture";
import type { Page } from "@playwright/test";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  registerWalletDialogAutoDismiss,
} from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — changing a vote on the proposal detail page.
 *
 * The detail page's ballot is the SAME selectable-card component the /vote
 * hub uses (ProposalBallotCards): the current choice carries the "Current
 * ballot" badge + Selected button, and clicking another card changes the
 * vote in one click — no modal, identical at every viewport.
 *
 * State note: the mock DB persists across tests, so each test tolerates
 * arriving with any ballot already cast (or none).
 */

type Choice = "for" | "against" | "abstain";
const CHOICES: Choice[] = ["for", "against", "abstain"];

/** Which card currently holds the "Current ballot" badge (null = not voted). */
async function currentChoice(page: Page): Promise<Choice | null> {
  for (const choice of CHOICES) {
    const card = page.getByTestId(`ballot-card-${choice}`);
    if ((await card.count()) > 0 && (await card.innerText()).includes("Current ballot")) {
      return choice;
    }
  }
  return null;
}

/** Cast a ballot by clicking the card's Select button (or the card itself). */
async function select(page: Page, choice: Choice): Promise<void> {
  const card = page.getByTestId(`ballot-card-${choice}`);
  const button = card.getByRole("button", { name: /^select$/i });
  if ((await button.count()) > 0) {
    await button.click();
  } else {
    await card.click();
  }
  await expect(card).toContainText("Current ballot", { timeout: 15_000 });
}

if (RUN_E2E) {
  test.describe("Vote change (authenticated)", () => {
    test.beforeEach(async ({ page, authenticated: _authenticated }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/proposals/prop-active-tokenomics-burn");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);

      // The ballot is the interaction under test — wait for its cards.
      await expect(page.getByTestId("ballot-card-for")).toBeVisible({ timeout: 30_000 });
    });

    test("authenticated user can cast an initial vote", async ({ page }) => {
      if ((await currentChoice(page)) !== null) {
        test.skip(true, "wallet already voted on this proposal — cast test re-armed after a ballot reset");
      }
      await select(page, "for");
    });

    test("the current ballot is badged as Selected after voting", async ({ page }) => {
      if ((await currentChoice(page)) === null) await select(page, "for");
      const card = page.getByTestId("ballot-card-for");
      await expect(card.getByRole("button", { name: /^selected$/i })).toBeVisible();
      await expect(card.getByText("Current ballot")).toBeVisible();
    });

    test("user can change their vote with one click", async ({ page }) => {
      const existing = await currentChoice(page);
      if (existing === null) await select(page, "for");
      const target: Choice = existing === "against" ? "abstain" : "against";
      await select(page, target);
      await expect(page.getByTestId(`ballot-card-${target}`)).toContainText("Current ballot");
      // The old choice is no longer badged.
      const previous: Choice = existing ?? "for";
      if (previous !== target) {
        await expect(page.getByTestId(`ballot-card-${previous}`)).not.toContainText(
          "Current ballot",
        );
      }
    });

    test("re-selecting the current choice is a safe no-op", async ({ page }) => {
      if ((await currentChoice(page)) === null) await select(page, "for");
      // The same-choice click early-returns in handleChoice — no error, no
      // state change, badge stays put.
      await select(page, "for");
      await expect(page.getByTestId("ballot-card-for")).toContainText("Current ballot");
    });

    test("multiple vote-changes work correctly", async ({ page }) => {
      const existing = await currentChoice(page);
      if (existing === null) await select(page, "for");
      // Cycle to the next two choices — the badge must follow each time.
      const order: Choice[] = ["for", "against", "abstain"];
      const startIdx = order.indexOf((await currentChoice(page)) ?? "for");
      for (const step of [1, 2]) {
        const next = order[(startIdx + step) % order.length] ?? "for";
        await select(page, next);
      }
    });

    test("vote-choice persists after page refresh", async ({ page }) => {
      const existing = await currentChoice(page);
      if (existing === null) await select(page, "for");
      const before = await currentChoice(page);

      // No waitForLoadState("networkidle"): the app polls periodically and
      // networkidle can never settle on slow runners.
      await page.reload();
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await expect(page.getByTestId("ballot-card-for")).toBeVisible({ timeout: 30_000 });

      expect(await currentChoice(page)).toBe(before);
    });
  });

  test.describe("Vote change mobile (authenticated)", () => {
    test.beforeEach(async ({ page, authenticated: _authenticated }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/proposals/prop-active-tokenomics-burn");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await expect(page.getByTestId("ballot-card-for")).toBeVisible({ timeout: 30_000 });
    });

    test("the ballot cards are the mobile voting UI — no separate bar needed", async ({
      page,
    }) => {
      // The old design shipped a second mobile-only vote bar; the ballot
      // cards now serve every viewport. Badge + select work at phone width.
      if ((await currentChoice(page)) === null) await select(page, "for");
      await select(page, "against");
      await expect(page.getByTestId("ballot-card-against")).toContainText("Current ballot");
    });
  });
}
