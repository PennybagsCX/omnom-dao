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
  isElectionChoice,
  percentage,
  type ElectionChoice,
} from "@/lib/election";
import { lookupHolderClasses } from "@/lib/snapshot";
import { HolderClass } from "@/types";

/**
 * Foundational Governance Election tally helpers.
 *
 * Extracted verbatim from `src/app/api/v1/governance-vote/route.ts` so
 * server components (the public /results page) reuse the exact tallies the
 * API reports instead of duplicating counting logic. The route remains a
 * consumer; behavior is unchanged.
 */

export interface ElectionRow {
  election_key: string;
  title: string;
  voting_starts_at: string;
  voting_ends_at: string;
  eligible_wallet_count: number;
}

export interface ChoiceResult {
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

export async function loadElection(): Promise<ElectionRow | null> {
  const res = await db.execute({
    sql: `SELECT election_key, title, voting_starts_at, voting_ends_at, eligible_wallet_count
          FROM governance_election WHERE election_key = ?`,
    args: [ELECTION_KEY],
  });
  const row = res.rows[0] as ElectionRow | undefined;
  return row ?? null;
}

export async function tally(): Promise<Map<ElectionChoice, number>> {
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

export function buildResults(counts: Map<ElectionChoice, number>, total: number): ChoiceResult[] {
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
export async function tallyByHolderClass(): Promise<HolderClassTally[]> {
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
