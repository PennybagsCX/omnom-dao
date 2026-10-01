import { type NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit-log";
import { finalizeProposal } from "@/lib/proposal-finalize";
import { ErrorCode, ProposalStatus, type Proposal } from "@/types";

/**
 * POST /api/v1/proposals/[id]/vote-control
 *
 * Admin only. Live-vote management for ACTIVE proposals:
 *   - pause  : ballots are refused (409 VOTING_PAUSED) and the finalize sweep
 *              skips the proposal until resumed.
 *   - resume : lifts the pause and shifts voting_ends_at forward by exactly
 *              the paused duration — no voting time is lost to a pause.
 *   - stop   : closes the vote immediately (voting_ends_at = now) and runs the
 *              normal finalizer, so the standard quorum/threshold rules decide
 *              the outcome. Stopped votes show the regular outcome statuses.
 *   - extend : pushes voting_ends_at forward to an explicit `endsAt` ISO stamp
 *              (or by `days`). Approve hardcodes a per-type window, so extend
 *              is how a longer sanctioned window (e.g. the Wave 1 Referendum's
 *              30 days) is pinned without re-approving. Extension only — the
 *              close can move later, never earlier, and the total window is
 *              capped at 60 days.
 *
 * Pause state lives in metadata JSON (`pausedAt`) — no schema migration.
 * Every action lands in the public audit log.
 */

const MAX_WINDOW_DAYS = 60;

const ActionSchema = z.object({
  action: z.enum(["pause", "resume", "stop", "extend"]),
  endsAt: z.string().optional(),
  days: z.number().int().min(1).max(MAX_WINDOW_DAYS).optional(),
});

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

  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(
      ErrorCode.MISSING_FIELDS,
      "action must be pause, resume, stop, or extend (with endsAt or days).",
      400,
    );
  }
  const action = parsed.data.action;
  if (action === "extend" && parsed.data.endsAt === undefined && parsed.data.days === undefined) {
    return apiError(ErrorCode.MISSING_FIELDS, "extend requires endsAt or days.", 400);
  }

  const { id } = await params;
  let proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.status !== ProposalStatus.ACTIVE) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Vote controls apply only to proposals with a live vote.",
      409,
    );
  }

  const nowIso = new Date().toISOString();
  const writeMetadata = async (meta: Proposal["metadata"]) => {
    await db.execute({
      sql: "UPDATE proposals SET metadata = ?, updated_at = datetime('now') WHERE id = ?",
      args: [JSON.stringify(meta), id],
    });
  };

  if (action === "pause") {
    if (proposal.pausedAt) {
      return apiError(ErrorCode.VOTING_PAUSED, "Voting is already paused.", 409);
    }
    const meta = { ...proposal.metadata, pausedAt: nowIso };
    await writeMetadata(meta);
    await recordAuditEvent(session.sub, "VOTE_PAUSED", "proposal", id, { pausedAt: nowIso });
  } else if (action === "resume") {
    if (!proposal.pausedAt) {
      return apiError(ErrorCode.VOTING_PAUSED, "Voting is not paused.", 409);
    }
    // Shift the close forward by exactly the paused duration — a pause costs
    // the vote no usable time.
    const pausedMs = Date.now() - Date.parse(proposal.pausedAt);
    const currentEnd = proposal.votingEndsAt ? Date.parse(proposal.votingEndsAt) : Date.now();
    const newEndIso = new Date(currentEnd + Math.max(0, pausedMs)).toISOString();
    const meta = { ...proposal.metadata };
    delete (meta as { pausedAt?: string }).pausedAt;
    await db.execute({
      sql: "UPDATE proposals SET voting_ends_at = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?",
      args: [newEndIso, JSON.stringify(meta), id],
    });
    await recordAuditEvent(session.sub, "VOTE_RESUMED", "proposal", id, {
      resumedAt: nowIso,
      votingEndsAt: newEndIso,
    });
  } else if (action === "extend") {
    // Repin the close to an explicit timestamp (or a day-count from now).
    // Moving the close EARLIER is allowed: this is an admin-only, audited
    // correction, and "stop" is already strictly more powerful — the
    // extension-only rule guarded nothing and blocked launch-day fixes.
    // The close must stay in the future and the total window <= 60 days.
    const currentEndMs = proposal.votingEndsAt ? Date.parse(proposal.votingEndsAt) : NaN;
    let targetEndMs: number;
    if (parsed.data.endsAt !== undefined) {
      targetEndMs = Date.parse(parsed.data.endsAt);
      if (Number.isNaN(targetEndMs)) {
        return apiError(ErrorCode.MISSING_FIELDS, "endsAt must be a valid ISO timestamp.", 400);
      }
    } else {
      targetEndMs = Date.now() + (parsed.data.days ?? 0) * 24 * 60 * 60 * 1000;
    }
    if (targetEndMs <= Date.now()) {
      return apiError(
        ErrorCode.MISSING_FIELDS,
        "The new closing time must be in the future.",
        409,
      );
    }
    const startMs = proposal.votingStartsAt ? Date.parse(proposal.votingStartsAt) : NaN;
    if (
      !Number.isNaN(startMs) &&
      targetEndMs - startMs > MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ) {
      return apiError(
        ErrorCode.MISSING_FIELDS,
        `Total voting window cannot exceed ${MAX_WINDOW_DAYS} days.`,
        409,
      );
    }
    const newEndIso = new Date(targetEndMs).toISOString();
    await db.execute({
      sql: "UPDATE proposals SET voting_ends_at = ?, updated_at = datetime('now') WHERE id = ?",
      args: [newEndIso, id],
    });
    await recordAuditEvent(session.sub, "VOTE_WINDOW_EXTENDED", "proposal", id, {
      previousEnd: proposal.votingEndsAt,
      newEnd: newEndIso,
    });
  } else {
    // stop — close now and run the standard finalizer; quorum/threshold rules
    // decide the outcome exactly as if the window had elapsed. Any pause is
    // lifted: the finalizer skips paused proposals, so leaving `pausedAt` set
    // would strand a stopped vote ACTIVE forever (cron skips it too).
    const meta = { ...proposal.metadata };
    delete (meta as { pausedAt?: string }).pausedAt;
    await db.execute({
      sql: "UPDATE proposals SET voting_ends_at = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?",
      args: [nowIso, JSON.stringify(meta), id],
    });
    await finalizeProposal(id);
    proposal = (await getProposalById(id)) ?? proposal;
    if (proposal.status === ProposalStatus.ACTIVE) {
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        "Failed to finalize the stopped vote. Please try again.",
        500,
      );
    }
    await recordAuditEvent(session.sub, "VOTE_STOPPED", "proposal", id, {
      stoppedAt: nowIso,
      finalStatus: proposal.status,
    });
  }

  const updated = (await getProposalById(id)) ?? proposal;
  return apiSuccess<{ proposal: Proposal }>({ proposal: updated });
}
