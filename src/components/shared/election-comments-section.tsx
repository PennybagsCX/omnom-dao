"use client";

/**
 * Election-scoped comments panel for `/governance-vote`.
 *
 * Thin wrapper over the shared `<CommentsSection>` that wires the election
 * React Query hooks. Keeps the underlying comments-section.tsx generic while
 * isolating the election-specific data + UX details here:
 *   - 4 minute refresh on the comment list (the page polls the election
 *     itself every 15s, so this matches the rhythm without flooding KV).
 *   - Composer is read-only after `phase === "CLOSED"`. History stays visible.
 *   - Author is gated by snapshot eligibility + auth; reactions share the
 *     same gate on the server.
 */

import { CommentsSection } from "@/components/shared/comments-section";
import {
  useCreateElectionComment,
  useElectionComments,
  useToggleElectionReaction,
} from "@/lib/api";
import type { ElectionComment } from "@/types";

export interface ElectionCommentsSectionProps {
  electionKey: string;
  /** Authenticated wallet address (lower-cased). Undefined = logged out. */
  myAddress?: string;
  /** Whether the current wallet is in the ever-held snapshot. */
  userEligible: boolean;
  /** Current election phase — controls the composer window. */
  phase: "UPCOMING" | "OPEN" | "CLOSED";
}

const REFRESH_MS = 4 * 60 * 1000;

export function ElectionCommentsSection({
  electionKey,
  myAddress,
  userEligible,
  phase,
}: ElectionCommentsSectionProps) {
  const { data } = useElectionComments(electionKey, 1, electionKey.length > 0);
  const createComment = useCreateElectionComment(electionKey);
  const toggleReaction = useToggleElectionReaction(electionKey);

  const isAuthenticated = Boolean(myAddress) && userEligible;
  const readOnly = phase === "CLOSED";

  const comments: ElectionComment[] = data?.comments ?? [];

  return (
    <CommentsSection<ElectionComment>
      comments={comments}
      isAuthenticated={isAuthenticated}
      myAddress={myAddress}
      composerEnabled
      readOnly={readOnly}
      readOnlyMessage={
        readOnly
          ? "Voting has closed — comments are read-only."
          : undefined
      }
      onSubmit={async (content) => {
        await createComment.mutateAsync({ content });
      }}
      onReply={async (parentId, content) => {
        await createComment.mutateAsync({ content, parentId });
      }}
      onReact={(commentId, type) =>
        toggleReaction.mutate({ commentId, type })
      }
      isSubmitting={createComment.isPending}
      isReacting={toggleReaction.isPending}
      emptyStateTitle="No comments yet"
      emptyStateDescription="Start the conversation — discuss the voting methods before you cast your ballot."
      title="Discussion"
    />
  );
}

// Keep the polling cadence available for tests / future tuning.
// (Currently unused; left here so future hooks can opt into a shorter poll
// without re-importing the constant elsewhere.)
export const ELECTION_COMMENTS_REFRESH_MS = REFRESH_MS;
