import { memo } from "react";
import Link from "next/link";
import { Clock, PenLine } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { ProposalTypeBadge } from "@/components/shared/proposal-type-badge";
import { VoteBar } from "@/components/shared/vote-bar";
import { shortenAddress, timeAgo } from "@/lib/utils";
import { stripMarkdown } from "@/lib/text";
import { ProposalStatus, type Proposal } from "@/types";

interface ProposalCardProps {
  proposal: Proposal;
  /** Hide the vote breakdown bar (useful in dense lists). */
  hideVoteBar?: boolean;
  className?: string;
}

/**
 * Proposal card — the primary list/grid unit across the app.
 * Shows status, type, title, description excerpt, vote breakdown, author,
 * and a live countdown when voting is active.
 */
export const ProposalCard = memo(function ProposalCard({
  proposal,
  hideVoteBar = false,
  className,
}: ProposalCardProps) {
  const isActive = proposal.status === ProposalStatus.ACTIVE;
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="group block focus-visible:outline-none"
      aria-label={`Open proposal: ${proposal.title}`}
    >
      <Card
        className={
          "h-full transition-all duration-200 hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 group-focus-visible:ring-2 group-focus-visible:ring-ring " +
          (className ?? "")
        }
      >
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ProposalStatusBadge status={proposal.status} pulse={isActive} />
            <ProposalTypeBadge type={proposal.type} />
          </div>

          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-gold">
            {proposal.title}
          </h2>

          <p className="line-clamp-2 text-sm text-muted-foreground">
            {stripMarkdown(proposal.description)}
          </p>

          {!hideVoteBar && (
            <VoteBar
              votesFor={proposal.votesFor}
              votesAgainst={proposal.votesAgainst}
              votesAbstain={proposal.votesAbstain}
            />
          )}

          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3 text-xs text-text-dim sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              <span className="font-mono">{shortenAddress(proposal.authorAddress)}</span>
            </span>
            {isActive && proposal.votingEndsAt ? (
              <CountdownTimer endsAt={proposal.votingEndsAt} compact />
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 w-3.5" aria-hidden />
                {timeAgo(proposal.createdAt)}
                {totalVotes > 0 && <span> · {totalVotes.toLocaleString()} votes</span>}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
