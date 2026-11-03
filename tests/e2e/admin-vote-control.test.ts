import { test, expect } from "./auth.fixture";
import type { Page } from "@playwright/test";
import {
  dismissWalletDialog,
  hideDevAuthPanel,
  hideReticleOverlay,
  registerWalletDialogAutoDismiss,
} from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Admin live-vote controls (pause / resume / stop).
 *
 * Runs first alphabetically: it creates its own throwaway proposal (as the
 * admin session), approves it, and exercises the control route against it —
 * the throwaway keeps create/approve/stop away from the seeded demo
 * proposals other suites depend on.
 * The pause/resume UI is driven on the /vote quorum card — which belongs to
 * the HERO proposal, so the ballot probe targets the hero too (see
 * deriveHeroId below); a `finally` guard resumes it so a mid-test failure
 * can never strand the hero paused for later suites.
 */

// Shared across the file's serial tests (workers: 1).
let throwawayId = "";

/**
 * The /vote hero is `others[0]` from loadReferendum(): ACTIVE proposals
 * sorted by votingStartsAt DESC (src/lib/referendum.ts), i.e. the NEWEST
 * start wins. That is normally the fresh throwaway — but the seeded
 * "quorum" demo window opens at noon Toronto TODAY (src/lib/mock-data.ts),
 * so in morning runs its future start sorts ahead of the throwaway and the
 * hero (and its admin controls) target the demo instead. Deriving the hero
 * id with the same server-side query the page runs keeps the UI drive and
 * the ballot refusal probe aimed at the SAME proposal at any clock time.
 */
async function deriveHeroId(request: Page["request"]): Promise<string> {
  // Same candidate set as the page (ACTIVE, limit 50); the public API's
  // sortBy enum predates votingStartsAt, so the desc sort mirrors
  // loadReferendum client-side instead.
  const list = await request.get("/api/v1/proposals?status=ACTIVE&limit=50");
  if (!list.ok()) return "";
  const body = await list.json();
  const proposals: Array<{ id: string; votingStartsAt?: string | null }> =
    body?.data?.proposals ?? [];
  const hero = [...proposals]
    .sort(
      (a, b) =>
        Date.parse(b.votingStartsAt ?? "") - Date.parse(a.votingStartsAt ?? ""),
    )
    .at(0);
  return hero?.id ?? "";
}

/**
 * Derive the throwaway proposal id from the API instead of trusting
 * module-level state: the creator test titles its throwaway with a stable
 * prefix. Keeps the suite correct even if a test lands in a fresh module
 * instance. (This is NOT the /vote hero in morning runs — see
 * deriveHeroId for how the hero is chosen.)
 */
async function deriveThrowawayId(request: Page["request"]): Promise<string> {
  const list = await request.get("/api/v1/proposals?limit=10");
  if (!list.ok()) return "";
  const body = await list.json();
  const proposals: Array<{ id: string; title?: string; status?: string }> =
    body?.data?.proposals ?? [];
  const mine = proposals.find(
    (pr) =>
      pr.status === "ACTIVE" &&
      pr.title?.startsWith("Admin vote-control test"),
  );
  return mine?.id ?? "";
}

if (RUN_E2E) {
  test.describe.configure({ mode: "serial" });
  test.describe("Admin vote controls", () => {
    test("admin creates and approves a throwaway live vote", async ({
      page,
      adminAuthenticated: _admin,
    }) => {
      // Warm POST-only route modules (approve, vote-control) with cheap GETs
      // — dev compiles routes on first hit, and a POST that triggers the
      // compile can lose its body and hang. A 405 still forces the compile.
      await page.request.get("/api/v1/proposals?limit=1").catch(() => {});
      await page
        .request
        .get("/api/v1/proposals/prop-active-quorum-default/vote-control")
        .catch(() => {});

      const create = await page.request.post("/api/v1/proposals", {
        data: {
          title: `Admin vote-control test ${Date.now()}`,
          description:
            "E2E throwaway for the pause/resume/stop controls — long enough for the fifty-character description rule to pass cleanly.",
          type: "GENERAL",
        },
        // Cold-run compiles: this suite runs first and eats every route's
        // first-hit compile latency. 60s so one slow POST can't cascade.
        timeout: 60_000,
      });
      expect(create.ok()).toBeTruthy();
      const body = await create.json();
      throwawayId = body.data.proposal.id as string;
      expect(throwawayId).toBeTruthy();

      const approve = await page.request.post(
        `/api/v1/proposals/${throwawayId}/approve`,
        { timeout: 60_000 },
      );
      expect(approve.ok()).toBeTruthy();
    });

    test("pause makes the vote refuse ballots; resume lifts it (UI + API)", async ({
      page,
      adminAuthenticated: _admin,
    }) => {
      if (!throwawayId) throwawayId = await deriveThrowawayId(page.request);
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await hideReticleOverlay(page);

      const controls = page.getByTestId("proposal-admin-controls");
      await expect(controls).toBeVisible({ timeout: 15_000 });

      // The admin controls (and the paused notice) belong to whatever
      // proposal the /vote hero currently is — derive its id with the same
      // query the page runs and aim the ballot probe at THAT proposal.
      // Asserting 409 against any other id measures the clock, not the
      // feature: the un-paused proposal happily accepts ballots (201).
      const heroId = await deriveHeroId(page.request);
      expect(heroId).toBeTruthy();

      try {
        // Pause via the admin UI on the live quorum card.
        await controls.getByRole("button", { name: /pause voting/i }).click();
        const pausedNotice = page.getByText(/voting paused/i).first();
        await expect(pausedNotice).toBeVisible({ timeout: 15_000 });

        // The server refuses ballots while paused (409 VOTING_PAUSED) —
        // probed against the paused proposal itself.
        const voteAttempt = await page.request.post(
          `/api/v1/proposals/${heroId}/votes`,
          { data: { choice: "FOR" }, timeout: 30_000 },
        );
        expect(voteAttempt.status()).toBe(409);
        expect(
          ((await voteAttempt.json())?.error?.code ?? "") === "VOTING_PAUSED",
        ).toBe(true);

        // …and resume through the UI lifts the block.
        await controls.getByRole("button", { name: /resume voting/i }).click();
        await expect(pausedNotice).toBeHidden({ timeout: 15_000 });
      } finally {
        // Safety net: a failure between pause and resume must never strand
        // the hero paused — later suites read /vote's live state too.
        const resumeButton = controls.getByRole("button", {
          name: /resume voting/i,
        });
        if (await resumeButton.isVisible().catch(() => false)) {
          await resumeButton.click();
        }
      }
    });

    test("stop closes the vote immediately and applies the outcome rules", async ({
      page,
      adminAuthenticated: _admin,
    }) => {
      if (!throwawayId) throwawayId = await deriveThrowawayId(page.request);
      expect(throwawayId).toBeTruthy();

      const stop = await page.request.post(
        `/api/v1/proposals/${throwawayId}/vote-control`,
        { data: { action: "stop" }, timeout: 30_000 },
      );
      expect(stop.ok()).toBeTruthy();

      const detail = await page.request.get(`/api/v1/proposals/${throwawayId}`);
      const body = await detail.json();
      const status = body.data?.proposal?.status as string;
      // Normal finalizer rules decide: quorum unmet on a fresh throwaway →
      // EXPIRED (the honest outcome of stopping an empty vote).
      expect(["PASSED", "FAILED", "EXPIRED", "EXECUTED"]).toContain(status);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Admin vote controls — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
