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

const rejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});

/**
 * POST /api/v1/proposals/[id]/reject
 *
 * Admin/moderator only. Rejects a pending-review proposal with a reason.
 * Sets status to FAILED and records the reason in metadata.
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
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);

  const reason = sanitizeContent(parsed.data.reason);
  const meta = {
    ...(proposal.metadata ?? {}),
    rejectionReason: reason,
    rejectedBy: session.sub.toLowerCase(),
    rejectedAt: new Date().toISOString(),
  };

  await db.execute({
    sql: "UPDATE proposals SET status = 'FAILED', metadata = ?, updated_at = datetime('now') WHERE id = ?",
    args: [JSON.stringify(meta), id],
  });

  // Record in the public audit log.
  await recordAuditEvent(
    session.sub,
    "PROPOSAL_REJECTED",
    "proposal",
    id,
    { reason },
  );

  const updated = await getProposalById(id);

  // Verify the UPDATE actually changed the status.
  if (!updated || updated.status !== ProposalStatus.FAILED) {
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to update proposal status. Please try again.",
      500,
    );
  }

  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
