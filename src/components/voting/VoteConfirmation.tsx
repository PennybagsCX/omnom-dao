"use client";

import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VoteConfirmationProps {
  isOpen: boolean;
  choice: VoteChoice | null;
  proposalTitle: string;
  votingPower: number;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Vote confirmation modal for safety and transparency.
 * Shows the user exactly what they're voting for before submission.
 */
export function VoteConfirmation({
  isOpen,
  choice,
  proposalTitle,
  votingPower,
  isPending,
  onConfirm,
  onCancel,
}: VoteConfirmationProps) {
  if (!choice) return null;

  const cfg = VOTE_CHOICE_CONFIG[choice];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", cfg.barClass)}>
              <span className="text-lg">{cfg.emoji}</span>
            </span>
            Confirm Your Vote
          </DialogTitle>
          <DialogDescription>
            You are about to cast a <span className={cn("font-semibold", cfg.accentClass)}>{cfg.label}</span> vote.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Proposal context */}
          <div className="rounded-lg border border-border bg-bg-elevated/50 p-3">
            <p className="text-xs text-text-dim">Proposal</p>
            <p className="mt-1 text-sm font-medium text-foreground line-clamp-2">
              {proposalTitle}
            </p>
          </div>

          {/* Voting power */}
          <div className="rounded-lg border border-border bg-bg-elevated/50 p-3">
            <p className="text-xs text-text-dim">Your Voting Power</p>
            <p className="mt-1 text-sm font-mono font-semibold text-foreground">
              {votingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens
            </p>
          </div>

          {/* Vote confirmation warning */}
          {choice === VoteChoice.AGAINST && (
            <div className="flex items-start gap-2 rounded-md border border-rose-600/30 bg-rose-500/10 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" aria-hidden />
              <p className="text-xs text-rose-200">
                You are voting AGAINST this proposal. This vote will be recorded publicly.
              </p>
            </div>
          )}

          {/* Final confirmation text */}
          <p className="text-xs text-text-dim text-center">
            This action cannot be undone until the final 12 hours of voting.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex-1 sm:flex-none",
              choice === VoteChoice.FOR && "bg-emerald-600 hover:bg-emerald-700",
              choice === VoteChoice.AGAINST && "bg-rose-600 hover:bg-rose-700",
              choice === VoteChoice.ABSTAIN && "bg-slate-600 hover:bg-slate-700"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                Casting Vote...
              </>
            ) : (
              <>
                <span className="mr-2">{cfg.emoji}</span>
                Confirm {cfg.label}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
