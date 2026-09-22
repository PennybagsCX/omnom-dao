import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProposalVoteActions } from "@/components/proposals/proposal-vote-actions";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { ProposalStatus } from "@/types";

export interface LiveVoteProps {
  id: string;
  title: string;
  typeLabel: string;
  /** ISO voting end (null-safe; the countdown only renders with a target). */
  endsAt: string | null;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
  description: string;
}

/** Collapse the markdown body to a plain-text teaser for the card. */
function excerpt(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 240 ? `${plain.slice(0, 240).trimEnd()}…` : plain;
}

/**
 * Hero card for one live proposal on the /vote hub: status + countdown,
 * live tallies, quorum requirement, body teaser, embedded cast/change-vote
 * controls (shared code path with the detail page), and a deep link.
 *
 * Server-compatible shell — the only client islands are CountdownTimer and
 * ProposalVoteActions.
 */
export function LiveVoteCard({
  id,
  title,
  typeLabel,
  endsAt,
  votesFor,
  votesAgainst,
  votesAbstain,
  quorumRequired,
  description,
}: LiveVoteProps) {
  return (
    <article
      data-testid={`vote-live-card-${id}`}
      className="rounded-xl border border-gold/40 bg-bg-surface p-5 shadow-lg shadow-gold/5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProposalStatusBadge status={ProposalStatus.ACTIVE} pulse />
        <span className="text-xs font-medium uppercase tracking-widest text-text-dim">
          {typeLabel}
        </span>
      </div>

      <h3 className="mt-3 text-xl font-bold leading-tight text-foreground sm:text-2xl">
        <Link
          href={`/proposals/${id}`}
          className="line-clamp-2 min-w-0 break-words transition-colors hover:text-gold"
        >
          {title}
        </Link>
      </h3>

      {endsAt && (
        <CountdownTimer
          className="mt-4"
          target={endsAt}
          label="Voting closes in"
          // Explicit: the component default ("Voting is now live") reads as
          // stale copy on a page whose headline card IS the live vote.
          closedText="Voting closed — outcome pending"
          ariaLabel={`Voting closes in — ${title}`}
        />
      )}

      {/* Full sentence a reader must understand — design-system floor is
          text-sm (text-xs is for counters/badge numerals only). */}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Quorum required:{" "}
        <span className="font-mono font-bold text-gold">{quorumRequired}%</span>{" "}
        of all voting power · abstentions count toward turnout
      </p>

      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {excerpt(description)}
      </p>

      {/* The island owns the live VoteBar (falls back to the server tallies
          until its detail query resolves) + the cast/change controls. */}
      <div className="mt-5 border-t border-border pt-5">
        <ProposalVoteActions
          proposalId={id}
          isActive
          closedLabel="Voting closed — outcome pending"
          votesFor={votesFor}
          votesAgainst={votesAgainst}
          votesAbstain={votesAbstain}
        />
      </div>

      <div className="mt-4 text-center">
        <Link
          href={`/proposals/${id}`}
          // Ghost styling — gold is reserved for primary actions, and on this
          // card the primary action is the embedded vote controls above.
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold sm:min-h-9"
        >
          Open proposal for full details
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
