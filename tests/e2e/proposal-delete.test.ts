import { dismissWalletDialog } from "./helpers";
import { expect, test } from "./auth.fixture";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Admin deletes a FAILED proposal.
 *
 * Exercises the full delete flow against the mock-mode server: the
 * confirmation dialog (cancel + confirm paths), the post-delete redirect,
 * the list/detail surfaces reflecting the deletion, the public audit-log
 * entry, the /admin cleanup section, and the non-admin negative case (no
 * delete affordance rendered).
 *
 * The dev seed already contains FAILED proposals; the spec resolves one via
 * the API instead of hardcoding ids. Tests are sequential (workers=1) and
 * the delete mutates state, so each test resolves its own target.
 */

interface FailedListResponse {
  proposals: Array<{ id: string; title: string }>;
}

async function firstFailedProposal(page: import("@playwright/test").Page) {
  const res = await page.request.get("/api/v1/proposals?status=FAILED&pageSize=100");
  if (!res.ok()) return null;
  const body = (await res.json()) as { data?: FailedListResponse };
  const proposals = body.data?.proposals ?? [];
  return proposals[0] ?? null;
}

if (RUN_E2E) {
  test.describe("Admin deletes a failed proposal", () => {
    test("admin can cancel, then confirm, the delete dialog end-to-end", async ({ page, adminAuthenticated: _adminAuthenticated }) => {
      const target = await firstFailedProposal(page);
      test.skip(!target, "no FAILED proposals seeded — skipping delete tests");

      await page.goto(`/proposals/${target!.id}`);
      await dismissWalletDialog(page);

      const deleteButton = page.getByRole("button", { name: /delete proposal/i });
      await expect(deleteButton).toBeVisible({ timeout: 30_000 });

      // Cancel path: dialog opens, cancel closes it, proposal is untouched.
      await deleteButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/what gets deleted/i)).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();

      // Confirm path: spinner while pending, then redirect to the list.
      await deleteButton.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /delete proposal/i }).click();
      await page.waitForURL("**/proposals", { timeout: 30_000 });

      // The list no longer contains the deleted proposal…
      const after = await page.request.get("/api/v1/proposals?status=FAILED&pageSize=100");
      const afterBody = (await after.json()) as { data?: FailedListResponse };
      const remainingIds = (afterBody.data?.proposals ?? []).map((p) => p.id);
      expect(remainingIds).not.toContain(target!.id);

      // …and the detail URL renders the graceful not-found state.
      await page.goto(`/proposals/${target!.id}`);
      await expect(page.getByText(/proposal not found/i)).toBeVisible({ timeout: 30_000 });

      // The public audit log records the deletion (the entry outlives the row).
      const audit = await page.request.get("/api/v1/audit-log?pageSize=100");
      expect(audit.ok()).toBeTruthy();
      const auditBody = (await audit.json()) as {
        data?: { entries?: Array<{ action: string; targetId: string }> };
      };
      const deletedEntry = auditBody.data?.entries?.find(
        (e) => e.action === "PROPOSAL_DELETED" && e.targetId === target!.id,
      );
      expect(deletedEntry).toBeTruthy();
    });

    test("non-admins see no delete affordance", async ({ page, authenticated: _authenticated }) => {
      const target = await firstFailedProposal(page);
      test.skip(!target, "no FAILED proposals seeded — skipping delete tests");

      await page.goto(`/proposals/${target!.id}`);
      await dismissWalletDialog(page);
      await expect(page.getByRole("button", { name: /delete proposal/i })).toHaveCount(0);
    });

    test("admin panel shows the Failed proposals cleanup section", async ({ page, adminAuthenticated: _adminAuthenticated }) => {
      const target = await firstFailedProposal(page);
      test.skip(!target, "no FAILED proposals seeded — skipping delete tests");

      await page.goto("/admin");
      await dismissWalletDialog(page);
      await expect(page.getByText(/failed proposals/i).first()).toBeVisible({ timeout: 30_000 });
      // The seeded FAILED proposal appears in the cleanup queue with a
      // delete affordance.
      await expect(page.getByText(target!.title).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /delete proposal/i }).first()).toBeVisible();
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
