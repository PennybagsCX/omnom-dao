"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useProposalDetail } from "@/lib/api";

/**
 * Cross-ballot progress toasts for the referendum hub. With three ballots on
 * one page, voters can finish one and never scroll to the rest — so every
 * time the number of completed questions goes UP, a toast says where they
 * stand ("2 of 3 voted — 1 to go") and celebrates the last one.
 *
 * Reads the same proposal-detail queries the ballot cards use (shared cache,
 * no extra fetches); fires only when the completed count INCREASES — changing
 * an existing ballot never toasts. Renders nothing.
 */
export function ReferendumProgressToast({ proposalIds }: { proposalIds: string[] }) {
  const total = proposalIds.length;
  const details = proposalIds.map((id) => useProposalDetail(id));
  const completed = details.filter((d) => d.data?.myVote != null).length;
  const prevCompleted = useRef<number | null>(null);

  useEffect(() => {
    // First observation establishes the baseline — never toast on load,
    // even if the voter already finished some questions earlier.
    if (prevCompleted.current === null) {
      prevCompleted.current = completed;
      return;
    }
    if (completed > prevCompleted.current) {
      const left = total - completed;
      if (left === 0) {
        toast.success(`🎉 All ${total} questions voted — you're done!`, {
          description:
            "Every rulebook question has your ballot. Thank you — you're a founding voter of how this DAO decides.",
        });
      } else {
        toast.success(`${completed} of ${total} questions voted`, {
          description: `${left} more to go — the next ballot is further down this page. Keep scrolling!`,
        });
      }
    }
    prevCompleted.current = completed;
  }, [completed, total]);

  return null;
}
