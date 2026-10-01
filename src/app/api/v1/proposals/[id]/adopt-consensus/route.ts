import { type NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit-log";
import { sanitizeContent } from "@/lib/sanitize";
import { ErrorCode, ProposalStatus, type Proposal } from "@/types";

const adoptConsensusSchema = z.object({
  note: z.string().max(500).optional(),
});

/**
 * POST /api/v1/proposals/[id]/adopt-consensus
 *
 * Admin/moderator only. Applies the Wave 1 consensus fallback
 * (REFERENDUM-WAVE1.md §3): when an EXPIRED proposal missed quorum, its
 * most-voted outcome is still adopted as the community's working consensus —
 * recorded transparently as a quorum-missed decision, never as a pass.
 *
 * The winning side comes from the denormalized tallies (FOR > AGAINST → FOR,
 * otherwise AGAINST — a tie abstains from choosing). Metadata carries the full
 * disclosure: adoptedAs, adoptedOutcome, the quorum numbers at adoption, who
 * adopted it and when, plus the optional note. Re-confirmation in a later
 * ratification vote as turnout grows is the documented follow-up.
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
    body = null;
  }
  const parsed = adoptConsensusSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.status !== ProposalStatus.EXPIRED) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only expired (quorum-missed) proposals can be adopted as consensus.",
      409,
    );
  }

  const adoptedOutcome = proposal.votesFor > proposal.votesAgainst ? "FOR" : "AGAINST";
  const note = parsed.data.note !== undefined ? sanitizeContent(parsed.data.note) : undefined;
  const adoptedAt = new Date().toISOString();
  const meta = {
    ...(proposal.metadata ?? {}),
    adoptedAs: "consensus-fallback",
    adoptedOutcome,
    quorumAchieved: proposal.quorumAchieved,
    quorumRequired: proposal.quorumRequired,
    adoptedBy: session.sub.toLowerCase(),
    adoptedAt,
    ...(note !== undefined ? { adoptionNote: note } : {}),
  };

  // Status predicate closes the EXPIRED-read/UPDATE race: a concurrent
  // adoption (or any status flip) makes this a no-op instead of a silent
  // overwrite — same guard as record-outcome's PASSED update.
  const result = await db.execute({
    sql: "UPDATE proposals SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
    args: [ProposalStatus.EXECUTED, JSON.stringify(meta), id, ProposalStatus.EXPIRED],
  });
  if (result.rowsAffected === 0) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Only expired (quorum-missed) proposals can be adopted as consensus.",
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

  // Record in the public audit log — the metadata payload is the disclosure.
  await recordAuditEvent(session.sub, "PROPOSAL_ADOPTED_AS_CONSENSUS", "proposal", id, {
    adoptedAs: meta.adoptedAs,
    adoptedOutcome: meta.adoptedOutcome,
    quorumAchieved: meta.quorumAchieved,
    quorumRequired: meta.quorumRequired,
    adoptedAt,
    ...(note !== undefined ? { adoptionNote: note } : {}),
  });

  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
