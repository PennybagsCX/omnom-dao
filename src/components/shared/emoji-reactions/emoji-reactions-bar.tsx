"use client";

/**
 * Emoji reactions bar — composition root for the three emoji surfaces.
 *
 * Owns which React Query mutation hook to dispatch based on `surface`:
 *   - "proposal"            → useToggleProposalReaction
 *   - "proposal-comment"    → useToggleCommentEmojiReaction
 *   - "election-comment"    → useToggleElectionCommentEmojiReaction
 *
 * Pass-throughs for already-loaded data (counts, my reaction, auth flag) keep
 * callers free of React Query details.
 */

import { EmojiBar } from "@/components/shared/emoji-reactions/emoji-bar";
import {
  useToggleCommentEmojiReaction,
  useToggleElectionCommentEmojiReaction,
  useToggleProposalReaction,
} from "@/lib/api";
import type { EmojiKey, EmojiReactionCounts } from "@/types";

export type EmojiReactionsSurface =
  | "proposal"
  | "proposal-comment"
  | "election-comment";

interface BaseProps {
  emojiReactionCounts: EmojiReactionCounts;
  myEmojiReaction: EmojiKey | null;
  isAuthenticated: boolean;
  compact?: boolean;
}

type ProposalProps = BaseProps & {
  surface: "proposal";
  proposalId: string;
  commentId?: never;
  electionKey?: never;
};

type ProposalCommentProps = BaseProps & {
  surface: "proposal-comment";
  proposalId: string;
  commentId: string;
  electionKey?: never;
};

type ElectionCommentProps = BaseProps & {
  surface: "election-comment";
  electionKey: string;
  commentId: string;
  proposalId?: never;
};

export type EmojiReactionsBarProps =
  | ProposalProps
  | ProposalCommentProps
  | ElectionCommentProps;

export function EmojiReactionsBar(props: EmojiReactionsBarProps) {
  const { surface, compact } = props;

  if (surface === "proposal") {
    return <ProposalSurface {...props} compact={compact} />;
  }
  if (surface === "proposal-comment") {
    return <ProposalCommentSurface {...props} compact={compact} />;
  }
  return <ElectionCommentSurface {...props} compact={compact} />;
}

function ProposalSurface({
  proposalId,
  emojiReactionCounts,
  myEmojiReaction,
  isAuthenticated,
  compact,
}: Omit<ProposalProps, "surface">) {
  const mutation = useToggleProposalReaction(proposalId);
  return (
    <EmojiBar
      emojiReactionCounts={emojiReactionCounts}
      myEmojiReaction={myEmojiReaction}
      isAuthenticated={isAuthenticated}
      isPending={mutation.isPending}
      onReact={(emoji) => mutation.mutate({ emoji })}
      compact={compact}
    />
  );
}

function ProposalCommentSurface({
  proposalId,
  commentId,
  emojiReactionCounts,
  myEmojiReaction,
  isAuthenticated,
  compact,
}: Omit<ProposalCommentProps, "surface">) {
  const mutation = useToggleCommentEmojiReaction(proposalId);
  return (
    <EmojiBar
      emojiReactionCounts={emojiReactionCounts}
      myEmojiReaction={myEmojiReaction}
      isAuthenticated={isAuthenticated}
      isPending={mutation.isPending}
      onReact={(emoji) => mutation.mutate({ commentId, emoji })}
      compact={compact}
    />
  );
}

function ElectionCommentSurface({
  electionKey,
  commentId,
  emojiReactionCounts,
  myEmojiReaction,
  isAuthenticated,
  compact,
}: Omit<ElectionCommentProps, "surface">) {
  const mutation = useToggleElectionCommentEmojiReaction(electionKey);
  return (
    <EmojiBar
      emojiReactionCounts={emojiReactionCounts}
      myEmojiReaction={myEmojiReaction}
      isAuthenticated={isAuthenticated}
      isPending={mutation.isPending}
      onReact={(emoji) => mutation.mutate({ commentId, emoji })}
      compact={compact}
    />
  );
}