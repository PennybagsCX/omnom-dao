"use client";

import { useCallback, useState } from "react";

import {
  useCastVote,
  useChangeVote,
  useCurrentUser,
  useProposalDetail,
  type ProposalDetailData,
} from "@/lib/api";
import type { VoteChoice } from "@/types";

export interface UseProposalVoteResult {
  isAuthenticated: boolean;
  votingPower?: number;
  myVote: VoteChoice | null;
  onVote: (choice: VoteChoice) => Promise<void>;
  onChangeVote: (choice: VoteChoice) => Promise<void>;
  isVoting: boolean;
  isChangingVote: boolean;
  detail?: ProposalDetailData;
  /** True when the detail query failed (retry: false — no auto-retry). */
  detailErrored: boolean;
  /** Re-run the detail query (e.g. after a failure). */
  refetchDetail: () => void;
}

/**
 * Shared cast/change-vote state machine for one proposal.
 *
 * Extracted verbatim from the proposal detail page (state + callbacks) so the
 * /vote hub's live cards run the exact same code path as the detail page:
 * same `useCastVote`/`useChangeVote` mutations (toasts + cache invalidation),
 * same query key (`queryKeys.proposalDetail`), same optimistic `myVote`
 * handling. A cast from either surface invalidates the shared key and both
 * update together.
 */
export function useProposalVote(proposalId: string): UseProposalVoteResult {
  const { data: me } = useCurrentUser({ retry: false });
  const castVote = useCastVote(proposalId);
  const changeVote = useChangeVote(proposalId);
  const {
    data: detail,
    isError: detailErrored,
    refetch: refetchDetail,
  } = useProposalDetail(proposalId);

  // Track the user's vote. The detail payload now includes the current user's
  // ballot (C2.1) so returning voters see their choice on load; we also update
  // it optimistically after a successful cast.
  const [myVote, setMyVote] = useState<VoteChoice | null>(
    () => detail?.myVote?.choice ?? null,
  );
  const [prevServerChoice, setPrevServerChoice] = useState(detail?.myVote?.choice);

  // Keep local state in sync if the API result changes (e.g. refetch, navigation).
  // Uses the "adjust state during render" pattern recommended by the React team
  // to avoid setState-in-effect cascading renders.
  const serverChoice = detail?.myVote?.choice;
  if (serverChoice !== prevServerChoice) {
    setPrevServerChoice(serverChoice);
    setMyVote(serverChoice ?? null);
  }

  const onVote = useCallback(
    async (choice: VoteChoice) => {
      try {
        await castVote.mutateAsync(choice);
        setMyVote(choice);
      } catch {
        // toast surfaced by the mutation hook; keep button state clean.
      }
    },
    [castVote],
  );

  const onChangeVote = useCallback(
    async (choice: VoteChoice) => {
      try {
        await changeVote.mutateAsync(choice);
        setMyVote(choice);
      } catch {
        // toast surfaced by the mutation hook.
      }
    },
    [changeVote],
  );

  return {
    isAuthenticated: Boolean(me),
    votingPower: me?.votingPower,
    myVote,
    onVote,
    onChangeVote,
    isVoting: castVote.isPending,
    isChangingVote: changeVote.isPending,
    detail,
    detailErrored,
    refetchDetail: () => {
      void refetchDetail();
    },
  };
}
