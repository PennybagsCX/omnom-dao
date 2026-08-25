"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { SNAPSHOT } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface HolderStatsBarProps {
  supplyRemainingPct?: number;
  className?: string;
}

interface SnapshotMetadataFile {
  totalSupply?: string;
  burnedSupply?: string;
}

function computeRemainingPct(meta: SnapshotMetadataFile | null): number | null {
  if (!meta?.totalSupply) return null;
  // Use BigInt to avoid precision loss with 1-quadrillion-scale wei values.
  // Number() silently breaks on values > 2^53, yielding wrong percentages.
  try {
    const total = BigInt(meta.totalSupply);
    const burned = BigInt(meta.burnedSupply ?? "0");
    if (total <= 0n) return null;
    // Multiply by 1000 before dividing for 1 decimal place precision.
    const pct = Number(((total - burned) * 1000n) / total) / 10;
    return pct;
  } catch {
    return null;
  }
}

/**
 * Weekly snapshot milestones for the timeline strip.
 * Shows the progression from baseline through the final post-shutdown capture.
 */
const SNAPSHOT_MILESTONES = [
  { label: "Baseline", date: "Jun 7", holders: 25_431 },
  { label: "W1", date: "Jun 14", holders: 25_344 },
  { label: "W2", date: "Jun 21", holders: 25_388 },
  { label: "W3", date: "Jun 28", holders: 25_442 },
  { label: "W4", date: "Jul 5", holders: 25_474 },
  { label: "W5", date: "Jul 6", holders: 25_477 },
  { label: "W6", date: "Jul 13", holders: 25_496 },
  { label: "W7", date: "Jul 20", holders: 25_521 },
  { label: "W8", date: "Jul 27", holders: 25_549 },
  { label: "W9", date: "Aug 3", holders: 25_546 },
  { label: "Final", date: "Aug 8", holders: 25_542 },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Stats bar for the landing page — the canonical snapshot provenance strip.
 *
 * Shows: total ever-held holders, multi-snapshot timeline, total supply,
 * and a link to the source data.
 */
export function HolderStatsBar({
  supplyRemainingPct,
  className,
}: HolderStatsBarProps) {
  const [computedPct, setComputedPct] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/snapshot-metadata.json", { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SnapshotMetadataFile | null) => {
        if (!cancelled) setComputedPct(computeRemainingPct(data));
      })
      .catch(() => {
        if (!cancelled) setComputedPct(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Known from snapshot: Vitalik burned 68.9% of supply → 31.1% remains.
  // Computed via BigInt to avoid JS precision loss on 1e33-scale wei values.
  const remainingPct = supplyRemainingPct ?? computedPct ?? 31.1;
  const supplyValue = `~${remainingPct.toFixed(1)}%`;

  const topStats: ReadonlyArray<{
    label: string;
    value: string;
    iconName: string;
    sublabel?: string;
  }> = [
    {
      label: "Ever-Held",
      value: SNAPSHOT.totalHolders.toLocaleString(),
      iconName: "Users",
      sublabel: "unique wallets",
    },
    {
      label: "Snapshots",
      value: "11",
      iconName: "Camera",
      sublabel: "Jun 7 – Aug 8",
    },
    {
      label: "Block",
      value: SNAPSHOT.blockNumber.toLocaleString(),
      iconName: "Package",
      sublabel: "baseline block",
    },
    {
      label: "Supply Left",
      value: supplyValue,
      iconName: "Coins",
      sublabel: "post-burn",
    },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg-surface/60 backdrop-blur-sm",
        className,
      )}
    >
      {/* Top row: key stats */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 px-6 py-5 sm:gap-x-10">
        {topStats.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2.5">
            {i > 0 && (
              <span
                aria-hidden
                className="hidden h-8 w-px bg-border sm:inline-block"
              />
            )}
            <DynamicIcon
              name={item.iconName}
              aria-hidden
              className="h-5 w-5 shrink-0 text-gold"
            />
            <div className="flex flex-col">
              <span className="font-mono text-base font-bold leading-tight text-foreground sm:text-lg">
                {item.value}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-text-dim">
                {item.label}
              </span>
              {item.sublabel && (
                <span className="text-[9px] text-text-dim/70">
                  {item.sublabel}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-border/60" />

      {/* Bottom row: multi-snapshot timeline */}
      <div className="px-6 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-text-dim">
            Snapshot Timeline
          </span>
          <a
            href="https://github.com/DBOT-DC/omnom-token"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-gold/70 transition-colors hover:text-gold"
          >
            Source Data
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </a>
        </div>

        {/* Timeline */}
        <div className="relative flex items-end justify-between gap-0.5">
          {/* Progress line */}
          <div className="absolute bottom-2.5 left-0 right-0 h-px bg-border" />

          {SNAPSHOT_MILESTONES.map((m, idx) => {
            const minH = Math.min(...SNAPSHOT_MILESTONES.map(s => s.holders));
            const maxH = Math.max(...SNAPSHOT_MILESTONES.map(s => s.holders));
            const range = maxH - minH || 1;
            const heightPct = ((m.holders - minH) / range) * 100;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.04, duration: 0.25, ease: EASE }}
                className="group relative flex flex-1 flex-col items-center gap-0.5"
                title={`${m.label}: ${m.holders.toLocaleString()} holders (${m.date})`}
              >
                {/* Tooltip on hover */}
                <span className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-gold opacity-0 transition-opacity group-hover:opacity-100">
                  {m.holders.toLocaleString()}
                </span>
                {/* Bar */}
                <div
                  className={cn(
                    "w-full max-w-[18px] rounded-t-sm transition-colors",
                    idx === SNAPSHOT_MILESTONES.length - 1
                      ? "bg-gold"
                      : "bg-gold/30 group-hover:bg-gold/50",
                  )}
                  style={{ height: `${Math.max(heightPct * 0.3 + 4, 6)}px` }}
                />
                {/* Dot */}
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    idx === 0
                      ? "bg-gold/40"
                      : idx === SNAPSHOT_MILESTONES.length - 1
                        ? "bg-gold"
                        : "bg-gold/30",
                  )}
                />
                {/* Date label — show every other one on mobile to avoid crowding */}
                <span className={cn(
                  "text-[8px] font-medium leading-none text-text-dim",
                  idx % 2 === 1 && "hidden sm:block",
                )}>
                  {m.date.split(" ")[0]}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Caption */}
        <p className="mt-3 text-center text-[10px] text-text-dim">
          All 11 snapshots (Jun 7 – Aug 8). Ever-held master list tracks every wallet that held $OMNOM.
        </p>
      </div>
    </div>
  );
}
