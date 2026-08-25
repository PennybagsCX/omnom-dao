"use client";

import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";
import { CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

interface VoteSuccessProps {
  choice: VoteChoice;
  proposalTitle: string;
  votingPower: number;
  onClose: () => void;
  showViewDetails?: boolean;
  onViewDetails?: () => void;
}

/**
 * Success state component displayed after successful vote casting.
 * Includes confetti animation and clear confirmation of the vote.
 */
export function VoteSuccess({
  choice,
  proposalTitle,
  votingPower,
  onClose,
  showViewDetails = false,
  onViewDetails,
}: VoteSuccessProps) {
  const cfg = VOTE_CHOICE_CONFIG[choice];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Success card */}
      <div className="overflow-hidden rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-6 text-center">
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 10 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden />
        </motion.div>

        {/* Success message */}
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          Vote Successfully Cast!
        </h3>
        
        {/* Vote confirmation */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-bg-elevated/50 px-4 py-2">
          <span className={cn("text-xl", cfg.accentClass)}>{cfg.emoji}</span>
          <span className={cn("font-semibold", cfg.accentClass)}>{cfg.label}</span>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="rounded-md border border-border bg-bg-elevated/30 p-3">
            <p className="text-xs text-text-dim">Your voting power</p>
            <p className="font-mono font-semibold text-foreground">
              {votingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
            </p>
          </div>

          <div className="rounded-md border border-border bg-bg-elevated/30 p-3">
            <p className="text-xs text-text-dim">Proposal</p>
            <p className="text-xs font-medium text-foreground line-clamp-2">
              {proposalTitle}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {showViewDetails && onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className="flex-1 rounded-md border border-border bg-bg-elevated/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-bg-elevated"
            >
              View Vote Details
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-emerald-600/50 bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
          >
            Continue
          </button>
        </div>

        {/* Info message */}
        <p className="mt-4 text-xs text-text-dim">
          Your vote has been recorded on the blockchain. You can change your vote in the final 12 hours of the voting period.
        </p>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-surface text-text-dim transition-colors hover:bg-bg-elevated hover:text-foreground"
        aria-label="Close"
      >
        <XCircle className="h-4 w-4" aria-hidden />
      </button>
    </motion.div>
  );
}
