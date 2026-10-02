import { Users } from "lucide-react";

import { HolderBadge } from "@/components/shared/holder-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Vote as VoteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalClassTally } from "@/lib/proposal-service";

/**
 * Holder-class turnout breakdown for a PROPOSAL ballot — the "Who has voted"
 * section, shared by the /vote hub (live vote), /results rows, /vote archive
 * cards, and proposal detail pages. One row per holder class: badge,
 * "N of M wallets voted", turnout %, a stacked FOR/AGAINST/ABSTAIN mini-bar,
 * and a per-choice count strip. (The /governance-vote page has its own
 * election-specific clone — four election choices, different data source.)
 */

const VOTE_BAR_CLASS: Record<string, string> = {
  FOR: "bg-emerald-500",
  AGAINST: "bg-rose-500",
  ABSTAIN: "bg-slate-500",
};

export function ProposalClassRow({ row }: { row: ProposalClassTally }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg-elevated/30 p-3 transition-colors",
        row.count > 0 && "border-border/80",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <HolderBadge holderClass={row.holderClass} size="sm" plain />
          <span className="truncate text-xs text-text-dim">
            {row.count.toLocaleString()} of {row.eligibleCount.toLocaleString()}{" "}
            wallets voted
          </span>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono font-bold text-gold">
            {row.turnoutPercentage.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-dim">
            turnout
          </div>
        </div>
      </div>

      {/* Mini stacked bar: one segment per choice, proportional to the
          choice's share of this class's ballots. */}
      <div
        className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-bg-elevated"
        role="img"
        aria-label={`${row.label} vote breakdown by choice`}
      >
        {row.count === 0 ? (
          <div className="h-full w-full bg-bg-elevated" aria-hidden />
        ) : (
          row.byChoice.map((bc) => {
            const widthPct = (bc.count / row.count) * 100;
            if (widthPct === 0) return null;
            return (
              <div
                key={bc.choice}
                className={cn("h-full transition-all duration-500", VOTE_BAR_CLASS[bc.choice])}
                style={{ width: `${widthPct}%` }}
                title={`${bc.label}: ${bc.count}`}
              />
            );
          })
        )}
      </div>

      {/* Per-choice label strip below the bar — gold counts, dim labels. */}
      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        {row.byChoice.map((bc) => (
          <div key={bc.choice} className="flex items-baseline gap-1.5">
            <span className="font-mono font-bold text-gold tabular-nums">
              {bc.count}
            </span>
            <span className="truncate text-text-dim" title={bc.label}>
              {bc.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full "Who has voted" card: centered header, per-class rows, and an empty
 * state when no ballots have been cast. Renders the rows it is given —
 * callers decide where the tallies come from (server tally per proposal).
 */
export function ClassBreakdownCard({
  tallies,
  className,
}: {
  tallies: ProposalClassTally[];
  className?: string;
}) {
  const ballotsCast = tallies.reduce((sum, row) => sum + row.count, 0);
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden /> Who has voted
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ballotsCast === 0 ? (
          <EmptyState
            icon={<VoteIcon className="h-12 w-12" />}
            title="No ballots yet"
            description="Check back as holders cast their ballots — this breakdown updates with every vote."
          />
        ) : (
          tallies.map((row) => <ProposalClassRow key={row.holderClass} row={row} />)
        )}
      </CardContent>
    </Card>
  );
}
