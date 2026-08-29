"use client";

/**
 * Reusable threaded comments section.
 *
 * Generic over the underlying comment type — works for `ProposalComment`
 * (proposal detail page) and `ElectionComment` (governance-vote page), and any
 * future surface that satisfies the shared `ThreadedComment` shape.
 *
 * The parent supplies:
 *   - The loaded comments array (already paginated + sorted by the API).
 *   - The action handlers (`onSubmit`, `onReply`, `onReact`, `onDelete`).
 *   - The pending state for the composer and reaction mutations.
 *
 * Why prop-callback instead of hooks inside: the parent owns the React Query
 * mutation hooks (parameterised by entity id), so this component stays a pure
 * UI primitive that can be dropped into any page with its own data layer.
 */

import { useCallback, useMemo, useState } from "react";
import { Loader2, MessagesSquare, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CommentItem,
  type ReactionType,
  type ThreadedComment,
} from "@/components/shared/comment-item";
import { buildCommentTree } from "@/lib/comment-tree";
import type { EmojiKey } from "@/types";

const MAX_LENGTH = 2000;

export interface CommentsSectionProps<T extends ThreadedComment> {
  /** Already-loaded comments (the parent owns fetching + pagination). */
  comments: T[];
  /** Whether the current user is authenticated. */
  isAuthenticated: boolean;
  /** Current user's wallet address (lower-cased). */
  myAddress?: string;
  /** Composer enabled state — `false` after voting closes, for example. */
  composerEnabled?: boolean;
  /** Disable the composer but keep history visible. */
  readOnly?: boolean;
  /** Optional banner shown when `readOnly` is true. */
  readOnlyMessage?: string;

  /** Top-level comment submission. Throwing should not crash the UI. */
  onSubmit: (content: string) => Promise<void> | void;
  /** Reply submission for a given parent comment id. */
  onReply: (parentId: string, content: string) => Promise<void> | void;
  /** Optional up/down reaction toggle. Omit to hide the up/down buttons. */
  onReact?: (commentId: string, type: ReactionType) => void;
  /** Optional emoji reaction toggle. The parent owns the underlying hook. */
  onReactEmoji?: (commentId: string, emoji: EmojiKey) => void;

  /** Pending flag for top-level submission. */
  isSubmitting?: boolean;
  /** Pending flag for reply submission. */
  isReplying?: boolean;
  /** Pending flag for reactions (applied to every CommentItem). */
  isReacting?: boolean;
  /** Pending flag for emoji reactions (applied to every CommentItem). */
  isReactingEmoji?: boolean;

  /** Empty-state copy. */
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  /** Section heading (defaults to "Comments"). */
  title?: string;
}

export function CommentsSection<T extends ThreadedComment>({
  comments,
  isAuthenticated,
  myAddress,
  composerEnabled = true,
  readOnly = false,
  readOnlyMessage,
  onSubmit,
  onReply,
  onReact,
  onReactEmoji,
  isSubmitting = false,
  isReplying = false,
  isReacting = false,
  isReactingEmoji = false,
  emptyStateTitle = "No comments yet",
  emptyStateDescription = "Start the discussion — be the first to comment.",
  title = "Comments",
}: CommentsSectionProps<T>) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const activeCount = useMemo(
    () => comments.filter((c) => !c.deletedAt).length,
    [comments],
  );
  const tree = useMemo(() => buildCommentTree(comments), [comments]);

  const handleSubmit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSubmitting) return;
    try {
      await onSubmit(trimmed);
      setDraft("");
    } catch {
      // caller surfaced a toast already; swallow to keep UI clean.
    }
  }, [draft, isSubmitting, onSubmit]);

  const handleReplySubmit = useCallback(
    async (parentId: string) => {
      const trimmed = replyDraft.trim();
      if (!trimmed || isReplying) return;
      try {
        await onReply(parentId, trimmed);
        setReplyDraft("");
        setReplyTo(null);
      } catch {
        // caller surfaced a toast already; swallow to keep UI clean.
      }
    },
    [replyDraft, isReplying, onReply],
  );

  const handleReplyToggle = useCallback(
    (id: string) => {
      setReplyTo((current) => (current === id ? null : id));
      setReplyDraft("");
    },
    [],
  );

  const composerActive = composerEnabled && !readOnly;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-center space-y-0">
        <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
          <MessagesSquare className="h-4 w-4" aria-hidden /> {title}{" "}
          <span className="ml-1 text-muted-foreground">({activeCount})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Read-only banner */}
        {readOnly && readOnlyMessage && (
          <div className="rounded-lg border border-border bg-bg-elevated/40 p-3 text-center text-sm text-muted-foreground">
            {readOnlyMessage}
          </div>
        )}

        {/* Composer */}
        {!isAuthenticated ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            <ConnectCta size="sm">Connect wallet to comment</ConnectCta>
          </div>
        ) : !composerActive ? null : (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="Share your thoughts… (Markdown supported)"
              aria-label="Add a comment"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-dim">
                {draft.length}/{MAX_LENGTH}
              </span>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!draft.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                Post Comment
              </Button>
            </div>
          </div>
        )}

        {/* Thread list */}
        {tree.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="h-12 w-12" />}
            title={emptyStateTitle}
            description={emptyStateDescription}
          />
        ) : (
          <ul className="space-y-4">
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                depth={0}
                myAddress={myAddress}
                isAuthenticated={isAuthenticated}
                replyTo={replyTo}
                replyDraft={replyDraft}
                onReplyToggle={handleReplyToggle}
                onReplyDraftChange={setReplyDraft}
                onReplySubmit={handleReplySubmit}
                isReplyPending={isReplying}
                onReact={onReact}
                isReacting={isReacting}
                onReactEmoji={onReactEmoji}
                isReactingEmoji={isReactingEmoji}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
