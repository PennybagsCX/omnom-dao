import { test, expect } from "./auth.fixture";
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
 * never touching the seeded demo proposals other suites depend on.
 * The pause/resume UI is additionally driven on the /vote quorum card.
 */

// Shared across the file's serial tests (workers: 1).
let throwawayId = "";

if (RUN_E2E) {
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
      await registerWalletDialogAutoDismiss(page);
      await page.goto("/vote");
      await page.waitForLoadState("domcontentloaded");
      await dismissWalletDialog(page);
      await hideDevAuthPanel(page);
      await hideReticleOverlay(page);

      const controls = page.getByTestId("proposal-admin-controls");
      await expect(controls).toBeVisible({ timeout: 15_000 });

      // Pause via the admin UI on the live quorum card.
      await controls.getByRole("button", { name: /pause voting/i }).click();
      const pausedNotice = page.getByText(/voting paused/i).first();
      await expect(pausedNotice).toBeVisible({ timeout: 15_000 });

      // The server refuses ballots while paused (409 VOTING_PAUSED). Probe the
      // throwaway — it is the most recently OPENED ACTIVE proposal, i.e. the
      // one the /vote hero (and these controls) actually target.
      const voteAttempt = await page.request.post(
        `/api/v1/proposals/${throwawayId}/votes`,
        { data: { choice: "FOR" }, timeout: 30_000 },
      );
      expect(voteAttempt.status()).toBe(409);
      expect(((await voteAttempt.json())?.error?.code ?? "") === "VOTING_PAUSED").toBe(true);

      // …and resume through the UI lifts the block.
      await controls.getByRole("button", { name: /resume voting/i }).click();
      await expect(pausedNotice).toBeHidden({ timeout: 15_000 });
    });

    test("stop closes the vote immediately and applies the outcome rules", async ({
      page,
      adminAuthenticated: _admin,
    }) => {
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
