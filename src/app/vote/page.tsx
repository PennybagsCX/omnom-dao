import type { Metadata } from "next";
import Link from "next/link";
import { History, Vote as VoteIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  LiveVoteCard,
  type LiveVoteProps,
} from "@/components/vote/live-vote-card";
import {
  PastVotesArchive,
  type PastVoteItem,
} from "@/components/vote/past-votes-archive";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { FGE_VOTING_ENDS_AT, FGE_VOTING_STARTS_AT } from "@/lib/election";
import { buildResults, loadElection, tally } from "@/lib/election-tally";
import { listFinalizedProposals, listProposals } from "@/lib/proposal-service";
import { ProposalStatus, type Proposal } from "@/types";

/** Live voting data — rendered per request, never prerendered at build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vote",
  description:
    "Live OMNOM DAO governance votes and the full archive of past decisions — every outcome, tally, and quorum, open to everyone.",
  alternates: { canonical: "/vote" },
  openGraph: {
    title: "Vote · OMNOM DAO",
    description:
      "Live governance votes and the full archive of past OMNOM DAO decisions.",
    url: "/vote",
  },
};

/** UTC keeps the public window dates identical regardless of server locale. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function proposalWindowLabel(p: Proposal): string | null {
  if (p.votingStartsAt && p.votingEndsAt) {
    return `${formatDay(p.votingStartsAt)} – ${formatDay(p.votingEndsAt)} (UTC)`;
  }
  return p.votingEndsAt ? `Closed ${formatDay(p.votingEndsAt)}` : null;
}

function toLiveVoteProps(p: Proposal): LiveVoteProps {
  return {
    id: p.id,
    title: p.title,
    typeLabel: PROPOSAL_TYPE_CONFIG[p.type]?.label ?? p.type,
    endsAt: p.votingEndsAt,
    votesFor: p.votesFor,
    votesAgainst: p.votesAgainst,
    votesAbstain: p.votesAbstain,
    quorumRequired: p.quorumRequired,
    description: p.description,
  };
}

function toPastVoteItem(p: Proposal): PastVoteItem {
  return {
    key: p.id,
    kind: "PROPOSAL",
    label: p.title,
    status: p.status,
    windowLabel: proposalWindowLabel(p),
    tallies: { for: p.votesFor, against: p.votesAgainst, abstain: p.votesAbstain },
    quorum: { achieved: p.quorumAchieved, required: p.quorumRequired },
    href: `/proposals/${p.id}`,
  };
}

export default async function VotePage() {
  // Soonest-ending live vote first. Bounded at 50 concurrent ACTIVE
  // proposals — far beyond this DAO's realistic throughput; each card also
  // drives one detail fetch in its embedded vote island.
  const { proposals: active } = await listProposals({
    status: ProposalStatus.ACTIVE,
    sortBy: "votingEndsAt",
    sortOrder: "asc",
    limit: 50,
    offset: 0,
  });
  const finalized = await listFinalizedProposals();

  // FGE — fall back to the pinned constants when the election row is missing
  // (same graceful degradation as /results; the row exists in prod and mock).
  const election = await loadElection();
  const startsAt = election?.voting_starts_at ?? FGE_VOTING_STARTS_AT;
  const endsAt = election?.voting_ends_at ?? FGE_VOTING_ENDS_AT;
  const counts = await tally();
  const totalBallots = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const electionResults = buildResults(counts, totalBallots).map((r) => ({
    choice: r.choice,
    label: r.label,
    count: r.count,
    percentage: r.percentage,
  }));

  // Flagship past vote first; then finalized proposals, newest window first
  // (listFinalizedProposals ordering).
  const pastItems: PastVoteItem[] = [
    {
      key: "fge-foundational-2026",
      kind: "ELECTION",
      label: "Foundational Governance Election",
      windowLabel: `${formatDay(startsAt)} – ${formatDay(endsAt)} (UTC)`,
      electionResults,
      totalBallots,
      href: "/governance-vote",
    },
    ...finalized.map(toPastVoteItem),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <VoteIcon className="h-6 w-6 text-gold" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Vote
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Every live vote, and the full record of every decision before it.
        </p>
      </header>

      {/* ── Section 1: live votes ───────────────────────────────────── */}
      <section aria-labelledby="live-votes-heading" className="mt-10">
        <h2
          id="live-votes-heading"
          className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
        >
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse-glow rounded-full bg-emerald-400" />
          Live now
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Voting is open — ballots are power-weighted (√ of snapshot balance),
          and results stay provisional until the window closes.
        </p>

        {active.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<VoteIcon className="h-12 w-12" />}
            title="No votes are live right now"
            description="When the next proposal enters its voting window, it appears here. Meanwhile, browse open proposals or look back at past outcomes."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/proposals"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold sm:min-h-9"
                >
                  Browse proposals
                </Link>
                <Link
                  href="/results"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold sm:min-h-9"
                >
                  View past outcomes
                </Link>
              </div>
            }
          />
        ) : (
          <div className="mt-4 space-y-6">
            {active.map((p) => (
              <LiveVoteCard key={p.id} {...toLiveVoteProps(p)} />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: past votes ───────────────────────────────────── */}
      <section aria-labelledby="past-votes-heading" className="mt-12">
        <h2
          id="past-votes-heading"
          className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl"
        >
          <History className="h-5 w-5 text-gold" aria-hidden />
          Past votes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every decided vote and how it ended — the Foundational Governance
          Election and all finalized proposals.
        </p>
        <PastVotesArchive items={pastItems} />
      </section>
    </div>
  );
}
