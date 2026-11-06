import { test, expect } from "./auth.fixture";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  hideReticleOverlay,
  registerWalletDialogAutoDismiss,
} from "./helpers";

const RUN_E2E = !process.env.VITEST;

/** The PINNED per-proposal denominator the seeded hero carries (mock-data). */
const PINNED_DENOMINATOR = 215_000_000;
/** The live holders artifact total in this repo (data/holders.json). */
const LIVE_ARTIFACT_TOTAL = 581_973_790;
/** Seeded votes-row power on the hero (recount floor: tallies only grow). */
const SEEDED_POWER_VOTED = 11_050_399;

if (RUN_E2E) {
  test.describe("Vote hub — pinned per-ballot denominator", () => {
    test.beforeEach(async ({ page }) => {
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await hideReticleOverlay(page);
    });

    test("hero turnout uses the PINNED per-proposal denominator, not the live artifact", async ({
      page,
    }) => {
      await expect(
        page.getByRole("heading", { name: "Governance parameter: global default quorum" }),
      ).toBeVisible({ timeout: 15_000 });

      // Fixture sanity: the hero carries at least the seeded incident tallies
      // (earlier specs may have cast votes on this ballot — tallies only grow;
      // the PIN at 215M is what the assertion keys on, not the absolute power).
      const powerVotedText = await page
        .getByText("Voting power voted", { exact: true })
        .locator("xpath=preceding-sibling::div[1]")
        .innerText();
      const powerVoted = Number(powerVotedText.replace(/,/g, ""));
      expect(powerVoted).toBeGreaterThanOrEqual(SEEDED_POWER_VOTED);

      // The card's regression: turnout must read powerVoted / PINNED (5.1% at
      // the seeded floor) — NOT powerVoted / live artifact (1.9% pre-fix; the
      // Oct-20 stale-snapshot display bug). The two denominators differ by
      // ~2.7x, so the percentages diverge at one decimal for any powerVoted
      // at or above the seeded floor.
      const expectedPinned = ((powerVoted / PINNED_DENOMINATOR) * 100).toFixed(1) + "%";
      const expectedLive = ((powerVoted / LIVE_ARTIFACT_TOTAL) * 100).toFixed(1) + "%";
      expect(expectedPinned).not.toBe(expectedLive); // fixture discriminates

      const turnoutValue = page
        .getByText("Turnout", { exact: true })
        .first()
        .locator("xpath=preceding-sibling::div[1]");
      await expect(turnoutValue).toHaveText(expectedPinned);
      await expect(turnoutValue).not.toHaveText(expectedLive);
    });
  });
}
