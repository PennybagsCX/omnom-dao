"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { QuorumProgress } from "@/components/shared/quorum-progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ProposalStatus } from "@/types";

export interface PastVoteElectionResult {
  choice: string;
  label: string;
  count: number;
  percentage: number;
}

export interface PastVoteItem {
  /** Stable, non-empty select key (Radix rejects empty values). */
  key: string;
  kind: "ELECTION" | "PROPOSAL";
  label: string;
  status?: ProposalStatus;
  /** "Aug 29 – Sep 12, 2026 (UTC)" — preformatted server-side. */
  windowLabel: string | null;
  tallies?: { for: number; against: number; abstain: number };
  quorum?: { achieved: number | null; required: number };
  electionResults?: PastVoteElectionResult[];
  totalBallots?: number;
  href: string;
}

/**
 * Bar colors per FGE voting method — mirrors the CHOICE_COLORS maps on
 * /governance-vote and /results so all three surfaces read as one system.
 */
const CHOICE_COLORS: Record<string, string> = {
  QUADRATIC: "bg-gold",
  ONE_WALLET_ONE_VOTE: "bg-blue-500",
  TIERED: "bg-emerald-500",
  LINEAR: "bg-zinc-500",
};

/**
 * Past-votes archive for the /vote hub: a dropdown of every decided vote
 * (the Foundational Governance Election + all finalized proposals) with an
 * inline outcome summary and a deep link to the full record. Selection state
 * is local — each item deep-links to its own canonical page, so URL sync
 * would only duplicate routes.
 */
export function PastVotesArchive({ items }: { items: PastVoteItem[] }) {
  const [selectedKey, setSelectedKey] = useState(items[0]?.key ?? "");
  const selected = items.find((item) => item.key === selectedKey) ?? items[0];

  if (!selected) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        No past votes yet — outcomes appear here once a voting window closes.
      </p>
    );
  }

  const leader =
    selected.electionResults?.reduce<PastVoteElectionResult | null>(
      (best, r) => (r.count > 0 && (best === null || r.count > best.count) ? r : best),
      null,
    ) ?? null;

  return (
    <div className="mt-4">
      <Select value={selectedKey} onValueChange={setSelectedKey}>
        <SelectTrigger
          data-testid="past-votes-select"
          // Shared trigger is h-9 (36px) — below the 44px mobile touch target.
          className="h-11 min-w-0 sm:h-9"
          aria-label="Select a past vote"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.key} value={item.key}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        data-testid="past-votes-summary"
        aria-live="polite"
        className="mt-3 rounded-xl border border-border bg-bg-elevated/30 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="line-clamp-2 min-w-0 break-words text-base font-semibold text-foreground">
            {selected.label}
          </h3>
          {selected.kind === "PROPOSAL" && selected.status ? (
            <ProposalStatusBadge status={selected.status} />
          ) : null}
        </div>

        {selected.windowLabel && (
          <p className="mt-1 text-xs text-text-dim">Voted {selected.windowLabel}</p>
        )}

        {/* FGE outcome banner — same gold style as the /results winner box. */}
        {selected.kind === "ELECTION" && leader && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4 text-center sm:p-5">
            <div className="text-xs uppercase tracking-widest text-text-dim">
              Winning choice
            </div>
            <div className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
              {leader.label}
            </div>
            <div className="mt-1 font-mono text-base font-bold text-gold">
              {leader.percentage.toFixed(1)}% of {(selected.totalBallots ?? 0).toLocaleString()} ballots
            </div>
          </div>
        )}

        {/* Proposal tallies — same grid as the /results outcome rows. */}
        {selected.tallies && (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <TallyCell
              value={selected.tallies.for.toLocaleString()}
              label="For"
              valueClass="text-emerald-300"
            />
            <TallyCell
              value={selected.tallies.against.toLocaleString()}
              label="Against"
              valueClass="text-rose-300"
            />
            <TallyCell
              value={selected.tallies.abstain.toLocaleString()}
              label="Abstain"
              valueClass="text-gold"
            />
            <TallyCell
              value={
                selected.quorum?.achieved != null
                  ? `${selected.quorum.achieved.toFixed(1)}%`
                  : "—"
              }
              suffix={
                selected.quorum ? (
                  <span className="text-xs font-normal text-text-dim">
                    {" "}
                    / {selected.quorum.required}%
                  </span>
                ) : null
              }
              label="Quorum"
              valueClass="text-gold"
            />
          </div>
        )}

        {selected.quorum && selected.quorum.achieved != null && (
          <QuorumProgress
            className="mt-4"
            achieved={selected.quorum.achieved}
            required={selected.quorum.required}
          />
        )}

        {/* FGE per-choice bars — same markup as /results. */}
        {selected.electionResults && (
          <div className="mt-4 space-y-3">
            {selected.electionResults.map((result) => (
              <div key={result.choice} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{result.label}</span>
                  <span className="font-mono font-bold text-gold">
                    {result.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className={cn("h-full", CHOICE_COLORS[result.choice])}
                    style={{ width: `${result.percentage}%` }}
                  />
                </div>
                <div className="text-right text-xs text-text-dim">
                  {result.count.toLocaleString()} ballots
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 text-center">
          <Link
            href={selected.href}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold sm:min-h-9"
          >
            View full details <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TallyCell({
  value,
  suffix,
  label,
  valueClass,
}: {
  value: string;
  suffix?: React.ReactNode;
  label: string;
  valueClass: string;
}) {
  return (
    <div>
      <div className={cn("font-mono text-sm font-bold", valueClass)}>
        {value}
        {suffix}
      </div>
      <div className="text-xs text-text-dim">{label}</div>
    </div>
  );
}
