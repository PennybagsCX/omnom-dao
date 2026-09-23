import { hideDevAuthPanel, registerWalletDialogAutoDismiss } from "./helpers";
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
  // A broken list API must fail loudly, not silently zero this spec's
  // coverage — skip is reserved for a genuinely empty seed.
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data?: FailedListResponse };
  const proposals = body.data?.proposals ?? [];
  return proposals[0] ?? null;
}

if (RUN_E2E) {
  test.describe("Admin deletes a failed proposal", () => {
    test("admin can cancel, then confirm, the delete dialog end-to-end", async ({ page, adminAuthenticated: _adminAuthenticated }) => {
      const target = await firstFailedProposal(page);
      test.skip(!target, "no FAILED proposals seeded — skipping delete tests");

      await registerWalletDialogAutoDismiss(page);
      await page.goto(`/proposals/${target!.id}`);

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

      await registerWalletDialogAutoDismiss(page);
      await page.goto(`/proposals/${target!.id}`);
      // Positive anchor first: the page really rendered, so the absence of
      // the button below is meaningful rather than a loading skeleton.
      await expect(page.getByRole("heading", { name: target!.title })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /delete proposal/i })).toHaveCount(0);
    });

    test("admin panel shows the Failed proposals cleanup section", async ({ page, adminAuthenticated: _adminAuthenticated }) => {
      const target = await firstFailedProposal(page);
      test.skip(!target, "no FAILED proposals seeded — skipping delete tests");

      await registerWalletDialogAutoDismiss(page);
      await page.goto("/admin");
      await expect(page.getByText(/failed proposals/i).first()).toBeVisible({ timeout: 30_000 });
      // The seeded FAILED proposal appears in the cleanup queue with a
      // delete affordance.
      await expect(page.getByText(target!.title).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /delete proposal/i }).first()).toBeVisible();
    });
  });

  test.describe("Draft author deletes their own draft", () => {
    test("dashboard delete button removes the author's draft", async ({
      page,
      authenticated: _auth,
    }) => {
      test.setTimeout(120_000);
      // The draft is created through the same API the create form uses.
      const title = `Dashboard draft delete ${Date.now()}`;
      const create = await page.request.post("/api/v1/proposals", {
        data: {
          title,
          description:
            "E2E draft for the dashboard author-delete flow — long enough for the fifty-character rule.",
          type: "GENERAL",
          saveAsDraft: true,
        },
        timeout: 60_000,
      });
      expect(create.ok()).toBeTruthy();
      const created = (await create.json()) as {
        data?: { proposal?: { id?: string; status?: string } };
      };
      const draftId = created.data?.proposal?.id ?? "";
      expect(draftId).toBeTruthy();
      expect(created.data?.proposal?.status).toBe("DRAFT");

      await registerWalletDialogAutoDismiss(page);
      await page.goto("/dashboard");
      // The dev-auth panel (bottom-right) overlaps the draft rows otherwise.
      await hideDevAuthPanel(page);
      const row = page.getByRole("listitem").filter({ hasText: title });
      await expect(row).toBeVisible({ timeout: 30_000 });

      // Two-step confirm: Delete → Confirm. No dialog involved.
      await row.getByRole("button", { name: new RegExp(`delete draft ${draftId}`, "i") }).click();
      await row.getByRole("button", { name: /^confirm$/i }).click();
      await expect(page.getByText(/draft deleted/i)).toBeVisible({ timeout: 30_000 });

      // Server truth: the draft is gone, not merely hidden from the list.
      const check = await page.request.get(`/api/v1/proposals/${draftId}`);
      expect(check.status()).toBe(404);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
