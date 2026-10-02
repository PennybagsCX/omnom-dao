"use client";

import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { ProposalClassRow } from "@/components/shared/class-breakdown";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { ProposalStatus, type Proposal } from "@/types";
import type { ProposalClassTally } from "@/lib/proposal-service";

/**
 * One decided vote on /results — expandable exactly like the FAQ accordions
 * (Radix, smooth height animation): the row shows outcome, tallies, quorum,
 * and the plain-language sentence; the "Who has voted" holder-class
 * breakdown expands on click. Client component so the expand state is local.
 */
export function FinalizedProposalRow({
  proposal: p,
  tallies,
}: {
  proposal: Proposal;
  tallies: ProposalClassTally[];
}) {
  const typeLabel = PROPOSAL_TYPE_CONFIG[p.type]?.label ?? p.type;

  return (
    <div
      data-testid="results-proposal-row"
      className="rounded-lg border border-border bg-bg-elevated/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/proposals/${p.id}`}
          data-testid={`finalized-proposal-${p.id}`}
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

      {/* Plain-language outcome — what the vote MEANT, not just the numbers. */}
      <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        <OutcomeSentence proposal={p} />
      </div>

      {/* Expandable holder-class breakdown — the same Radix accordion the
          FAQ uses, so it glides open/closed instead of snapping. */}
      <Accordion type="single" collapsible className="mt-3">
        <AccordionItem value="breakdown" className="border-none">
          <AccordionTrigger
            data-testid="results-row-toggle"
            className="justify-center py-2 text-xs font-medium text-muted-foreground hover:no-underline hover:text-gold"
          >
            Who has voted — class breakdown
          </AccordionTrigger>
          <AccordionContent className="border-t border-border pt-3">
            <div className="space-y-2">
              {tallies.length === 0 ? (
                <p className="text-center text-xs text-text-dim">
                  No class breakdown available for this vote.
                </p>
              ) : (
                tallies.map((row) => <ProposalClassRow key={row.holderClass} row={row} />)
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function OutcomeSentence({ proposal: p }: { proposal: Proposal }) {
  if (p.status === ProposalStatus.PASSED) {
    return (
      <span>
        <span className="font-medium text-emerald-300">Passed</span> — adopted
        by the community. Execution is coordinated off-chain and noted on the
        proposal.
      </span>
    );
  }
  if (p.status === ProposalStatus.FAILED) {
    return (
      <span>
        <span className="font-medium text-rose-300">Failed</span> — rejected by
        the community; the current rules stay in force.
      </span>
    );
  }
  if (p.status === ProposalStatus.EXPIRED) {
    return (
      <span>
        <span className="font-medium text-slate-300">Quorum not met</span> —
        {(p.quorumAchieved ?? 0).toFixed(2)}% of the {p.quorumRequired}% bar;
        expired with no change adopted.
      </span>
    );
  }
  if (p.status === ProposalStatus.EXECUTED) {
    return p.metadata?.adoptedAs === "consensus-fallback" ? (
      <span>
        <span className="font-medium text-gold">Adopted as working consensus</span>{" "}
        — quorum was not met ({(p.quorumAchieved ?? 0).toFixed(2)}% of{" "}
        {p.quorumRequired}%); the most-voted outcome stands under the fallback
        rule published before the vote, with re-confirmation planned as turnout
        grows.
      </span>
    ) : (
      <span>
        <span className="font-medium text-emerald-300">Executed</span> — the
        passed outcome was carried out and recorded.
      </span>
    );
  }
  return <span>Outcome recorded.</span>;
}

/** UTC keeps the window dates identical regardless of the viewer's locale. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
