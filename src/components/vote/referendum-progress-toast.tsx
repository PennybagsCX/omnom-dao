"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useProposalDetail } from "@/lib/api";

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
 */
export function ReferendumProgressToast({ proposalIds }: { proposalIds: string[] }) {
  const total = proposalIds.length;
  const details = proposalIds.map((id) => useProposalDetail(id));
  const allLoaded = details.length > 0 && details.every((d) => d.isSuccess);
  const [progress, setProgress] = useState<number | null>(null);
  const baselineVoted = useRef<Set<string>>(new Set());
  const castThisPage = useRef<Set<string>>(new Set());

  // Baseline: once every question's detail has loaded, remember which
  // questions this wallet had already voted and how many that is.
  useEffect(() => {
    if (!allLoaded || progress !== null) return;
    const voted = new Set(
      proposalIds.filter((_, i) => details[i]?.data?.myVote != null),
    );
    baselineVoted.current = voted;
    setProgress(voted.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded]);

  // Progress counting: each first-time cast event on this page adds one.
  useEffect(() => {
    if (progress === null) return;
    const onCast = (e: Event) => {
      const proposalId = (e as CustomEvent<{ proposalId?: string }>).detail?.proposalId;
      if (!proposalId || castThisPage.current.has(proposalId)) return;
      castThisPage.current.add(proposalId);
      if (baselineVoted.current.has(proposalId)) return; // ballot change — no progress
      const next = Math.min(total, progress + 1);
      setProgress(next);
    };
    window.addEventListener("omnom:ballot-cast", onCast);
    return () => window.removeEventListener("omnom:ballot-cast", onCast);
  }, [progress, total, proposalIds]);

  // Toast on increases.
  const prevProgress = useRef<number | null>(null);
  useEffect(() => {
    if (progress === null) return;
    if (prevProgress.current === null) {
      prevProgress.current = progress;
      return;
    }
    if (progress > prevProgress.current) {
      const left = total - progress;
      if (left === 0) {
        toast.success(`🎉 All ${total} questions voted — you're done!`, {
          description:
            "Every rulebook question has your ballot. Thank you — you're a founding voter of how this DAO decides.",
        });
      } else {
        toast.success(`${progress} of ${total} questions voted`, {
          description: `${left} more to go — the next ballot is further down this page. Keep scrolling!`,
        });
      }
    }
    prevProgress.current = progress;
  }, [progress, total]);

  return null;
}
