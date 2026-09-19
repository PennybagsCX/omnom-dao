import { type NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit-log";
import { ErrorCode, ProposalStatus } from "@/types";

/**
 * DELETE /api/v1/proposals/[id]/delete
 *
 * Admin/moderator only. Hard-deletes a FAILED proposal (rejected or
 * quorum-failed) together with its child rows — comments and their
 * reactions, votes, proposal emoji reactions — and detaches any
 * notifications pointing at it (notifications survive with proposal_id
 * NULL, matching the schema's SET NULL intent).
 *
 * PASSED / EXECUTED proposals are public governance history (see /results)
 * and are intentionally not deletable; EXPIRED cleanup is a possible
 * follow-up. The audit log keeps its PROPOSAL_DELETED entry (no FK on
 * target_id) so the action remains publicly auditable after deletion —
 * GOVERNANCE_MECHANICS.md §11.3.
 *
 * Atomicity: the db proxy exposes no transaction API that works in mock
 * mode (mock batch() is a no-op), so the statements run sequentially and
 * each is individually idempotent — an admin retry after a partial
 * failure completes the delete cleanly. Children are deleted before the
 * proposal row, so a mid-sequence failure never orphans a missing parent.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IdSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  if (!isAdminAddress(session.sub)) {
    return apiError(ErrorCode.NOT_VERIFIED, "Admin or moderator access required.", 403);
  }

  const parsed = IdSchema.safeParse(await params);
  if (!parsed.success) {
    return apiError(ErrorCode.VALIDATION_ERROR, "Invalid proposal id.", 400);
  }
  const { id } = parsed.data;

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.status !== ProposalStatus.FAILED) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only FAILED proposals can be deleted.",
      409,
    );
  }

  // Gather comment ids first — the mock SQL engine supports literal
  // placeholder IN (...) lists but not subqueries, and an empty IN ()
  // would match every row, so the child-reaction deletes are skipped
  // entirely when the proposal has no comments.
  const commentRes = await db.execute({
    sql: "SELECT id FROM comments WHERE proposal_id = ?",
    args: [id],
  });
  const commentIds = commentRes.rows.map((r) => r.id as string);

  if (commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(", ");
    await db.execute({
      sql: `DELETE FROM comment_reactions WHERE comment_id IN (${placeholders})`,
      args: commentIds,
    });
    await db.execute({
      sql: `DELETE FROM comment_emoji_reactions WHERE comment_id IN (${placeholders})`,
      args: commentIds,
    });
  }
  await db.execute({
    sql: "DELETE FROM comments WHERE proposal_id = ?",
    args: [id],
  });
  await db.execute({
    sql: "DELETE FROM votes WHERE proposal_id = ?",
    args: [id],
  });
  await db.execute({
    sql: "DELETE FROM proposal_emoji_reactions WHERE proposal_id = ?",
    args: [id],
  });
  await db.execute({
    sql: "UPDATE notifications SET proposal_id = NULL WHERE proposal_id = ?",
    args: [id],
  });

  // Status re-checked in the DELETE itself: if the proposal left the FAILED
  // state between the pre-check and now, this affects 0 rows.
  const result = await db.execute({
    sql: "DELETE FROM proposals WHERE id = ? AND status = ?",
    args: [id, ProposalStatus.FAILED],
  });
  if (result.rowsAffected === 0) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only FAILED proposals can be deleted.",
      409,
    );
  }

  // Record in the public audit log — the entry outlives the deleted row.
  await recordAuditEvent(session.sub, "PROPOSAL_DELETED", "proposal", id, {
    title: proposal.title,
    status: proposal.status,
    rejectionReason: proposal.metadata.rejectionReason ?? null,
  });

  return apiSuccess({ deleted: true, id });
}
