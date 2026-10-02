/**
 * Wave 1 Referendum loader.
 *
 * The referendum is THREE simultaneous GENERAL proposals (one per rulebook
 * question) sharing a single 30-day window, tagged in metadata:
 *   { referendum: "wave1-2026", referendumQuestion: 1|2|3 }
 * (seeded by scripts/seed-referendum.ts — decision record:
 * DOCS/REFERENDUM-WAVE1.md). This loader groups them for the /vote hub so the
 * page can present one campaign: shared header, countdown, and turnout stats,
 * then one ballot section per question.
 *
 * Active-by-design: called from the force-dynamic /vote page only, never from
 * a prerendered route.
 */
import { listProposals } from "@/lib/proposal-service";
import { ProposalStatus, type Proposal } from "@/types";

/** Metadata tag shared by every ballot of the current referendum. */
export const REFERENDUM_KEY = "wave1-2026";

function referendumTag(p: Proposal): string | undefined {
  return p.metadata.type === "base" ? p.metadata.referendum : undefined;
}

function referendumQuestionNumber(p: Proposal): number {
  return p.metadata.type === "base" ? (p.metadata.referendumQuestion ?? 0) : 0;
}

/** One referendum: the question ballots in order, plus the shared window. */
export interface Referendum {
  key: string;
  /** Ballots ordered by `referendumQuestion` ascending (Q1, Q2, Q3). */
  proposals: Proposal[];
  /** Earliest voting start across the ballots (null when unset). */
  startsAt: string | null;
  /** Latest voting end across the ballots (null when unset). */
  endsAt: string | null;
  /**
   * Cache-buster for shared links (`?v=<shareVersion>`). Link previews are
   * cached per exact URL, so every campaign must share a URL the platforms
   * have never crawled: wave N's /vote card is revision N + 1 (the Week 1
   * vote was the unversioned v1) — wave1 → ?v=2, wave2 → ?v=3, forever
   * automatic. Keep in sync with the links in the announcement copy pack.
   */
  shareVersion: string;
}

export interface ReferendumHub {
  referendum: Referendum | null;
  /** ACTIVE proposals outside the referendum ("also voting now" strip). */
  others: Proposal[];
  /** Total ACTIVE proposals, for the legacy layout's "N more" note. */
  total: number;
}

/**
 * Load the ACTIVE referendum (if any) plus every other ACTIVE proposal.
 * Never throws on shape surprises: a proposal without base metadata simply
 * isn't part of the referendum.
 */
export async function loadReferendum(): Promise<ReferendumHub> {
  const { proposals, total } = await listProposals({
    status: ProposalStatus.ACTIVE,
    sortBy: "votingStartsAt",
    sortOrder: "desc",
    limit: 50,
    offset: 0,
  });

  const inReferendum = proposals.filter((p) => referendumTag(p) === REFERENDUM_KEY);
  if (inReferendum.length === 0) {
    return { referendum: null, others: proposals, total };
  }

  inReferendum.sort((a, b) => referendumQuestionNumber(a) - referendumQuestionNumber(b));

  const starts = inReferendum
    .map((p) => p.votingStartsAt)
    .filter((v): v is string => Boolean(v))
    .sort();
  const ends = inReferendum
    .map((p) => p.votingEndsAt)
    .filter((v): v is string => Boolean(v))
    .sort();

  return {
    referendum: {
      key: REFERENDUM_KEY,
      proposals: inReferendum,
      startsAt: starts[0] ?? null,
      endsAt: ends[ends.length - 1] ?? null,
      shareVersion: shareVersionForKey(REFERENDUM_KEY),
    },
    others: proposals.filter((p) => referendumTag(p) !== REFERENDUM_KEY),
    total,
  };
}

/**
 * "Wave 1 Referendum · Question 2: Pass threshold" → "Pass threshold".
 * Falls back to the full title for anything that doesn't match the seeded
 * convention, so a renamed proposal still renders.
 */
export function referendumQuestionLabel(title: string): string {
  const match = /^Wave 1 Referendum · Question \d+:\s*(.+)$/.exec(title);
  return match?.[1]?.trim() ?? title;
}

/**
 * "wave1-2026" → "2" (wave number + 1 — see Referendum.shareVersion). A key
 * without a wave number falls back to the campaign end date, still unique
 * per campaign.
 */
export function shareVersionForKey(key: string): string {
  const wave = /wave(\d+)/.exec(key)?.[1];
  if (wave) return String(Number(wave) + 1);
  return key.replace(/\D/g, "") || "1";
}
