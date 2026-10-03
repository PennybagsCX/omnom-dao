"use client";

import { useQueries } from "@tanstack/react-query";

import {
  apiGet,
  queryKeys,
  useCurrentUser,
  type ProposalDetailData,
} from "@/lib/api";

/**
 * "Your ballots cast — X of N": how many of the referendum questions the
 * connected wallet currently has a ballot on. Reads the same per-proposal
 * detail queries the ballot cards use (myVote !== null = cast), so it updates
 * the moment any ballot is cast or changed. Not connected → 0 of N.
 */
export function YourBallotsCast({ proposalIds }: { proposalIds: string[] }) {
  const { data: me } = useCurrentUser({ retry: false });
  const viewer = me?.address ?? null;

  const detailQueries = useQueries({
    queries: proposalIds.map((id) => ({
      queryKey: queryKeys.proposalDetail(id, viewer),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGet<ProposalDetailData>(`/api/v1/proposals/${id}`, undefined, signal),
    })),
  });

  const cast = detailQueries.filter((q) => q.data?.myVote != null).length;

  return (
    <div>
      <div className="font-mono text-lg font-bold text-gold">
        {cast}/{proposalIds.length}
      </div>
      <div className="text-xs text-text-dim">Your ballots cast</div>
    </div>
  );
}
