/**
 * Foundational governance election domain logic.
 *
 * Election rule: every wallet in the pinned ever-held snapshot receives exactly
 * one immutable ballot. The election runs for 14 days from its configured
 * start timestamp.
 */

export const ELECTION_KEY = "foundational-2026";
export const ELECTION_DURATION_DAYS = 14;

/**
 * FGE timing — pinned at deploy time so the homepage countdown doesn't need
 * an extra API call (homepage is public; the live endpoint is auth-gated).
 * These MUST stay in lockstep with the values pinned in the prod Turso
 * `governance_election` row by `scripts/seed-db.ts`. If the election is
 * ever rebalanced, redeploy with updated values.
 */
export const FGE_VOTING_STARTS_AT = "2026-08-29T00:00:00.000Z";
export const FGE_VOTING_ENDS_AT = "2026-09-12T00:00:00.000Z";

export const ELECTION_CHOICES = [
  "QUADRATIC",
  "ONE_WALLET_ONE_VOTE",
  "TIERED",
  "LINEAR",
] as const;

export type ElectionChoice = (typeof ELECTION_CHOICES)[number];

export const ELECTION_CHOICE_LABELS: Record<ElectionChoice, string> = {
  QUADRATIC: "Quadratic voting",
  ONE_WALLET_ONE_VOTE: "One wallet, one vote",
  TIERED: "Tiered voting",
  LINEAR: "Linear token voting",
};

export const ELECTION_CHOICE_DESCRIPTIONS: Record<ElectionChoice, string> = {
  QUADRATIC:
    "Voting power is the square root of snapshot token balance. Larger holders still carry more weight, but influence grows much more slowly than token count.",
  ONE_WALLET_ONE_VOTE:
    "Every eligible snapshot wallet casts one equal vote regardless of token balance.",
  TIERED:
    "Seven cohorts (kraken through seahorse) each receive a fixed voting block, requiring cross-cohort support to pass proposals.",
  LINEAR:
    "Keep one token = one vote. Voting power remains exactly proportional to snapshot token balance.",
};

export function isElectionChoice(value: unknown): value is ElectionChoice {
  return (
    typeof value === "string" &&
    (ELECTION_CHOICES as readonly string[]).includes(value)
  );
}

export function electionPhase(
  now: Date,
  startsAt: Date,
  endsAt: Date,
): "UPCOMING" | "OPEN" | "CLOSED" {
  if (now < startsAt) return "UPCOMING";
  if (now <= endsAt) return "OPEN";
  return "CLOSED";
}

export function percentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return (count / total) * 100;
}
