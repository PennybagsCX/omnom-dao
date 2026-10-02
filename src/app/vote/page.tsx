import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  HelpCircle,
  History,
  Vote as VoteIcon,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ClassBreakdownCard } from "@/components/shared/class-breakdown";
import { FinalizedProposalRow } from "@/components/results/finalized-proposal-row";
import { Markdown } from "@/components/shared/markdown";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import {
  ProposalBallotCards,
  ProposalVoteAdminControls,
  ProposalVoteDiscussion,
  ProposalVoteReactions,
  ProposalVoteResults,
} from "@/components/proposals/proposal-vote-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { EmptyState } from "@/components/shared/empty-state";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { FGE_VOTING_ENDS_AT, FGE_VOTING_STARTS_AT } from "@/lib/election";
import { buildResults, loadElection, tally } from "@/lib/election-tally";
import {
  listFinalizedProposals,
  tallyProposalByHolderClass,
} from "@/lib/proposal-service";
import { loadReferendum, referendumQuestionLabel, type Referendum } from "@/lib/referendum";
import { ShareButtons } from "@/components/shared/share-buttons";
import { cn, formatDateTime } from "@/lib/utils";
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

export default async function VotePage() {
  // Active votes come in two shapes: a tagged referendum (one campaign, N
  // question ballots — see src/lib/referendum.ts) or the classic single
  // live proposal. The referendum layout takes precedence; the legacy
  // single-proposal layout is untouched fallback for non-referendum votes.
  const { referendum, others, total } = await loadReferendum();
  const current = others[0] ?? null;

  // Past votes = proposals that actually went to a vote; admin-rejected rows
  // (FAILED without a voting window) stay on /results and /proposals.
  const finalized = (await listFinalizedProposals()).filter((p) => p.votingEndsAt);
  // Per-class turnout for every past vote card (1 indexed query per proposal;
  // class lookup is in-memory over the cached snapshot).
  const finalizedTallies = new Map(
    await Promise.all(
      finalized.map(async (p) => [p.id, await tallyProposalByHolderClass(p.id)] as const),
    ),
  );

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

  // Per-holder-class breakdown of the current vote (FGE "Who has voted"
  // analogue). Empty when nothing is live.
  const classTallies = current
    ? await tallyProposalByHolderClass(current.id)
    : [];
  const ballotsCast = classTallies.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {referendum ? (
        <ReferendumHub referendum={referendum} others={others} totalPower={totalPower} />
      ) : current ? (
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
              <Link
                href={`/proposals/${current.id}`}
                className="transition-colors hover:text-gold"
                title="View the full proposal page"
              >
                {current.title}
              </Link>
            </h1>
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

          {/* Share the live vote — organic reach is the only reach. */}
          <ShareButtons
            path="/vote"
            title={`Voting is live on $OMNOM DAO: ${current.title}`}
            className="mt-5"
          />

          {/* Full proposal body — complete, never truncated; reference copy
              above the ballot. The proposal page remains one click away for
              timeline + reactions. */}
          <Card className="mt-8">
            <CardHeader className="text-center">
              <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
                <VoteIcon className="h-4 w-4" aria-hidden /> Proposal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{current.description}</Markdown>

              {/* Emoji reactions — the same bar the detail page renders, on
                  the shared detail query, so reactions made here or there
                  count everywhere. */}
              <ProposalVoteReactions
                proposalId={current.id}
                className="mt-6 border-t border-border pt-4"
              />

              <div className="mt-6 border-t border-border pt-3 text-center">
                <Link
                  href={`/proposals/${current.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
                >
                  View the full proposal page{" "}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </CardContent>
          </Card>

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
              votingStartsAt={current.votingStartsAt}
              votesFor={current.votesFor}
              votesAgainst={current.votesAgainst}
              votesAbstain={current.votesAbstain}
            />
            {/* Admin-only: pause / resume / stop the live vote. */}
            <ProposalVoteAdminControls proposalId={current.id} className="mt-4" />
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
            {/* Full content width (owner mark m1) — same as the FGE page's
                results section. */}
            <ProposalVoteResults
              proposalId={current.id}
              votesFor={current.votesFor}
              votesAgainst={current.votesAgainst}
              votesAbstain={current.votesAbstain}
              quorumRequired={current.quorumRequired}
              totalPower={totalPower}
            />
          </section>

          {/* Who has voted — FGE's holder-class turnout breakdown, adapted
              to the FOR/AGAINST/ABSTAIN ballot (shared component). */}
          <section aria-label="Who has voted" className="mt-10">
            <ClassBreakdownCard tallies={classTallies} />
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
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                Foundational Governance Election
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gold">
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

          {/* Finalized proposals — same expandable row as /results: outcome,
              tallies, quorum, and the Who-has-voted breakdown collapsed by
              default (dedicated pages: /proposals/[id]). */}
          {finalized.map((p) => (
            <FinalizedProposalRow
              key={p.id}
              proposal={p}
              tallies={finalizedTallies.get(p.id) ?? []}
            />
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

      {/* FAQ — same accordion pattern as the FGE page (owner mark m2). */}
      <section aria-labelledby="faq-heading" className="mt-12">
        <div className="mb-4 text-center">
          <h2
            id="faq-heading"
            className="flex items-center justify-center gap-2 text-xl font-bold text-foreground"
          >
            <HelpCircle className="h-5 w-5 text-gold" aria-hidden />
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {(referendum ? [REFERENDUM_FAQ, ...PROPOSAL_VOTE_FAQ] : PROPOSAL_VOTE_FAQ).map(
            (faq, idx) => (
            <AccordionItem key={idx} value={`faq-${idx}`}>
              <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

/* ── Referendum hub — one campaign, N question ballots. Shared header,
   countdown, and turnout stats up top; one full section per question (body,
   ballot, results); "also voting" strip for any non-referendum live votes.
   Decision record: DOCS/REFERENDUM-WAVE1.md. ─────────────────────────── */

async function ReferendumHub({
  referendum,
  others,
  totalPower,
}: {
  referendum: Referendum;
  others: Proposal[];
  totalPower: number;
}) {
  const first = referendum.proposals[0];
  if (!first) return null;

  // Per-question holder-class turnout — same breakdown the single-vote
  // layout and the detail pages show, one per referendum question.
  const talliesByQuestion = new Map(
    await Promise.all(
      referendum.proposals.map(async (p) => [p.id, await tallyProposalByHolderClass(p.id)] as const),
    ),
  );

  const votes = referendum.proposals.reduce(
    (acc, p) => ({
      for: acc.for + p.votesFor,
      against: acc.against + p.votesAgainst,
      abstain: acc.abstain + p.votesAbstain,
    }),
    { for: 0, against: 0, abstain: 0 },
  );
  const powerVoted = votes.for + votes.against + votes.abstain;
  const windowLabel =
    referendum.startsAt && referendum.endsAt
      ? `${formatDay(referendum.startsAt)} – ${formatDay(referendum.endsAt)} (UTC)`
      : null;

  return (
    <>
      {/* Header — the referendum as one campaign, centered like the FGE page */}
      <div className="text-center">
        <div className="mb-2 flex flex-col items-center justify-center gap-2">
          <VoteIcon className="h-6 w-6 text-gold" aria-hidden />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ProposalStatusBadge status={ProposalStatus.ACTIVE} pulse />
            <span className="text-xs font-medium uppercase tracking-widest text-text-dim">
              Wave 1 · {referendum.proposals.length} rulebook questions · one window
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Wave 1 Governance Referendum
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Three decisions that set how every future $OMNOM vote works. Each
          question is its own ballot below — vote on all three. Ballots are
          changeable until close.
        </p>
      </div>

      {/* Countdown — closes when the last question closes */}
      {referendum.endsAt && (
        <div className="mx-auto mt-6 max-w-xl">
          <CountdownTimer
            target={referendum.endsAt}
            label="Referendum closes in"
            closedText="Voting closed — outcome pending"
            ariaLabel="Wave 1 Referendum voting closes in"
          />
        </div>
      )}

      {/* Stats — referendum-wide turnout against the shared 5% bar */}
      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-bg-elevated/40 p-4 text-center sm:grid-cols-3">
        <div>
          <div className="font-mono text-lg font-bold text-gold">
            {powerVoted.toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">Voting power voted</div>
        </div>
        <div>
          <div className="font-mono text-lg font-bold text-gold">
            {totalPower > 0 ? ((powerVoted / totalPower) * 100).toFixed(1) : "0.0"}%
          </div>
          <div className="text-xs text-text-dim">Turnout · {first.quorumRequired}% quorum</div>
        </div>
        <div>
          <div className="font-mono text-lg font-bold text-gold">
            {referendum.proposals.length}
          </div>
          <div className="text-xs text-text-dim">Questions on your ballot</div>
        </div>
      </div>

      {windowLabel && (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" aria-hidden />
          <span>voting window</span> {windowLabel}
        </p>
      )}

      {/* Share the referendum — the campaign's reach is the point. */}
      <ShareButtons
        path="/vote"
        title="🐕 Wave 1 Governance Referendum is LIVE — three rulebook decisions, one 30-day window. Vote with your $OMNOM snapshot wallet:"
        className="mt-5"
      />

      {/* One section per question — same rhythm as the single-vote layout:
          body, ballot, results. Discussion + reactions live one click away on
          each question's full page. */}
      {referendum.proposals.map((p, i) => (
        <section key={p.id} aria-labelledby={`ref-q-${p.id}`} className="mt-12">
          <div className="mb-4 text-center">
            <div className="text-xs font-medium uppercase tracking-widest text-gold">
              Question {i + 1} of {referendum.proposals.length}
            </div>
            <h2
              id={`ref-q-${p.id}`}
              className="mt-1 text-xl font-bold text-foreground"
            >
              <Link
                href={`/proposals/${p.id}`}
                className="transition-colors hover:text-gold"
                title="View the full proposal page"
              >
                {referendumQuestionLabel(p.title)}
              </Link>
            </h2>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Markdown>{p.description}</Markdown>
              <ProposalVoteReactions
                proposalId={p.id}
                className="mt-6 border-t border-border pt-4"
              />
              <div className="mt-6 border-t border-border pt-3 text-center">
                <Link
                  href={`/proposals/${p.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
                >
                  Full proposal, timeline &amp; discussion{" "}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <ProposalBallotCards
              proposalId={p.id}
              isActive
              closedLabel="Voting closed — outcome pending"
              votingStartsAt={p.votingStartsAt}
              votesFor={p.votesFor}
              votesAgainst={p.votesAgainst}
              votesAbstain={p.votesAbstain}
            />
            <ProposalVoteAdminControls proposalId={p.id} className="mt-4" />
          </div>

          <div className="mt-8">
            <h3 className="mb-4 text-center text-base font-bold text-foreground">
              Current results — Question {i + 1}
            </h3>
            <ProposalVoteResults
              proposalId={p.id}
              votesFor={p.votesFor}
              votesAgainst={p.votesAgainst}
              votesAbstain={p.votesAbstain}
              quorumRequired={p.quorumRequired}
              totalPower={totalPower}
            />
            {/* Same per-question "Who has voted" breakdown everywhere. */}
            <ClassBreakdownCard
              tallies={talliesByQuestion.get(p.id) ?? []}
              className="mt-4"
            />
          </div>
        </section>
      ))}

      {/* Non-referendum live votes — rare, but never hidden. */}
      {others.length > 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {others.length} more {others.length === 1 ? "proposal is" : "proposals are"} voting
          now —{" "}
          <Link
            href="/proposals?status=ACTIVE"
            className="text-gold transition-colors hover:text-gold/80"
          >
            browse all live proposals
          </Link>
        </p>
      )}
    </>
  );
}
const PROPOSAL_VOTE_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Can I change my vote?",
    a: "Yes — click a different card any time before the window closes. Your latest choice is the one that counts, and changing it never costs anything.",
  },
  {
    q: "How is my vote weighted?",
    a: "Quadratically, per the Foundational Governance Election result: your voting power is the square root of your snapshot balance, read from the frozen snapshot at the moment you cast — never from your current wallet.",
  },
  {
    q: "What does ABSTAIN actually do?",
    a: "It counts toward turnout (quorum) but not toward the outcome — useful when you want the vote to validate without picking a side.",
  },
  {
    q: "What quorum does this proposal need?",
    a: "The requirement is in the stats grid above. Turnout is measured against total quadratic power across the entire snapshot, and every ballot — abstentions included — counts toward it.",
  },
  {
    q: "What happens if quorum isn't met?",
    a: "For the Wave 1 Referendum, the rule published on day one applies: if the 5% bar isn't reached, the most-voted outcome is still adopted as the community's working consensus — recorded openly as a quorum-missed decision and re-confirmed in a later ratification vote as turnout grows. Outside the referendum, a proposal that misses quorum expires with no outcome and the current rules stay in force.",
  },
  {
    q: "Is the outcome binding?",
    a: "No — all outcomes are advisory. They are recorded publicly on the proposal (and in the audit log), and execution happens off-chain with the outcome noted.",
  },
  {
    q: "Does voting cost gas?",
    a: "No. Voting is off-chain: you sign a message with your wallet (gasless SIWE verification). There are no transactions and no fees.",
  },
];

/** Shown above the standard FAQ whenever a referendum is live. */
const REFERENDUM_FAQ: { q: string; a: string } = {
  q: "What is the Wave 1 Referendum?",
  a: "One ballot window (Oct 2 → Nov 1, 2026), three rulebook decisions that vote simultaneously: Question 1 sets the global default quorum, Question 2 the pass threshold, Question 3 the per-type quorum schedule. Each question is its own FOR/AGAINST/ABSTAIN ballot and stands on its own — vote on all three below. If the 5% quorum isn't reached, the most-voted outcome on each question is still adopted as the community's working consensus, recorded as quorum-missed and re-confirmed in a later ratification vote.",
};
