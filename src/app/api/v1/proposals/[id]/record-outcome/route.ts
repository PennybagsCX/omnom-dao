import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit-log";
import { sanitizeContent } from "@/lib/sanitize";
import { z } from "zod";
import { ErrorCode, ProposalStatus, type Proposal } from "@/types";

const recordOutcomeSchema = z.object({
  note: z.string().max(500).optional(),
});

/**
 * POST /api/v1/proposals/[id]/record-outcome
 *
 * Admin/moderator only. Transitions a PASSED proposal → EXECUTED (§6.1:
 * "Outcome recorded (off-chain action taken)"). Records the optional note,
 * acting admin, and timestamp in the proposal metadata.
 */
export async function POST(
  request: NextRequest,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = recordOutcomeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.status !== ProposalStatus.PASSED) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only passed proposals can have their outcome recorded.",
      409,
    );
  }

  const note = parsed.data.note !== undefined ? sanitizeContent(parsed.data.note) : undefined;
  const meta = {
    ...(proposal.metadata ?? {}),
    ...(note !== undefined ? { executionNote: note } : {}),
    executedBy: session.sub.toLowerCase(),
    executedAt: new Date().toISOString(),
  };

  // Status predicate closes the PASSED-read/UPDATE race: a concurrent record
  // (or finalize flipping the status) makes this a no-op instead of a silent
  // overwrite of the other admin's recorded outcome.
  const result = await db.execute({
    sql: "UPDATE proposals SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
    args: [ProposalStatus.EXECUTED, JSON.stringify(meta), id, ProposalStatus.PASSED],
  });
  if (result.rowsAffected === 0) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only passed proposals can have their outcome recorded.",
      409,
    );
  }

  const updated = await getProposalById(id);

  // Verify the UPDATE actually changed the status.
  if (!updated || updated.status !== ProposalStatus.EXECUTED) {
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to update proposal status. Please try again.",
      500,
    );
  }

  // Record in the public audit log.
  await recordAuditEvent(
    session.sub,
    "PROPOSAL_OUTCOME_RECORDED",
    "proposal",
    id,
    { note },
  );

  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
