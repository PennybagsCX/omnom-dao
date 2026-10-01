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

/**
 * POST /api/v1/proposals/[id]/adopt-consensus
 *
 * Admin/moderator only. Applies the Wave 1 consensus fallback
 * (REFERENDUM-WAVE1.md §3): when an EXPIRED proposal missed quorum, its
 * most-voted outcome is still adopted as the community's working consensus —
 * recorded transparently as a quorum-missed decision, never as a pass.
 *
 * Guardrails (added 2026-10-01 after the Week 1 miss — DOCS/STATUS.md):
 *
 *   1. TIME-LOCK  — a fallback intent must be declared first
 *      ({ declareIntent: true }) and adoption is refused for 24h after.
 *      The real-world announcement (Telegram/X) is expected to accompany
 *      the declaration; the metadata timestamp proves the cooling-off.
 *   2. STRENGTH   — by default the most-voted side must hold ≥ 60% of
 *      (FOR + AGAINST) power AND ≥ MIN_UNIQUE_VOTERS unique wallets must
 *      have voted. A tiny plurality adopting "for everyone" is the abuse
 *      this blocks.
 *   3. OVERRIDE   — { force: true, note } bypasses both, for the case where
 *      the published terms of a specific vote promised a plain most-voted
 *      adoption (the Wave 1 Referendum did) and turnout is below the floor.
 *      Forced adoptions are marked `forced: true` in the proposal metadata
 *      and the public audit log — visible, never silent.
 *
 * The winning side comes from the denormalized tallies (FOR > AGAINST → FOR,
 * otherwise AGAINST — a tie abstains from choosing). Metadata carries the full
 * disclosure: adoptedAs, adoptedOutcome, the quorum numbers at adoption, the
 * guardrail verdicts, who adopted it and when, plus the optional note.
 * Re-confirmation in a later ratification vote as turnout grows is the
 * documented follow-up.
 */

/** Minimum share of (FOR + AGAINST) power the winning side must hold. */
const MIN_WIN_SHARE = 0.6;
/** Minimum unique wallets that must have voted for a default adoption. */
const MIN_UNIQUE_VOTERS = 100;
/** Cooling-off between the intent declaration and the adoption. */
const INTENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const adoptConsensusSchema = z.object({
  note: z.string().max(500).optional(),
  declareIntent: z.boolean().optional(),
  force: z.boolean().optional(),
});

/** Unique wallets that cast a ballot on this proposal. */
async function countUniqueVoters(proposalId: string): Promise<number> {
  const res = await db.execute({
    sql: "SELECT COUNT(DISTINCT voter_address) AS n FROM votes WHERE proposal_id = ?",
    args: [proposalId],
  });
  return Number(res.rows[0]?.n ?? 0);
}

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
  const { declareIntent, force, note: rawNote } = parsed.data;
  if (force && rawNote === undefined) {
    return apiError(
      ErrorCode.MISSING_FIELDS,
      "A forced adoption requires a note explaining why the guardrails are overridden.",
      400,
    );
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

  // ── Mode 1: declare the fallback intent (starts the cooling-off) ────
  if (declareIntent) {
    const meta = {
      ...(proposal.metadata ?? {}),
      fallbackIntentDeclaredAt: new Date().toISOString(),
      fallbackIntentDeclaredBy: session.sub.toLowerCase(),
    };
    const res = await db.execute({
      sql: "UPDATE proposals SET metadata = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
      args: [JSON.stringify(meta), id, ProposalStatus.EXPIRED],
    });
    if (res.rowsAffected === 0) {
      return apiError(
        ErrorCode.VOTING_CLOSED,
        "Only expired (quorum-missed) proposals can enter the fallback flow.",
        409,
      );
    }
    await recordAuditEvent(session.sub, "FALLBACK_INTENT_DECLARED", "proposal", id, {
      declaredAt: meta.fallbackIntentDeclaredAt,
      note: "Fallback adoption intent declared — 24h cooling-off starts; public announcement expected.",
    });
    const updated = (await getProposalById(id)) ?? proposal;
    return apiSuccess<{ proposal: Proposal; coolingOffEndsAt: string }>({
      proposal: updated,
      coolingOffEndsAt: new Date(Date.parse(meta.fallbackIntentDeclaredAt) + INTENT_COOLDOWN_MS).toISOString(),
    });
  }

  // ── Mode 2: the adoption itself ─────────────────────────────────────
  const meta0 = proposal.metadata ?? {};
  const declaredAt = meta0.fallbackIntentDeclaredAt;
  const forAgainst = proposal.votesFor + proposal.votesAgainst;
  const winShare = forAgainst > 0 ? proposal.votesFor / forAgainst : 0;
  const uniqueVoters = await countUniqueVoters(id);
  const meetsShare = forAgainst > 0 && winShare >= MIN_WIN_SHARE;
  const meetsFloor = uniqueVoters >= MIN_UNIQUE_VOTERS;
  const intentAgeOk =
    typeof declaredAt === "string" &&
    Date.now() - Date.parse(declaredAt) >= INTENT_COOLDOWN_MS;

  if (!force) {
    if (!intentAgeOk) {
      return apiError(
        ErrorCode.VOTING_CLOSED,
        declaredAt
          ? "Cooling-off in effect: adoption unlocks 24h after the intent declaration."
          : "Declare the fallback intent first ({ declareIntent: true }) — adoption unlocks 24h later.",
        409,
      );
    }
    if (!meetsShare || !meetsFloor) {
      return apiError(
        ErrorCode.VOTING_CLOSED,
        `Guardrails not met: winning side holds ${(winShare * 100).toFixed(1)}% of FOR+AGAINST (needs ≥ ${MIN_WIN_SHARE * 100}%) and ${uniqueVoters} unique wallets voted (needs ≥ ${MIN_UNIQUE_VOTERS}). Use force with a note to override — it is recorded publicly.`,
        409,
      );
    }
  }

  const adoptedOutcome = proposal.votesFor > proposal.votesAgainst ? "FOR" : "AGAINST";
  const note = rawNote !== undefined ? sanitizeContent(rawNote) : undefined;
  const adoptedAt = new Date().toISOString();
  const meta = {
    ...meta0,
    adoptedAs: "consensus-fallback",
    adoptedOutcome,
    quorumAchieved: proposal.quorumAchieved,
    quorumRequired: proposal.quorumRequired,
    adoptedBy: session.sub.toLowerCase(),
    adoptedAt,
    // Guardrail disclosure — what the numbers looked like at adoption time.
    fallbackGuardrails: {
      winShare: Number(winShare.toFixed(4)),
      requiredWinShare: MIN_WIN_SHARE,
      uniqueVoters,
      requiredUniqueVoters: MIN_UNIQUE_VOTERS,
      intentDeclaredAt: declaredAt ?? null,
      forced: force === true,
    },
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
    fallbackGuardrails: meta.fallbackGuardrails,
    ...(force ? { forced: true } : {}),
    ...(note !== undefined ? { adoptionNote: note } : {}),
  });

  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
