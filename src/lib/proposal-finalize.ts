import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { getSnapshotMetadataTyped } from "@/lib/snapshot";
import { notifyVoteResult } from "@/lib/notifications";
import {
  ProposalStatus,
} from "@/types";

/**
 * Proposal finalization service.
 *
 * Handles the transition of proposals from ACTIVE → terminal states
 * (PASSED / FAILED / EXPIRED) when their voting window closes.
 *
 * Enforces:
 *   - Quorum: (totalFor + totalAgainst + totalAbstain) / totalSupply × 100 ≥ quorumRequired
 *   - Simple majority (Treasury, Guideline, General): totalFor > totalAgainst
 *   - Supermajority (Chain Selection, Tokenomics Change, Technical):
 *     totalFor / (totalFor + totalAgainst) ≥ 0.60
 *
 * If quorum is not met → EXPIRED.
 * If quorum is met but threshold is not met → FAILED.
 * If quorum and threshold are met → PASSED.
 *
 * This service is called from:
 *   1. The cron endpoint (POST /api/v1/cron/finalize) — batch sweeps expired proposals.
 *   2. Lazily from GET /api/v1/proposals/[id] — when a single proposal is viewed
 *      after its voting window has ended but hasn't been finalized yet.
 */

/** Proposal types that require a 60% supermajority to pass. */
const SUPERMAJORITY_TYPES = new Set([
  "CHAIN_SELECTION",
  "TOKENOMICS_CHANGE",
  "TECHNICAL",
]);

/** Supermajority threshold: FOR must be ≥ this fraction of (FOR + AGAINST). */
const SUPERMAJORITY_FRACTION = 0.60;

export interface FinalizeResult {
  proposalId: string;
  previousStatus: ProposalStatus;
  newStatus: ProposalStatus;
  reason: string;
  quorumAchieved: number;
  quorumRequired: number;
  passed: boolean;
}

/**
 * Finalize a single proposal if its voting window has elapsed.
 *
 * Returns the result of finalization, or null if the proposal is not
 * in a finalizable state (not ACTIVE, or voting window still open).
 */
export async function finalizeProposal(
  proposalId: string,
): Promise<FinalizeResult | null> {
  const proposal = await getProposalById(proposalId);
  if (!proposal) return null;
  if (proposal.status !== ProposalStatus.ACTIVE) return null;

  // Check if voting window has ended.
  if (!proposal.votingEndsAt) return null;
  const endMs = Date.parse(proposal.votingEndsAt);
  if (Number.isNaN(endMs)) return null;
  if (Date.now() < endMs) return null; // still active

  // Compute tallies from the votes table.
  const tally = await db.execute({
    sql: "SELECT choice, SUM(voting_power) AS total FROM votes WHERE proposal_id = ? GROUP BY choice",
    args: [proposalId],
  });

  let votesFor = 0;
  let votesAgainst = 0;
  let votesAbstain = 0;
  for (const row of tally.rows) {
    const total = Number(row.total ?? 0);
    if (row.choice === "FOR") votesFor = total;
    else if (row.choice === "AGAINST") votesAgainst = total;
    else if (row.choice === "ABSTAIN") votesAbstain = total;
  }

  // Compute quorum achieved.
  const totalVotedPower = votesFor + votesAgainst + votesAbstain;
  let totalSupply = 0;
  try {
    const meta = await getSnapshotMetadataTyped();
    // CRITICAL: totalSupply is raw WEI, divide by 1e18 for TOKEN units to match votes
    totalSupply = Number(meta.totalSupply ? meta.totalSupply / 10n ** 18n : 0n);
  } catch {
    totalSupply = 0;
  }
  const quorumAchieved = totalSupply > 0
    ? (totalVotedPower / totalSupply) * 100
    : 0;

  const quorumMet = quorumAchieved >= proposal.quorumRequired;

  // Determine pass/fail based on type.
  let thresholdMet = false;
  let reason: string;

  if (!quorumMet) {
    // Quorum not met → EXPIRED.
    await db.execute({
      sql: "UPDATE proposals SET status = ?, quorum_achieved = ?, votes_for = ?, votes_against = ?, votes_abstain = ?, updated_at = datetime('now') WHERE id = ?",
      args: [ProposalStatus.EXPIRED, quorumAchieved, votesFor, votesAgainst, votesAbstain, proposalId],
    });
    reason = `Quorum not met: ${quorumAchieved.toFixed(2)}% of ${proposal.quorumRequired}% required.`;
    const result: FinalizeResult = {
      proposalId,
      previousStatus: ProposalStatus.ACTIVE,
      newStatus: ProposalStatus.EXPIRED,
      reason,
      quorumAchieved,
      quorumRequired: proposal.quorumRequired,
      passed: false,
    };
    void notifyVoteResult(proposalId).catch((err) =>
      console.error("[finalize] notifyVoteResult error:", err),
    );
    return result;
  }

  if (SUPERMAJORITY_TYPES.has(proposal.type)) {
    // Supermajority: FOR / (FOR + AGAINST) ≥ 0.60
    const decisivePower = votesFor + votesAgainst;
    thresholdMet = decisivePower > 0 && (votesFor / decisivePower) >= SUPERMAJORITY_FRACTION;
    reason = thresholdMet
      ? `Passed: ${((votesFor / decisivePower) * 100).toFixed(1)}% FOR (supermajority ≥60% required).`
      : `Failed: ${((votesFor / decisivePower) * 100).toFixed(1)}% FOR (supermajority ≥60% required).`;
  } else {
    // Simple majority: FOR > AGAINST.
    thresholdMet = votesFor > votesAgainst;
    reason = thresholdMet
      ? `Passed: simple majority (${votesFor} FOR vs ${votesAgainst} AGAINST).`
      : `Failed: simple majority not reached (${votesFor} FOR vs ${votesAgainst} AGAINST).`;
  }

  const newStatus = thresholdMet ? ProposalStatus.PASSED : ProposalStatus.FAILED;

  await db.execute({
    sql: "UPDATE proposals SET status = ?, quorum_achieved = ?, votes_for = ?, votes_against = ?, votes_abstain = ?, updated_at = datetime('now') WHERE id = ?",
    args: [newStatus, quorumAchieved, votesFor, votesAgainst, votesAbstain, proposalId],
  });

  const result: FinalizeResult = {
    proposalId,
    previousStatus: ProposalStatus.ACTIVE,
    newStatus,
    reason,
    quorumAchieved,
    quorumRequired: proposal.quorumRequired,
    passed: thresholdMet,
  };

  void notifyVoteResult(proposalId).catch((err) =>
    console.error("[finalize] notifyVoteResult error:", err),
  );

  return result;
}

/**
 * Sweep all ACTIVE proposals whose voting window has ended and finalize them.
 * Called by the cron endpoint.
 *
 * Returns the list of finalized proposals.
 */
export async function finalizeExpiredProposals(): Promise<FinalizeResult[]> {
  // Find all ACTIVE proposals past their voting end time.
  const res = await db.execute({
    sql: "SELECT id FROM proposals WHERE status = 'ACTIVE' AND voting_ends_at IS NOT NULL AND voting_ends_at < datetime('now')",
    args: [],
  });

  const results: FinalizeResult[] = [];
  for (const row of res.rows) {
    const id = row.id as string;
    try {
      const result = await finalizeProposal(id);
      if (result) results.push(result);
    } catch (err) {
      console.error(`[finalize] Error finalizing proposal ${id}:`, err);
    }
  }

  if (results.length > 0) {
    console.log(`[finalize] Finalized ${results.length} proposal(s):`,
      results.map((r) => `${r.proposalId} → ${r.newStatus}`),
    );
  }

  return results;
}
