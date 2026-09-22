import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  History,
  Vote as VoteIcon,
} from "lucide-react";

import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import {
  ProposalBallotCards,
  ProposalVoteDiscussion,
  ProposalVoteResults,
} from "@/components/proposals/proposal-vote-actions";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { EmptyState } from "@/components/shared/empty-state";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { FGE_VOTING_ENDS_AT, FGE_VOTING_STARTS_AT } from "@/lib/election";
import { buildResults, loadElection, tally } from "@/lib/election-tally";
import { listFinalizedProposals, listProposals } from "@/lib/proposal-service";
import { formatDateTime } from "@/lib/utils";
import { totalQuadraticPower } from "@/lib/voting-power";
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

function formatWindowLabel(p: Proposal): string | null {
  if (p.votingStartsAt && p.votingEndsAt) {
    return `Voted ${formatDay(p.votingStartsAt)} – ${formatDay(p.votingEndsAt)}`;
  }
  return p.votingEndsAt ? `Closed ${formatDay(p.votingEndsAt)}` : null;
}

/** Collapse the markdown body to a plain-text teaser for the subtitle. */
function excerpt(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 220 ? `${plain.slice(0, 220).trimEnd()}…` : plain;
}

export default async function VotePage() {
  // The current vote: most recently OPENED ACTIVE proposal (voting starts at
  // admin approval, so voting_starts_at — not draft createdAt — is "current").
  // total drives the "more live votes" note.
  const { proposals, total } = await listProposals({
    status: ProposalStatus.ACTIVE,
    sortBy: "votingStartsAt",
    sortOrder: "desc",
    limit: 1,
    offset: 0,
  });
  const current = proposals[0] ?? null;

  // Past votes = proposals that actually went to a vote; admin-rejected rows
  // (FAILED without a voting window) stay on /results and /proposals.
  const finalized = (await listFinalizedProposals()).filter((p) => p.votingEndsAt);

  // FGE — fall back to the pinned constants when the election row is missing
  // (same graceful degradation as /results; the row exists in prod and mock).
  const election = await loadElection();
  const fgeStartsAt = election?.voting_starts_at ?? FGE_VOTING_STARTS_AT;
  const fgeEndsAt = election?.voting_ends_at ?? FGE_VOTING_ENDS_AT;
  const counts = await tally();
  const totalBallots = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const results = buildResults(counts, totalBallots);
  const winner =
    results.reduce<(typeof results)[number] | null>(
      (best, r) => (r.count > 0 && (best === null || r.count > best.count) ? r : best),
      null,
    ) ?? null;

  // Quorum denominator (cached per process) — powers the live turnout stat.
  // Degrade to 0 on artifact failure (same defense as the votes route and
  // finalize) so a snapshot problem can never 500 the hub.
  let totalPower = 0;
  try {
    totalPower = await totalQuadraticPower();
  } catch {
    // Stats read as zero turnout; the page still renders.
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {current ? (
        <>
          {/* Header — the live proposal, centered like the FGE page */}
          <div className="text-center">
            <div className="mb-2 flex flex-col items-center justify-center gap-2">
              <VoteIcon className="h-6 w-6 text-gold" aria-hidden />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ProposalStatusBadge status={ProposalStatus.ACTIVE} pulse />
                <span className="text-xs font-medium uppercase tracking-widest text-text-dim">
                  {PROPOSAL_TYPE_CONFIG[current.type]?.label ?? current.type}
                </span>
              </div>
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {current.title}
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              {excerpt(current.description)}
            </p>
          </div>

          {/* Countdown — same column and panel as the FGE page. Explicit
              closed-state text: the component default reads as stale copy. */}
          {current.votingEndsAt && (
            <div className="mx-auto mt-6 max-w-xl">
              <CountdownTimer
                target={current.votingEndsAt}
                label="Voting closes in"
                closedText="Voting closed — outcome pending"
                ariaLabel={`Voting closes in — ${current.title}`}
              />
            </div>
          )}

          {/* Stats — same gold grid as the FGE page */}
          <div className="mt-6 grid gap-3 rounded-xl border border-border bg-bg-elevated/40 p-4 text-center sm:grid-cols-3">
            <div>
              <div className="font-mono text-lg font-bold text-gold">
                {(current.votesFor + current.votesAgainst + current.votesAbstain).toLocaleString()}
              </div>
              <div className="text-xs text-text-dim">Voting power voted</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-gold">
                {totalPower > 0
                  ? (((current.votesFor + current.votesAgainst + current.votesAbstain) / totalPower) * 100).toFixed(1)
                  : "0.0"}
                %
              </div>
              <div className="text-xs text-text-dim">Turnout</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-gold">
                {current.quorumRequired}%
              </div>
              <div className="text-xs text-text-dim">Quorum required</div>
            </div>
          </div>

          {/* Status message — gated on the window still being open at render
              time so it can't contradict a closed countdown. */}
          {current.votingEndsAt &&
            new Date().getTime() < new Date(current.votingEndsAt).getTime() && (
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" aria-hidden />
                <span>voting closes</span> {formatDateTime(current.votingEndsAt)}
              </p>
            )}

          {/* Ballot — FGE choice cards, full template width */}
          <section aria-labelledby="cast-vote-heading" className="mt-8">
            <div className="mb-4 text-center">
              <h2 id="cast-vote-heading" className="text-xl font-bold text-foreground">
                Cast your ballot
              </h2>
              <p className="text-sm text-muted-foreground">
                FOR / AGAINST / ABSTAIN — one ballot per snapshot wallet,
                changeable until close. Abstentions count toward turnout.
              </p>
            </div>
            <ProposalBallotCards
              proposalId={current.id}
              isActive
              closedLabel="Voting closed — outcome pending"
              votesFor={current.votesFor}
              votesAgainst={current.votesAgainst}
              votesAbstain={current.votesAbstain}
            />
            {total > 1 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {total - 1} more {total - 1 === 1 ? "proposal is" : "proposals are"} voting
                now —{" "}
                <Link
                  href="/proposals?status=ACTIVE"
                  className="text-gold transition-colors hover:text-gold/80"
                >
                  browse all live proposals
                </Link>
              </p>
            )}
          </section>

          {/* Results — same centered section rhythm as the FGE page */}
          <section aria-labelledby="current-results-heading" className="mt-10">
            <div className="mb-4 text-center">
              <h2 id="current-results-heading" className="text-xl font-bold text-foreground">
                Current results
              </h2>
              <p className="text-sm text-muted-foreground">
                Live tally of voting power · results stay provisional until the window closes.
              </p>
            </div>
            <div className="mx-auto max-w-2xl">
              <ProposalVoteResults
                proposalId={current.id}
                votesFor={current.votesFor}
                votesAgainst={current.votesAgainst}
                votesAbstain={current.votesAbstain}
                quorumRequired={current.quorumRequired}
                totalPower={totalPower}
              />
            </div>
          </section>

          {/* Discussion — same shared thread surface as the proposal detail
              page; one thread, two windows into it. */}
          <section aria-labelledby="discussion-heading" className="mt-10">
            <div className="mb-4 text-center">
              <h2 id="discussion-heading" className="text-xl font-bold text-foreground">
                Discussion
              </h2>
              <p className="text-sm text-muted-foreground">
                The same thread as the proposal page — question the body before
                you commit a ballot.
              </p>
            </div>
            <ProposalVoteDiscussion proposalId={current.id} />
          </section>
        </>
      ) : (
        <>
          <div className="text-center">
            <div className="mb-2 flex flex-col items-center justify-center gap-2">
              <VoteIcon className="h-6 w-6 text-gold" aria-hidden />
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Vote
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              When a proposal enters its voting window, it appears here.
            </p>
          </div>
          <EmptyState
            className="mt-8"
            icon={<VoteIcon className="h-12 w-12" />}
            title="No votes are live right now"
            description="Browse open proposals, or look back at every past decision below."
            action={
              <Link
                href="/proposals"
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold sm:min-h-9"
              >
                Browse proposals
              </Link>
            }
          />
        </>
      )}

      {/* Past votes — every decided vote, linked to its dedicated page */}
      <section aria-labelledby="past-votes-heading" className="mt-12">
        <div className="mb-4 text-center">
          <h2
            id="past-votes-heading"
            className="flex items-center justify-center gap-2 text-xl font-bold text-foreground"
          >
            <History className="h-5 w-5 text-gold" aria-hidden />
            Past votes
          </h2>
          <p className="text-sm text-muted-foreground">
            Every decided vote on its own page — outcome, tallies, and quorum.
          </p>
        </div>

        <div className="space-y-3">
          {/* FGE — dedicated page: /governance-vote */}
          <Link
            href="/governance-vote"
            data-testid="past-vote-fge"
            className="block rounded-lg border border-border bg-bg-elevated/30 p-4 transition-colors hover:border-gold/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                Foundational Governance Election
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-gold">
                View election <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-1 text-xs text-text-dim">
              {formatDay(fgeStartsAt)} – {formatDay(fgeEndsAt)} (UTC)
            </div>
            <div className="mt-2 text-sm">
              {winner ? (
                <span className="text-muted-foreground">
                  Outcome: <span className="font-medium text-gold">{winner.label}</span>{" "}
                  elected · {winner.percentage.toFixed(1)}% of{" "}
                  {totalBallots.toLocaleString()} ballots
                </span>
              ) : (
                <span className="text-muted-foreground">No ballots recorded</span>
              )}
            </div>
          </Link>

          {/* Finalized proposals — dedicated pages: /proposals/[id] */}
          {finalized.map((p) => (
            <Link
              key={p.id}
              href={`/proposals/${p.id}`}
              data-testid={`past-vote-${p.id}`}
              className="block rounded-lg border border-border bg-bg-elevated/30 p-4 transition-colors hover:border-gold/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="line-clamp-2 min-w-0 break-words text-sm font-semibold text-foreground">
                  {p.title}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  View outcome <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </div>
              <div className="mt-1 text-xs text-text-dim">
                {PROPOSAL_TYPE_CONFIG[p.type]?.label ?? p.type}
                {formatWindowLabel(p) ? ` · ${formatWindowLabel(p)}` : ""}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Outcome: <ProposalStatusBadge status={p.status} />
                {p.quorumAchieved !== null && (
                  <span className="ml-2 font-mono text-xs text-text-dim">
                    quorum {p.quorumAchieved.toFixed(1)}% / {p.quorumRequired}%
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/results"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold sm:min-h-9"
          >
            Browse the full outcomes archive <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
