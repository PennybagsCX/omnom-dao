"use client";

import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";
import { Loader2 } from "lucide-react";

interface VoteButtonProps {
  choice: VoteChoice;
  onVote: (choice: VoteChoice) => void;
  disabled?: boolean;
  isPending?: boolean;
  variant?: "default" | "compact";
  className?: string;
}

/**
 * Enhanced vote button component with loading states and accessibility.
 * Part of Phase 1: Core Voting Infrastructure enhancement.
 */
export function VoteButton({
  choice,
  onVote,
  disabled = false,
  isPending = false,
  variant = "default",
  className,
}: VoteButtonProps) {
  const cfg = VOTE_CHOICE_CONFIG[choice];
  
  const styles: Record<VoteChoice, string> = {
    [VoteChoice.FOR]: "border-emerald-600/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-emerald-500/50",
    [VoteChoice.AGAINST]: "border-rose-600/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 focus-visible:ring-rose-500/50",
    [VoteChoice.ABSTAIN]: "border-slate-600/50 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 focus-visible:ring-slate-500/50",
  };

  const compactStyles: Record<VoteChoice, string> = {
    [VoteChoice.FOR]: "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30",
    [VoteChoice.AGAINST]: "bg-rose-600/20 text-rose-400 hover:bg-rose-600/30",
    [VoteChoice.ABSTAIN]: "bg-slate-600/20 text-slate-300 hover:bg-slate-600/30",
  };

  const buttonStyles = variant === "compact" 
    ? compactStyles[choice]
    : styles[choice];

  const isLoading = isPending && disabled;

  return (
    <button
      type="button"
      onClick={() => onVote(choice)}
      disabled={disabled || isLoading}
      aria-label={`Cast ${cfg.label} vote`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-[44px]", // Touch target size for mobile
        variant === "default" ? "border" : "",
        buttonStyles,
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Casting...
        </>
      ) : (
        <>
          <span className="aria-hidden">{cfg.emoji}</span>
          {cfg.label}
        </>
      )}
    </button>
  );
}
