import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit-log";
import { notifyVotingStarted } from "@/lib/notifications";
import { ErrorCode, ProposalStatus, type Proposal } from "@/types";

/**
 * POST /api/v1/proposals/[id]/approve
 *
 * Admin/moderator only. Transitions a proposal from PENDING_REVIEW → ACTIVE
 * and sets the voting window (voting_start = now, voting_end = start + duration
 * inferred from the type default, or 168h).
 */
export async function POST(
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

  const { id } = await params;
  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.status !== ProposalStatus.PENDING_REVIEW) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only proposals pending review can be approved.",
      409,
    );
  }

  const now = new Date();
  const startsAtIso = now.toISOString();
  // Default active window: 168h (7d) unless the proposal already encodes a
  // duration in its metadata; spec keeps duration fixed per type default.
  const endsAtMs = now.getTime() + 168 * 60 * 60 * 1000;
  const endsAtIso = new Date(endsAtMs).toISOString();

  await db.execute({
    sql: "UPDATE proposals SET status = ?, voting_starts_at = ?, voting_ends_at = ?, updated_at = datetime('now') WHERE id = ?",
    args: [ProposalStatus.ACTIVE, startsAtIso, endsAtIso, id],
  });

  const updated = await getProposalById(id);

  // Verify the UPDATE actually changed the status.
  if (!updated || updated.status !== ProposalStatus.ACTIVE) {
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to update proposal status. Please try again.",
      500,
    );
  }

  // Record in the public audit log.
  await recordAuditEvent(
    session.sub,
    "PROPOSAL_APPROVED",
    "proposal",
    id,
    { votingStartsAt: startsAtIso, votingEndsAt: endsAtIso },
  );

  // Fire-and-forget: broadcast "voting started" to all verified holders.
  // The notification service swallows errors so this never blocks approval.
  void notifyVotingStarted(id).catch((err) =>
    console.error("[notifications] notifyVotingStarted error:", err),
  );

  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
