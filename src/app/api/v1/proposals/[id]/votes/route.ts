import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { getSnapshotMetadataTyped, lookupHolder } from "@/lib/snapshot";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { finalizeProposal } from "@/lib/proposal-finalize";
import { castVoteSchema } from "@/lib/validators";
import { getOutgoingDelegation, effectiveStatus } from "@/lib/delegation";
import {
  ErrorCode,
  ProposalStatus,
  VoteChoice,
  type Delegation,
  type Vote,
} from "@/types";

// P1-1: Per-user vote-cast rate limit (defense-in-depth against API abuse).
// Allows up to 10 vote attempts per 5 minutes per user.
const VOTE_RATE_LIMIT = { limit: 10, windowSeconds: 5 * 60 };

/**
 * Votes for a single proposal.
 *
 * POST /api/v1/proposals/[id]/votes   — cast a vote.
 * PUT  /api/v1/proposals/[id]/votes   — change an existing vote (while voting is open).
 *
 * Server-side invariants enforced:
 *  - proposal is ACTIVE and within [voting_start, voting_end]
 *  - one vote per (proposal, voter) — DB UNIQUE constraint is the hard guarantee
 *  - voting power recorded from the immutable snapshot at cast time
 *  - vote changes permitted at any time while the proposal is ACTIVE
 *
 * DELEGATION (v1): Delegation is informational / trackable. A voter with an
 * active outgoing delegation may still cast their OWN vote (an "override"),
 * and their vote is weighted by their OWN frozen snapshot balance — the
 * delegatee's power is NOT boosted. The delegation metadata is attached to
 * the response so the UI can surface "voted while delegating". See
 * GOVERNANCE_MECHANICS.md §11.
 */

interface VoteResponseData {
  vote: Vote;
  proposal: {
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
  };
  /** The voter's outgoing delegation at cast time (informational). */
  delegation: {
    outgoing: Delegation | null;
    /** Whether the voter cast this vote despite an active delegation (override). */
    isOverride: boolean;
  };
}

async function loadContext(id: string, sessionAddress: string) {
  let proposal = await getProposalById(id);
  if (!proposal) {
    return { error: apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404) } as const;
  }
  // P0-1: Lazy finalization — if the voting window has ended, finalize the
  // proposal before returning. This ensures that even without the cron job
  // running, users see the correct status (PASSED/FAILED/EXPIRED) immediately.
  if (proposal.status === ProposalStatus.ACTIVE && proposal.votingEndsAt) {
    const endMs = Date.parse(proposal.votingEndsAt);
    if (!Number.isNaN(endMs) && Date.now() > endMs) {
      await finalizeProposal(id);
      proposal = (await getProposalById(id)) ?? proposal;
    }
  }
  if (proposal.status !== ProposalStatus.ACTIVE) {
    return { error: apiError(ErrorCode.VOTING_CLOSED, undefined, 409) } as const;
  }
  const now = Date.now();
  const startMs = proposal.votingStartsAt ? Date.parse(proposal.votingStartsAt) : null;
  const endMs = proposal.votingEndsAt ? Date.parse(proposal.votingEndsAt) : null;
  if (startMs && now < startMs) {
    return { error: apiError(ErrorCode.VOTING_CLOSED, "Voting has not started.", 409) } as const;
  }
  if (endMs && now > endMs) {
    return { error: apiError(ErrorCode.VOTING_CLOSED, "Voting has ended.", 409) } as const;
  }

  const holder = await lookupHolder(sessionAddress);
  if (!holder) {
    return { error: apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 403) } as const;
  }
  return { proposal, endMs } as const;
}

function recalcCounts(rows: { choice: unknown; total: unknown }[]) {
  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  for (const r of rows) {
    const total = Number(r.total ?? 0);
    if (r.choice === VoteChoice.FOR) votesFor = total;
    else if (r.choice === VoteChoice.AGAINST) votesAgainst = total;
    else if (r.choice === VoteChoice.ABSTAIN) votesAbstain = total;
  }
  return { votesFor, votesAgainst, votesAbstain };
}

/**
 * Compute the quorum achievement percentage (C3.3): total voted power relative
 * to the snapshot total supply. Reads supply best-effort; falls back to 0.
 */
async function computeQuorumAchieved(
  votesFor: number,
  votesAgainst: number,
  votesAbstain: number,
): Promise<number> {
  const totalVotesPower = votesFor + votesAgainst + votesAbstain;
  let totalSupply = 0;
  try {
    const meta = await getSnapshotMetadataTyped();
    // CRITICAL: totalSupply is raw WEI, divide by 1e18 for TOKEN units to match votes
    totalSupply = Number(meta?.totalSupply ? meta.totalSupply / 10n ** 18n : 0n);
  } catch {
    totalSupply = 0;
  }
  return totalSupply > 0 ? (totalVotesPower / totalSupply) * 100 : 0;
}

/** POST /api/v1/proposals/[id]/votes — cast a new vote. */
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
  const { id } = await params;
  const voterAddress = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = castVoteSchema.safeParse({
    ...(body as Record<string, unknown>),
    proposalId: id,
  });
  if (!parsed.success) {
    return apiError(ErrorCode.INVALID_CHOICE, parsed.error.issues[0]?.message, 400);
  }
  const choice = parsed.data.choice;

  // P1-1: Per-user vote-cast rate limit (fail-closed in production).
  const voteRl = await checkRateLimit(
    userActionBucket("vote", voterAddress),
    VOTE_RATE_LIMIT.limit,
    VOTE_RATE_LIMIT.windowSeconds,
    true, // failClosed: protect governance integrity
  );
  if (!voteRl.allowed) {
    return apiError(
      ErrorCode.RATE_LIMITED,
      "Too many vote attempts. Please slow down.",
      429,
    );
  }

  const ctx = await loadContext(id, voterAddress);
  if ("error" in ctx) return ctx.error;

  // CRITICAL: Recompute voting power from the immutable snapshot at cast time.
  // Do NOT use session.votingPower (stale from JWT) — must reflect current snapshot.
  const holder = await lookupHolder(voterAddress);
  if (!holder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, "Voter not found in snapshot", 403);
  }
  const votingPower = Number(BigInt(holder.balanceRaw) / BigInt(1e18));

  // Check for an existing vote first (the DB UNIQUE constraint is the backstop).
  const existing = await db.execute({
    sql: "SELECT id FROM votes WHERE proposal_id = ? AND voter_address = ?",
    args: [id, voterAddress],
  });
  if (existing.rows.length > 0) {
    return apiError(ErrorCode.ALREADY_VOTED, undefined, 409);
  }

  let voteId: string;
  try {
    const insert = await db.execute({
      sql:
        "INSERT INTO votes (proposal_id, voter_address, choice, voting_power) VALUES (?, ?, ?, ?) " +
        "RETURNING id, created_at",
      args: [id, voterAddress, choice, votingPower],
    });
    voteId = insert.rows[0]!.id as string;
  } catch {
    // UNIQUE constraint caught a race — treat as already voted.
    return apiError(ErrorCode.ALREADY_VOTED, undefined, 409);
  }

  // Recompute denormalized tallies + quorum achievement on the proposal (C3.3).
  const tally = await db.execute({
    sql: "SELECT choice, SUM(voting_power) AS total FROM votes WHERE proposal_id = ? GROUP BY choice",
    args: [id],
  });
  const counts = recalcCounts(tally.rows as unknown as { choice: unknown; total: unknown }[]);
  const quorumAchieved = await computeQuorumAchieved(
    counts.votesFor,
    counts.votesAgainst,
    counts.votesAbstain,
  );
  await db.execute({
    sql: "UPDATE proposals SET votes_for = ?, votes_against = ?, votes_abstain = ?, quorum_achieved = ? WHERE id = ?",
    args: [counts.votesFor, counts.votesAgainst, counts.votesAbstain, quorumAchieved, id],
  });

  const vote: Vote = {
    id: voteId,
    proposalId: id,
    voterAddress,
    choice,
    votingPower,
    createdAt: new Date().toISOString(),
    txHash: null,
  };

  const outgoing = await getOutgoingDelegation(voterAddress);
  const isOverride = outgoing !== null && effectiveStatus(outgoing) === "active";

  const data: VoteResponseData = {
    vote,
    proposal: counts,
    delegation: { outgoing, isOverride },
  };
  return apiSuccess<VoteResponseData>(data, undefined, 201);
}

/** PUT /api/v1/proposals/[id]/votes — change an existing vote (while voting is open). */
export async function PUT(
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
  const { id } = await params;
  const voterAddress = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = castVoteSchema.safeParse({
    ...(body as Record<string, unknown>),
    proposalId: id,
  });
  if (!parsed.success) {
    return apiError(ErrorCode.INVALID_CHOICE, parsed.error.issues[0]?.message, 400);
  }
  const choice = parsed.data.choice;

  const ctx = await loadContext(id, voterAddress);
  if ("error" in ctx) return ctx.error;

  // H-01: Rate limit vote changes to prevent abuse
  const voteRl = await checkRateLimit(
    userActionBucket("vote-change", voterAddress),
    VOTE_RATE_LIMIT.limit,
    VOTE_RATE_LIMIT.windowSeconds,
    true, // failClosed: protect governance integrity
  );
  if (!voteRl.allowed) {
    return apiError(
      ErrorCode.RATE_LIMITED,
      "Too many vote changes. Please slow down.",
      429,
    );
  }

  const existing = await db.execute({
    sql: "SELECT id, created_at FROM votes WHERE proposal_id = ? AND voter_address = ?",
    args: [id, voterAddress],
  });
  if (existing.rows.length === 0) {
    return apiError(ErrorCode.ALREADY_VOTED, "No existing vote to change.", 409);
  }
  const voteId = existing.rows[0]!.id as string;

  // CRITICAL: Recompute voting power from snapshot at vote-change time.
  // Do NOT use session.votingPower (stale from JWT).
  const holder = await lookupHolder(voterAddress);
  if (!holder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, "Voter not found in snapshot", 403);
  }
  const votingPower = Number(BigInt(holder.balanceRaw) / BigInt(1e18));

  await db.execute({
    sql: "UPDATE votes SET choice = ?, voting_power = ? WHERE id = ?",
    args: [choice, votingPower, voteId],
  });

  const tally = await db.execute({
    sql: "SELECT choice, SUM(voting_power) AS total FROM votes WHERE proposal_id = ? GROUP BY choice",
    args: [id],
  });
  const counts = recalcCounts(tally.rows as unknown as { choice: unknown; total: unknown }[]);
  const quorumAchieved = await computeQuorumAchieved(
    counts.votesFor,
    counts.votesAgainst,
    counts.votesAbstain,
  );
  await db.execute({
    sql: "UPDATE proposals SET votes_for = ?, votes_against = ?, votes_abstain = ?, quorum_achieved = ? WHERE id = ?",
    args: [counts.votesFor, counts.votesAgainst, counts.votesAbstain, quorumAchieved, id],
  });

  const vote: Vote = {
    id: voteId,
    proposalId: id,
    voterAddress,
    choice,
    votingPower,
    createdAt: existing.rows[0]!.created_at as string,
    txHash: null,
  };

  const outgoing = await getOutgoingDelegation(voterAddress);
  const isOverride = outgoing !== null && effectiveStatus(outgoing) === "active";

  const data: VoteResponseData = {
    vote,
    proposal: counts,
    delegation: { outgoing, isOverride },
  };
  return apiSuccess<VoteResponseData>(data);
}
