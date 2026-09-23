import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, Vote } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import {
  FGE_VOTING_ENDS_AT,
  FGE_VOTING_STARTS_AT,
  electionPhase,
  percentage,
  type ElectionChoice,
} from "@/lib/election";
import { buildResults, loadElection, tally } from "@/lib/election-tally";
import { listFinalizedProposals } from "@/lib/proposal-service";
import { cn } from "@/lib/utils";
import type { Proposal } from "@/types";

/** Live outcome data — rendered per request, never prerendered at build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Governance Results",
  description:
    "Live outcomes of the OMNOM DAO Foundational Governance Election and every finalized governance proposal.",
  alternates: { canonical: "/results" },
  openGraph: {
    title: "Governance Results · OMNOM DAO",
    description:
      "Live outcomes of the Foundational Governance Election and every finalized governance proposal.",
    url: "/results",
  },
};

/**
 * Bar colors per voting method — mirrors the `CHOICE_COLORS` map on
 * /governance-vote so both surfaces read as one system.
 */
const CHOICE_COLORS: Record<ElectionChoice, string> = {
  QUADRATIC: "bg-gold",
  ONE_WALLET_ONE_VOTE: "bg-blue-500",
  TIERED: "bg-emerald-500",
  LINEAR: "bg-zinc-500",
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

export default async function ResultsPage() {
  // Fall back to the pinned FGE constants when the election row is missing so
  // the page degrades gracefully instead of failing (the row exists in prod
  // and in the dev mock DB).
  const election = await loadElection();
  const startsAt = election?.voting_starts_at ?? FGE_VOTING_STARTS_AT;
  const endsAt = election?.voting_ends_at ?? FGE_VOTING_ENDS_AT;
  const phase = electionPhase(new Date(), new Date(startsAt), new Date(endsAt));
  const eligibleWalletCount = election?.eligible_wallet_count ?? 0;

  const counts = await tally();
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const results = buildResults(counts, total);

  // Leading choice by ballots. Ties keep ELECTION_CHOICES order (first wins);
  // no winner banner while zero ballots are in.
  let winner: (typeof results)[number] | null = null;
  for (const r of results) {
    if (r.count > 0 && (winner === null || r.count > winner.count)) winner = r;
  }

  const finalized = await listFinalizedProposals();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="text-center">
        <div className="mb-2 flex flex-col items-center justify-center gap-2">
          <BarChart3 className="h-6 w-6 text-gold" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Governance results
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Live outcomes of the Foundational Governance Election and every
          finalized proposal.
        </p>
      </header>

      {/* ── Section 1: Foundational Governance Election ─────────────── */}
      <section aria-labelledby="election-results-heading" className="mt-10">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <h2
            id="election-results-heading"
            className="flex flex-col items-center justify-center gap-2 text-center text-xl font-bold text-foreground"
          >
            <Vote className="h-5 w-5 text-gold" aria-hidden />
            <span>Foundational Governance Election</span>
          </h2>
          <span className="text-xs text-text-dim">
            {formatDay(startsAt)} – {formatDay(endsAt)} (UTC)
          </span>
        </div>

        <p className="mt-1 text-center text-sm text-muted-foreground">
          {phase === "CLOSED"
            ? "Voting closed — results are final."
            : phase === "OPEN"
              ? "Voting is open — tallies update live."
              : `Voting opens ${formatDay(startsAt)}.`}
        </p>

        {winner && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-5 text-center sm:p-6">
            <div className="text-xs uppercase tracking-widest text-text-dim">
              Winning choice
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              {winner.label}
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-gold">
              {winner.percentage.toFixed(1)}% of {total.toLocaleString()} ballots
            </div>
          </div>
        )}

        {/* Stats — same gold stat grid as /governance-vote */}
        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-bg-elevated/40 p-4 text-center sm:grid-cols-3">
          <div>
            <div className="font-mono text-lg font-bold text-gold">
              {total.toLocaleString()}
            </div>
            <div className="text-xs text-text-dim">Ballots cast</div>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-gold">
              {percentage(total, eligibleWalletCount).toFixed(1)}%
            </div>
            <div className="text-xs text-text-dim">Turnout</div>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-gold">
              {eligibleWalletCount.toLocaleString()}
            </div>
            <div className="text-xs text-text-dim">Eligible Wallets</div>
          </div>
        </div>

        {/* Per-choice tallies */}
        <div className="mt-6 space-y-3">
          {results.map((result) => (
            <div key={result.choice} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{result.label}</span>
                <span className="font-mono font-bold text-gold">
                  {result.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className={cn("h-full", CHOICE_COLORS[result.choice])}
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
              <div className="text-right text-xs text-text-dim">
                {result.count.toLocaleString()} ballots
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/governance-vote"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            View the full election <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ── Section 2: Finalized proposal outcomes ──────────────────── */}
      <section aria-labelledby="proposal-outcomes-heading" className="mt-12">
        <h2
          id="proposal-outcomes-heading"
          className="flex flex-col items-center justify-center gap-2 text-center text-xl font-bold text-foreground"
        >
          <ClipboardList className="h-5 w-5 text-gold" aria-hidden />
          Proposal outcomes
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Every decided proposal — passed, failed, expired, or executed.
        </p>

        {finalized.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<ClipboardList className="h-12 w-12" />}
            title="No finalized proposals yet"
            description="Once a proposal's voting window closes, its outcome and tallies are published here. Active proposals live in the Proposals list."
            action={
              <Link
                href="/proposals"
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
              >
                Browse active proposals
              </Link>
            }
          />
        ) : (
          <div className="mt-4 space-y-3">
            {finalized.map((p) => (
              <FinalizedProposalRow key={p.id} proposal={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── Durability note ─────────────────────────────────────────── */}
      <section className="mt-12 rounded-xl border border-border bg-bg-elevated/40 p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          This page renders live from the same database that backs the voting
          APIs. Every admin and moderator governance action is publicly
          auditable via the{" "}
          <a href="/api/v1/audit-log" className="text-gold hover:text-gold/80">
            audit log API
          </a>
          , and point-in-time archive exports are retained off-repo for durable
          record-keeping.
        </p>
      </section>
    </div>
  );
}

/* ── Finalized proposal row ─────────────────────────────────────── */

function FinalizedProposalRow({ proposal: p }: { proposal: Proposal }) {
  const typeLabel = PROPOSAL_TYPE_CONFIG[p.type]?.label ?? p.type;

  return (
    <div
      data-testid="results-proposal-row"
      className="rounded-lg border border-border bg-bg-elevated/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/proposals/${p.id}`}
          className="text-sm font-semibold text-foreground transition-colors hover:text-gold"
        >
          {p.title}
        </Link>
        <ProposalStatusBadge status={p.status} />
      </div>

      <div className="mt-1 text-xs text-text-dim">
        {typeLabel}
        {p.votingStartsAt && p.votingEndsAt
          ? ` · Voted ${formatDay(p.votingStartsAt)} – ${formatDay(p.votingEndsAt)}`
          : p.votingEndsAt
            ? ` · Closed ${formatDay(p.votingEndsAt)}`
            : ""}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <div className="font-mono text-sm font-bold text-emerald-300">
            {p.votesFor.toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">For</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-rose-300">
            {p.votesAgainst.toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">Against</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-gold">
            {p.votesAbstain.toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">Abstain</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-gold">
            {p.quorumAchieved !== null ? `${p.quorumAchieved.toFixed(1)}%` : "—"}
            <span className="text-xs font-normal text-text-dim">
              {" "}
              / {p.quorumRequired}%
            </span>
          </div>
          <div className="text-xs text-text-dim">Quorum</div>
        </div>
      </div>
    </div>
  );
}
