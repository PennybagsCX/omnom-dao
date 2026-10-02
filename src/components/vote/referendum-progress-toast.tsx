"use client";

import { useEffect, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  apiGet,
  queryKeys,
  useCurrentUser,
  type ProposalDetailData,
} from "@/lib/api";

/**
 * Cross-ballot progress toasts for the referendum hub. With three ballots on
 * one page, voters can finish one and never scroll to the rest — so every
 * time the number of completed questions goes UP while the page is open, a
 * toast says where they stand ("2 of 3 voted — 1 to go") and celebrates the
 * last one.
 *
 * Signal: the ballot mutations dispatch `omnom:ballot-cast` window events on
 * success (deterministic — no refetch timing involved). The component takes
 * its baseline once every question's detail has loaded, then counts each
 * event for a proposal that was NOT already voted at baseline (a ballot
 * change on an already-voted question never toasts). Renders nothing.
 *
 * Hooks note: one `useQueries` for the whole list (hooks can't be called in
 * a .map callback), and the toast count lives in refs — the only state that
 * changes is external (the window event bus), so there is no setState at all.
 */
export function ReferendumProgressToast({ proposalIds }: { proposalIds: string[] }) {
  const total = proposalIds.length;
  const { data: me } = useCurrentUser({ retry: false });
  const viewer = me?.address?.toLowerCase() ?? null;

  // One query per question — same shape as useProposalDetail (viewer-scoped
  // key, no retry) but for the whole ballot list in a single hook call.
  const details = useQueries({
    queries: proposalIds.map((id) => ({
      queryKey: queryKeys.proposalDetail(id, viewer),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiGet<ProposalDetailData>(`/api/v1/proposals/${id}`, undefined, signal),
      enabled: id.length > 0,
      retry: false,
    })),
  });

  const allLoaded = total > 0 && details.every((d) => d.isSuccess);
  const baselineVoted = useRef<Set<string> | null>(null);
  const castThisPage = useRef<Set<string>>(new Set());

  // Baseline: once every question's detail has loaded, remember which
  // questions this wallet had already voted. (Ref, not state — the baseline
  // never renders; it only gates the counting below.)
  useEffect(() => {
    if (!allLoaded || baselineVoted.current !== null) return;
    baselineVoted.current = new Set(
      proposalIds.filter((_, i) => details[i]?.data?.myVote != null),
    );
  }, [allLoaded, proposalIds, details]);

  // Progress counting + toast, straight off the event: each first-time cast
  // on a not-already-voted question advances the count and toasts inline.
  useEffect(() => {
    const onCast = (e: Event) => {
      const baseline = baselineVoted.current;
      if (!baseline) return; // replay before baseline — page-load noise
      const proposalId = (e as CustomEvent<{ proposalId?: string }>).detail?.proposalId;
      if (!proposalId || castThisPage.current.has(proposalId)) return;
      castThisPage.current.add(proposalId);
      if (baseline.has(proposalId)) return; // ballot change — no progress
      const freshCasts = [...castThisPage.current].filter((id) => !baseline.has(id)).length;
      const done = Math.min(total, baseline.size + freshCasts);
      const left = total - done;
      if (left === 0) {
        toast.success(`🎉 All ${total} questions voted — you're done!`, {
          description:
            "Every rulebook question has your ballot. Thank you — you're a founding voter of how this DAO decides.",
        });
      } else {
        toast.success(`${done} of ${total} questions voted`, {
          description: `${left} more to go — the next ballot is further down this page. Keep scrolling!`,
        });
      }
    };
    window.addEventListener("omnom:ballot-cast", onCast);
    return () => window.removeEventListener("omnom:ballot-cast", onCast);
  }, [total]);

  return null;
}
