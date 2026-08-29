import { type NextRequest, NextResponse } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DISTRIBUTION_KEY,
  HOLDER_CLASS_CONFIG,
  HOLDER_CLASS_ORDER,
  SNAPSHOT,
} from "@/lib/constants";
import {
  ELECTION_CHOICES,
  ELECTION_CHOICE_LABELS,
  ELECTION_KEY,
  electionPhase,
  isElectionChoice,
  percentage,
  type ElectionChoice,
} from "@/lib/election";
import {
  isSnapshotIntegrityVerified,
  lookupHolder,
  lookupHolderClasses,
} from "@/lib/snapshot";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { ErrorCode, HolderClass } from "@/types";

/**
 * Foundational Governance Election.
 *
 * GET  /api/v1/governance-vote — public election status and results.
 * POST /api/v1/governance-vote — cast or update the voter's ballot until close.
 *
 * Eligibility and one-ballot enforcement:
 *   1. Wallet must be SIWE-verified (`requireAuth`).
 *   2. Wallet must appear in the pinned ever-held snapshot.
 *   3. A UNIQUE(election_key, voter_address) identifies each voter's active ballot.
 *   4. Ballots may be changed until the election closes.
 *   5. Every cast/update is retained in a ballot-event audit trail.
 */

interface ChoiceResult {
  choice: ElectionChoice;
  label: string;
  count: number;
  percentage: number;
}

/**
 * Per-holder-class turnout breakdown. Each entry reports how many of the
 * eligible wallets in that class have voted, the class turnout %, and the
 * per-method breakdown of those ballots. Excludes the deprecated
 * `HolderClass.FISH` alias — legacy JWT-classified wallets are bucketed into
 * SEAHORSE (their rank-equivalent).
 */
export interface HolderClassTally {
  holderClass: HolderClass;
  label: string;
  emoji: string;
  count: number;
  eligibleCount: number;
  turnoutPercentage: number;
  byChoice: Array<{
    choice: ElectionChoice;
    label: string;
    count: number;
    percentage: number;
  }>;
}

interface ElectionData {
  electionKey: string;
  title: string;
  phase: "UPCOMING" | "OPEN" | "CLOSED";
  startsAt: string;
  endsAt: string;
  eligibleWalletCount: number;
  totalBallots: number;
  turnoutPercentage: number;
  results: ChoiceResult[];
  userChoice: ElectionChoice | null;
  userEligible: boolean;
  ballotsByHolderClass: HolderClassTally[];
}

interface ElectionRow {
  election_key: string;
  title: string;
  voting_starts_at: string;
  voting_ends_at: string;
  eligible_wallet_count: number;
}

async function loadElection(): Promise<ElectionRow | null> {
  const res = await db.execute({
    sql: `SELECT election_key, title, voting_starts_at, voting_ends_at, eligible_wallet_count
          FROM governance_election WHERE election_key = ?`,
    args: [ELECTION_KEY],
  });
  const row = res.rows[0] as ElectionRow | undefined;
  return row ?? null;
}

async function tally(): Promise<Map<ElectionChoice, number>> {
  const res = await db.execute({
    sql: `SELECT choice, COUNT(*) AS cnt FROM governance_election_ballots
          WHERE election_key = ? GROUP BY choice`,
    args: [ELECTION_KEY],
  });
  const counts = new Map<ElectionChoice, number>();
  for (const choice of ELECTION_CHOICES) counts.set(choice, 0);
  for (const row of res.rows) {
    const choice = row.choice as ElectionChoice;
    if (isElectionChoice(choice)) {
      counts.set(choice, Number(row.cnt ?? 0));
    }
  }
  return counts;
}

function buildResults(counts: Map<ElectionChoice, number>, total: number): ChoiceResult[] {
  return ELECTION_CHOICES.map((choice) => ({
    choice,
    label: ELECTION_CHOICE_LABELS[choice],
    count: counts.get(choice) ?? 0,
    percentage: percentage(counts.get(choice) ?? 0, total),
  }));
}

/**
 * Returns one `HolderClassTally` per canonical holder class (KRAKEN →
 * SEAHORSE). Derives each voter's class from the snapshot via
 * `lookupHolderClasses` (in-memory O(1) lookups after warm-up) and buckets
 * ballots by `(class × choice)`. WALL-09 / KRAKEN counts are tiny so we
 * never log individual voter addresses.
 *
 * Defensive fallback: wallets not in the snapshot (which the POST endpoint
 * already gates on) are bucketed into SEAHORSE with a console warning rather
 * than dropped — losing ballots silently is worse than a noisy log.
 */
async function tallyByHolderClass(): Promise<HolderClassTally[]> {
  const res = await db.execute({
    sql: `SELECT voter_address, choice FROM governance_election_ballots
          WHERE election_key = ?`,
    args: [ELECTION_KEY],
  });

  const addresses = res.rows.map((r) => (r.voter_address as string).toLowerCase());
  const classesByAddress = await lookupHolderClasses(addresses);

  // Initialize 7 buckets (one per canonical class). The deprecated FISH alias
  // is collapsed into SEAHORSE to avoid surfacing stale rank names.
  const buckets = new Map<HolderClass, Map<ElectionChoice, number>>();
  for (const cls of HOLDER_CLASS_ORDER) {
    buckets.set(cls, new Map(ELECTION_CHOICES.map((c) => [c, 0])));
  }
  const seahorseBucket = buckets.get(HolderClass.SEAHORSE)!;

  let orphans = 0;
  for (const row of res.rows) {
    const address = (row.voter_address as string).toLowerCase();
    const choice = row.choice as ElectionChoice;
    const cls = classesByAddress.get(address) ?? null;
    if (!isElectionChoice(choice)) continue;
    if (cls === null || cls === HolderClass.FISH) {
      // FISH → SEAHORSE (legacy alias); null → defensive SEAHORSE fallback.
      seahorseBucket.set(choice, (seahorseBucket.get(choice) ?? 0) + 1);
      if (cls === null) orphans++;
    } else if (buckets.has(cls)) {
      buckets.get(cls)!.set(choice, (buckets.get(cls)!.get(choice) ?? 0) + 1);
    } else {
      // Unknown enum value (defensive — should not happen).
      seahorseBucket.set(choice, (seahorseBucket.get(choice) ?? 0) + 1);
      orphans++;
    }
  }
  if (orphans > 0) {
    console.warn(
      `[governance-vote] ${orphans} ballot(s) had addresses not in the snapshot; bucketed into SEAHORSE.`,
    );
  }

  return HOLDER_CLASS_ORDER.map((cls) => {
    const cfg = HOLDER_CLASS_CONFIG[cls];
    const perChoice = buckets.get(cls)!;
    const classCount = [...perChoice.values()].reduce((sum, n) => sum + n, 0);
    const eligibleCount =
      SNAPSHOT.expectedDistribution[DISTRIBUTION_KEY[cls]] ?? 0;
    return {
      holderClass: cls,
      label: cfg.label,
      emoji: cfg.emoji,
      count: classCount,
      eligibleCount,
      turnoutPercentage: percentage(classCount, eligibleCount),
      byChoice: ELECTION_CHOICES.map((choice) => ({
        choice,
        label: ELECTION_CHOICE_LABELS[choice],
        count: perChoice.get(choice) ?? 0,
        percentage: percentage(perChoice.get(choice) ?? 0, classCount),
      })),
    };
  });
}

export async function GET(request: NextRequest) {
  const includeViewer = request.nextUrl.searchParams.get("me") === "true";
  const election = await loadElection();
  if (!election) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Election not configured.", 404);
  }

  const now = new Date();
  const startsAt = new Date(election.voting_starts_at);
  const endsAt = new Date(election.voting_ends_at);
  const phase = electionPhase(now, startsAt, endsAt);
  const counts = await tally();
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  let userChoice: ElectionChoice | null = null;
  let userEligible = false;
  if (includeViewer) {
    try {
      const session = await requireAuth();
      const address = session.sub.toLowerCase();
      userEligible = (await lookupHolder(address)) !== null;
      const ballot = await db.execute({
        sql: `SELECT choice FROM governance_election_ballots
              WHERE election_key = ? AND voter_address = ?`,
        args: [ELECTION_KEY, address],
      });
      const choice = ballot.rows[0]?.choice;
      if (isElectionChoice(choice)) userChoice = choice;
    } catch {
      // Anonymous viewer.
    }
  }

  const ballotsByHolderClass = await tallyByHolderClass();

  const data: ElectionData = {
    electionKey: election.election_key,
    title: election.title,
    phase,
    startsAt: election.voting_starts_at,
    endsAt: election.voting_ends_at,
    eligibleWalletCount: election.eligible_wallet_count,
    totalBallots: total,
    turnoutPercentage: percentage(total, election.eligible_wallet_count),
    results: buildResults(counts, total),
    userChoice,
    userEligible,
    ballotsByHolderClass,
  };
  return apiSuccess<ElectionData>(data);
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(err.code, undefined, err.statusCode);
    }
    throw err;
  }

  const voterAddress = session.sub.toLowerCase();

  // CRITICAL: Refuse ballots when snapshot integrity verification failed
  if (process.env.NODE_ENV === "production") {
    const integrityVerified = isSnapshotIntegrityVerified();
    if (integrityVerified === false) {
      return apiError(
        ErrorCode.INTERNAL_ERROR,
        "Governance is temporarily disabled due to snapshot integrity issues. Contact administrators.",
        503,
      );
    }
  }

  // H-01: Rate limit ballot updates to prevent audit-trail flooding and DoS
  const rl = await checkRateLimit(
    userActionBucket("election-vote", voterAddress),
    10, // max 10 attempts
    5 * 60, // per 5 minutes
    true, // failClosed - protect governance integrity
  );
  if (!rl.allowed) {
    return apiError(
      ErrorCode.RATE_LIMITED,
      "Too many ballot updates. Try again shortly.",
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const choice = (body as { choice?: unknown })?.choice;
  if (!isElectionChoice(choice)) {
    return apiError(
      ErrorCode.MISSING_FIELDS,
      `Invalid choice. Must be one of: ${ELECTION_CHOICES.join(", ")}`,
      400,
    );
  }

  const election = await loadElection();
  if (!election) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Election not configured.", 404);
  }

  const now = new Date();
  const phase = electionPhase(
    now,
    new Date(election.voting_starts_at),
    new Date(election.voting_ends_at),
  );
  if (phase !== "OPEN") {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      phase === "UPCOMING"
        ? "The election has not opened yet."
        : "The election voting window has closed, so ballots can no longer be changed.",
      409,
    );
  }

  const holder = await lookupHolder(voterAddress);
  if (!holder) {
    return apiError(
      ErrorCode.NOT_IN_SNAPSHOT,
      "Only wallets in the pinned ever-held snapshot may vote.",
      403,
    );
  }

  const existingRes = await db.execute({
    sql: `SELECT choice FROM governance_election_ballots
          WHERE election_key = ? AND voter_address = ?`,
    args: [ELECTION_KEY, voterAddress],
  });
  const isChange = existingRes.rows.length > 0;

  if (isChange) {
    await db.execute({
      sql: `UPDATE governance_election_ballots
            SET choice = ?, cast_at = datetime('now')
            WHERE election_key = ? AND voter_address = ?`,
      args: [choice, ELECTION_KEY, voterAddress],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO governance_election_ballots (election_key, voter_address, choice, cast_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(election_key, voter_address) DO NOTHING`,
      args: [ELECTION_KEY, voterAddress, choice],
    });
  }

  const activeRes = await db.execute({
    sql: `SELECT choice FROM governance_election_ballots
          WHERE election_key = ? AND voter_address = ?`,
    args: [ELECTION_KEY, voterAddress],
  });
  const activeChoice = activeRes.rows[0]?.choice;
  if (!isElectionChoice(activeChoice)) {
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      "The ballot could not be confirmed after saving. Please retry.",
      500,
    );
  }

  await db.execute({
    sql: `INSERT INTO governance_election_ballot_events
          (election_key, voter_address, choice, event)
          VALUES (?, ?, ?, ?)`,
    args: [ELECTION_KEY, voterAddress, choice, isChange ? "CHANGE" : "CAST"],
  });

  const counts = await tally();
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const ballotsByHolderClass = await tallyByHolderClass();
  const data: ElectionData = {
    electionKey: election.election_key,
    title: election.title,
    phase,
    startsAt: election.voting_starts_at,
    endsAt: election.voting_ends_at,
    eligibleWalletCount: election.eligible_wallet_count,
    totalBallots: total,
    turnoutPercentage: percentage(total, election.eligible_wallet_count),
    results: buildResults(counts, total),
    userChoice: activeChoice,
    userEligible: true,
    ballotsByHolderClass,
  };
  return apiSuccess<ElectionData>(data);
}

/** HEAD support for lightweight uptime checks. */
export async function HEAD() {
  const election = await loadElection();
  return new NextResponse(null, { status: election ? 200 : 404 });
}
