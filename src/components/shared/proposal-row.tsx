import Link from "next/link";
import { Clock } from "lucide-react";

import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { EmojiReactionsBar } from "@/components/shared/emoji-reactions/emoji-reactions-bar";
import { timeAgo } from "@/lib/utils";
import { type Proposal } from "@/types";

interface ProposalRowProps {
  proposal: Proposal;
}

/**
 * Compact proposal row — used in dense lists within the Recent Proposals section.
 * Shows status badge, title, and a relative timestamp on the right.
 */
export function ProposalRow({ proposal }: ProposalRowProps) {
  const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
  const totalEmojis = proposal.emojiReactionCounts
    ? Object.values(proposal.emojiReactionCounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const showEmojiBar = totalEmojis > 0 || proposal.myEmojiReaction !== null;

  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="flex flex-col gap-2 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ProposalStatusBadge status={proposal.status} />
          <span className="line-clamp-1 text-sm font-medium text-foreground">
            {proposal.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-text-dim">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {timeAgo(proposal.createdAt)}
          </span>
          <span className="hidden sm:inline font-mono">
            {totalVotes.toLocaleString()} votes
          </span>
        </div>
      </div>
      {showEmojiBar && (
        <div
          className="pl-[calc(theme(spacing.6)+2px)]"
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiReactionsBar
            surface="proposal"
            proposalId={proposal.id}
            emojiReactionCounts={proposal.emojiReactionCounts}
            myEmojiReaction={proposal.myEmojiReaction}
            isAuthenticated={false}
            compact
          />
        </div>
      )}
    </Link>
  );
}
