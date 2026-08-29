"use client";

/**
 * Single threaded comment + its collapsible reply subtree.
 *
 * Generic over the underlying comment type — works for `ProposalComment` and
 * `ElectionComment` (and any future threaded surface that satisfies the same
 * shape). All side effects (reactions, reply submission, deletion) are passed
 * down from the parent `<CommentsSection>` so this component stays free of
 * React Query hooks. That keeps the recursion cheap and the test surface
 * trivial (pure props in, rendered tree out).
 */

import Link from "next/link";
import { useState } from "react";
import {
  ArrowBigDown,
  ArrowBigUp,
  CornerUpLeft,
  Ghost,
  Loader2,
  Send,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HolderBadge } from "@/components/shared/holder-badge";
import { Markdown } from "@/components/shared/markdown";
import { EmojiBar } from "@/components/shared/emoji-reactions/emoji-bar";
import { cn, shortenAddress, timeAgo } from "@/lib/utils";
import type { BaseComment, CommentNode } from "@/lib/comment-tree";
import type { EmojiKey, EmojiReactionCounts } from "@/types";

/**
 * Thin visual wrapper for emoji reactions on a comment. The parent component
 * (`<CommentsSection>` callers) wires the actual React Query mutation hook via
 * the `onReact` prop — this keeps `<CommentItem>` itself free of hooks and
 * rules-of-hooks compliant.
 */
function CommentEmojiBar({
  emojiReactionCounts,
  myEmojiReaction,
  isAuthenticated,
  isPending,
  onReact,
  commentId,
}: {
  emojiReactionCounts: EmojiReactionCounts;
  myEmojiReaction: EmojiKey | null;
  isAuthenticated: boolean;
  isPending: boolean;
  onReact: (commentId: string, emoji: EmojiKey) => void;
  commentId: string;
}) {
  return (
    <EmojiBar
      emojiReactionCounts={emojiReactionCounts}
      myEmojiReaction={myEmojiReaction}
      isAuthenticated={isAuthenticated}
      isPending={isPending}
      onReact={(emoji) => onReact(commentId, emoji)}
    />
  );
}

/**
 * The shape every threaded-comment consumer must expose. The shared
 * component only reads these fields, so any concrete comment type
 * (`ProposalComment`, `ElectionComment`) satisfies it implicitly.
 */
export interface ThreadedComment extends BaseComment {
  authorAddress: string;
  authorHolderClass?: import("@/types").HolderClass | null;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  upvotes: number;
  downvotes: number;
  myReaction: string | null;
  emojiReactionCounts: EmojiReactionCounts;
  myEmojiReaction: EmojiKey | null;
}

export type ReactionType = "up" | "down";

export interface CommentItemProps<T extends ThreadedComment> {
  node: CommentNode<T>;
  depth: number;
  myAddress?: string;
  isAuthenticated: boolean;
  /** Reply composer state — owned by `<CommentsSection>`. */
  replyTo: string | null;
  replyDraft: string;
  onReplyToggle: (id: string) => void;
  onReplyDraftChange: (v: string) => void;
  onReplySubmit: (parentId: string) => void;
  isReplyPending: boolean;
  /** Side-effects. */
  onReact?: (commentId: string, type: ReactionType) => void;
  isReacting?: boolean;
  /** Emoji reactions (separate from up/down arrows; additive). The parent
   *  wires the appropriate React Query hook via this callback. */
  onReactEmoji?: (commentId: string, emoji: EmojiKey) => void;
  isReactingEmoji?: boolean;
}

export function CommentItem<T extends ThreadedComment>({
  node,
  depth,
  myAddress,
  isAuthenticated,
  replyTo,
  replyDraft,
  onReplyToggle,
  onReplyDraftChange,
  onReplySubmit,
  isReplyPending,
  onReact,
  isReacting,
  onReactEmoji,
  isReactingEmoji,
}: CommentItemProps<T>) {
  const isMine =
    myAddress &&
    node.authorAddress.toLowerCase() === myAddress.toLowerCase();
  const isDeleted = node.deletedAt !== null;
  const [showReplies, setShowReplies] = useState(true);

  const handleReact = (type: ReactionType) => {
    if (!isAuthenticated || !onReact) return;
    onReact(node.id, type);
  };

  const isReplying = replyTo === node.id;
  const myReaction = node.myReaction;

  return (
    <li>
      <div
        className="rounded-lg border border-border bg-bg-elevated/40 p-3"
        style={{ marginLeft: depth > 0 ? Math.min(depth, 3) * 16 : 0 }}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              <span aria-hidden className="mr-1 inline-flex align-[-2px]">
                {isDeleted ? (
                  <Ghost className="h-3.5 w-3.5 text-text-dim" />
                ) : (
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
              {isDeleted ? (
                <span className="text-text-dim">[deleted]</span>
              ) : (
                <>
                  <Link
                    href={`/snapshot-explorer?address=${node.authorAddress.toLowerCase()}`}
                    title={node.authorAddress}
                    className="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                  >
                    {shortenAddress(node.authorAddress)}
                  </Link>
                  {node.authorHolderClass && (
                    <HolderBadge
                      holderClass={node.authorHolderClass}
                      size="sm"
                      plain
                    />
                  )}
                </>
              )}
              {isMine && !isDeleted && (
                <span className="ml-1.5 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                  you
                </span>
              )}
            </span>
          </div>
          <span className="text-xs text-text-dim">{timeAgo(node.createdAt)}</span>
        </div>
        {isDeleted ? (
          <p className="text-sm italic text-text-dim">[comment deleted]</p>
        ) : (
          <Markdown className="text-sm">{node.content}</Markdown>
        )}

        {/* Emoji reactions (Discord-style) — sits just below the up/down actions */}
        {!isDeleted && onReactEmoji && (
          <div className="mt-2">
            <CommentEmojiBar
              commentId={node.id}
              emojiReactionCounts={node.emojiReactionCounts}
              myEmojiReaction={node.myEmojiReaction}
              isAuthenticated={isAuthenticated}
              isPending={Boolean(isReactingEmoji)}
              onReact={onReactEmoji}
            />
          </div>
        )}

        {/* Actions bar */}
        {!isDeleted && (
          <div className="mt-2 flex items-center gap-1">
            {/* Upvote */}
            {onReact && (
              <button
                type="button"
                onClick={() => handleReact("up")}
                disabled={!isAuthenticated || isReacting}
                aria-pressed={myReaction === "up"}
                aria-label={
                  myReaction === "up" ? "Remove upvote" : "Upvote comment"
                }
                className={cn(
                  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded px-2 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated",
                  "disabled:opacity-50",
                  myReaction === "up"
                    ? "text-success"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowBigUp className="h-3.5 w-3.5" aria-hidden />
                {node.upvotes > 0 && <span>{node.upvotes}</span>}
              </button>
            )}
            {/* Downvote */}
            {onReact && (
              <button
                type="button"
                onClick={() => handleReact("down")}
                disabled={!isAuthenticated || isReacting}
                aria-pressed={myReaction === "down"}
                aria-label={
                  myReaction === "down"
                    ? "Remove downvote"
                    : "Downvote comment"
                }
                className={cn(
                  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded px-2 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated",
                  "disabled:opacity-50",
                  myReaction === "down"
                    ? "text-danger"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ArrowBigDown className="h-3.5 w-3.5" aria-hidden />
                {node.downvotes > 0 && <span>{node.downvotes}</span>}
              </button>
            )}
            {/* Reply */}
            {isAuthenticated && depth < 3 && (
              <button
                type="button"
                onClick={() => onReplyToggle(node.id)}
                className={cn(
                  "inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                  isReplying && "text-gold",
                )}
              >
                <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Reply
              </button>
            )}
            {/* Toggle replies */}
            {node.replies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {showReplies
                  ? "Hide"
                  : `Show ${node.replies.length}`}{" "}
                {node.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
        )}

        {/* Reply composer */}
        {isReplying && (
          <div className="mt-3 space-y-2">
            <Textarea
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value.slice(0, 2000))}
              placeholder={`Reply to ${shortenAddress(node.authorAddress)}…`}
              aria-label={`Reply to ${shortenAddress(node.authorAddress)}`}
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onReplySubmit(node.id)}
                disabled={!replyDraft.trim() || isReplyPending}
              >
                {isReplyPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                Reply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onReplyToggle(node.id)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {node.replies.length > 0 && showReplies && (
        <ul className="mt-2 space-y-2">
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              node={reply}
              depth={depth + 1}
              myAddress={myAddress}
              isAuthenticated={isAuthenticated}
              replyTo={replyTo}
              replyDraft={replyDraft}
              onReplyToggle={onReplyToggle}
              onReplyDraftChange={onReplyDraftChange}
              onReplySubmit={onReplySubmit}
              isReplyPending={isReplyPending}
              onReact={onReact}
              isReacting={isReacting}
              onReactEmoji={onReactEmoji}
              isReactingEmoji={isReactingEmoji}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
