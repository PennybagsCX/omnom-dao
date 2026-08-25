"use client";

import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";

interface VoteBarProps {
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  /** Show numeric labels under each segment. */
  showLabels?: boolean;
  className?: string;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

/**
 * Horizontal vote breakdown bar showing FOR / AGAINST / ABSTAIN proportions
 * with colors and percentages. Widths animate via CSS transitions.
 */
export function VoteBar({
  votesFor,
  votesAgainst,
  votesAbstain,
  showLabels = true,
  className,
}: VoteBarProps) {
  const total = votesFor + votesAgainst + votesAbstain;
  const forPct = pct(votesFor, total);
  const againstPct = pct(votesAgainst, total);
  const abstainPct = pct(votesAbstain, total);

  const cfgFor = VOTE_CHOICE_CONFIG[VoteChoice.FOR];
  const cfgAgainst = VOTE_CHOICE_CONFIG[VoteChoice.AGAINST];
  const cfgAbstain = VOTE_CHOICE_CONFIG[VoteChoice.ABSTAIN];

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated"
        role="img"
        aria-label={`For ${forPct.toFixed(1)}%, Against ${againstPct.toFixed(1)}%, Abstain ${abstainPct.toFixed(1)}%`}
      >
        {forPct > 0 && (
          <div
            className={cn("h-full transition-all duration-500 ease-out", cfgFor.barClass)}
            style={{ width: `${forPct}%` }}
          />
        )}
        {againstPct > 0 && (
          <div
            className={cn("h-full transition-all duration-500 ease-out", cfgAgainst.barClass)}
            style={{ width: `${againstPct}%` }}
          />
        )}
        {abstainPct > 0 && (
          <div
            className={cn("h-full transition-all duration-500 ease-out", cfgAbstain.barClass)}
            style={{ width: `${abstainPct}%` }}
          />
        )}
      </div>

      {showLabels ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <LegendItem
            colorClass={cfgFor.barClass}
            label={cfgFor.label}
            pct={forPct}
            value={votesFor}
          />
          <LegendItem
            colorClass={cfgAgainst.barClass}
            label={cfgAgainst.label}
            pct={againstPct}
            value={votesAgainst}
          />
          <LegendItem
            colorClass={cfgAbstain.barClass}
            label={cfgAbstain.label}
            pct={abstainPct}
            value={votesAbstain}
          />
        </div>
      ) : null}
    </div>
  );
}

function LegendItem({
  colorClass,
  label,
  pct,
  value,
}: {
  colorClass: string;
  label: string;
  pct: number;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", colorClass)} />
      <span className="font-medium text-foreground">{label}</span>
      <span className="font-mono">{pct.toFixed(1)}%</span>
      <span className="font-mono text-text-dim">
        ({value.toLocaleString(undefined, { maximumFractionDigits: 2 })})
      </span>
    </span>
  );
}
