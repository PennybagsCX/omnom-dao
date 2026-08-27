"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  Copy,
  Database,
  ExternalLink,
  GitCommit,
  Loader2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HolderBadge } from "@/components/shared/holder-badge";
import { apiGet } from "@/lib/api";
import { cn, shortenAddress } from "@/lib/utils";
import { HOLDER_CLASS_ORDER, HOLDER_CLASS_CONFIG, DISTRIBUTION_KEY } from "@/lib/constants";
import type { HolderSortKey, SortDirection } from "@/lib/snapshot";
import { HolderClass } from "@/types";

interface SnapshotHolder {
  address: string;
  rank: number;
  balanceFormatted: string;
  percentageOfSupply: number;
  holderClass: HolderClass;
  maxPercentageOfSupply?: number;
  bestRank?: number;
  snapshotCount?: number;
  snapshots?: string[];
  firstSeen?: string;
  latestBalanceFormatted?: string;
  latestPercentageOfSupply?: number;
  latestRank?: number | null;
  currentlyHolds?: boolean;
}

interface SnapshotSummary {
  snapshotType: string;
  totalHolders: number;
  distribution: { krakens: number; whales: number; dolphins: number; sharks: number; octopuses: number; crabs: number; seahorses: number };
  blockNumber: number;
  timestamp: string;
  latestSnapshotDate?: string;
  latestSnapshotHolders?: number;
  sourceCommit: string;
  sourceRepository: string;
  sourceFile: string;
  sourceFileSha256: string;
  electionEligibility: string;
}

interface ExplorerListData {
  mode: "list";
  summary: SnapshotSummary;
  holders: SnapshotHolder[];
  holderClass: HolderClass | null;
}

interface ExplorerDetailData {
  mode: "address" | "rank";
  summary: SnapshotSummary;
  holder: SnapshotHolder;
}

const PAGE_SIZE = 25;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Initial direction when a column is clicked for the first time — balances
 * read most naturally biggest-first, identities smallest-first. */
const DEFAULT_SORT_DIRECTION: Record<HolderSortKey, SortDirection> = {
  rank: "asc",
  address: "asc",
  class: "asc",
  balance: "desc",
  percentage: "desc",
  latestBalance: "desc",
  holds: "desc",
};

const SORTABLE_COLUMNS: readonly {
  label: string;
  column: HolderSortKey;
  align: "left" | "right" | "center";
}[] = [
  { label: "Rank", column: "rank", align: "left" },
  { label: "Wallet", column: "address", align: "left" },
  { label: "Class", column: "class", align: "left" },
  { label: "Max balance", column: "balance", align: "right" },
  { label: "Max supply %", column: "percentage", align: "right" },
  { label: "Latest balance", column: "latestBalance", align: "right" },
  { label: "Holds", column: "holds", align: "center" },
];

function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatTokens(value: string | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Reads `?address=` from the URL and forwards it to the explorer as a seed.
 * Mirrors the proposals-page pattern (DESIGN.md §7.5): this is the ONLY
 * component inside a `<Suspense>` boundary, keeping the data-heavy explorer
 * — and its fetches — resolving on cold load instead of hanging behind the
 * prerendered static fallback.
 */
function ExplorerSearchParams({ onSeed }: { onSeed: (address: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onSeed(searchParams.get("address") ?? "");
  }, [searchParams, onSeed]);

  return null;
}

export default function SnapshotExplorerPage() {
  const [seed, setSeed] = useState<string | null>(null);
  const onSeed = useCallback((address: string) => setSeed(address), []);

  return (
    <>
      <Suspense fallback={null}>
        <ExplorerSearchParams onSeed={onSeed} />
      </Suspense>
      <SnapshotExplorer seed={seed} />
    </>
  );
}

function SnapshotExplorer({ seed }: { seed: string | null }) {
  // Seeded from `?address=` (deep links from comments, cards, and admin
  // surfaces). Both `input` and `query` are set so the address lookup is the
  // FIRST query key — no wasted default-list fetch or table flash while the
  // 300ms debounce settles (it settles to the same string → no refetch).
  const [input, setInput] = useState(seed ?? "");
  const [query, setQuery] = useState(seed ?? "");
  const [appliedSeed, setAppliedSeed] = useState<string | null>(seed);
  if (seed !== null && seed !== appliedSeed) {
    setAppliedSeed(seed);
    setInput(seed);
    setQuery(seed);
  }
  const [classFilter, setClassFilter] = useState<"ALL" | HolderClass>("ALL");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<HolderSortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const onSort = useCallback(
    (column: HolderSortKey) => {
      setPage(1);
      if (column === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(column);
        setSortDir(DEFAULT_SORT_DIRECTION[column]);
      }
    },
    [sortKey],
  );

  // Debounce raw keyboard input. Each settled string becomes the definitive
  // `query`; every settled query gets its own React Query cache key.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = input.trim();
      setQuery((previous) => {
        if (previous !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const trimmed = query;
  const isAddressPrefix =
    /^0x[0-9a-fA-F]{3,39}$/i.test(trimmed) &&
    !/^0x[0-9a-fA-F]{40}$/.test(trimmed);
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  const isRank = /^\d+$/.test(trimmed);
  const invalidFullAddress =
    /^0x[0-9a-zA-Z]{40,}$/.test(trimmed) && !isAddress;

  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: sortKey,
      dir: sortDir,
    });
    if (classFilter !== "ALL") p.set("class", classFilter);
    if (isAddress) p.set("address", trimmed.toLowerCase());
    if (isAddressPrefix) p.set("prefix", trimmed.toLowerCase());
    if (isRank) p.set("rank", trimmed);
    return p;
  }, [classFilter, isAddress, isAddressPrefix, isRank, page, sortDir, sortKey, trimmed]);

  const { data, isFetching, isLoading, isError, error } = useQuery<
    ExplorerListData | ExplorerDetailData
  >({
    placeholderData: (previous) => previous,
    queryKey: ["snapshot-explorer", params.toString()],
    queryFn: ({ signal }) =>
      apiGet<ExplorerListData | ExplorerDetailData>(
        `/api/v1/snapshot-explorer`,
        Object.fromEntries(params.entries()),
        signal,
      ),
  });

  const summary = data?.summary;
  const holder = data?.mode === "address" || data?.mode === "rank" ? data.holder : null;
  const holders = data?.mode === "list" ? data.holders : [];
  const totalPages =
    classFilter === "ALL"
      ? Math.ceil((summary?.totalHolders ?? 0) / PAGE_SIZE)
      : Math.ceil(
          (summary?.distribution[DISTRIBUTION_KEY[classFilter] ?? "seahorses"] ?? 0) / PAGE_SIZE,
        );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="mb-2 flex items-center justify-center gap-2">
          <Database className="h-6 w-6 text-gold" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Snapshot Explorer
          </h1>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Search the same pinned ever-held snapshot data used for election
          eligibility. Look up any wallet, inspect balance history, and verify
          concentration data without visiting GitHub.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        className="mt-6 grid gap-3 text-center sm:grid-cols-3"
      >
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-4">
          <div className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-foreground">
            <Users className="h-4 w-4 text-gold" aria-hidden />
            {(summary?.totalHolders ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-text-dim">ever-held wallets</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-4">
          <div className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-foreground">
            <CalendarClock className="h-4 w-4 text-gold" aria-hidden />
            {summary?.latestSnapshotDate ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-text-dim">latest capture</div>
        </div>
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-4">
          <div className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-foreground">
            <GitCommit className="h-4 w-4 text-gold" aria-hidden />
            {summary?.sourceCommit?.slice(0, 7) ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-text-dim">pinned source</div>
        </div>
      </motion.div>

      {/* Tier legend: what each class means, with one-tap filtering (mirrors the class Select). */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4, ease: EASE }}
        aria-label="Holder class legend"
        className="mt-6"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Holder classes
          </h2>
          <p className="text-[10px] uppercase tracking-wide text-text-dim">
            Tap a card to filter
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOLDER_CLASS_ORDER.map((cls) => {
            const cfg = HOLDER_CLASS_CONFIG[cls];
            const active = classFilter === cls;
            return (
              <button
                key={cls}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setClassFilter(active ? "ALL" : cls);
                  setInput("");
                  setQuery("");
                  setPage(1);
                }}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50",
                  active
                    ? "border-gold/50 bg-gold/5"
                    : "border-border bg-bg-elevated/40 hover:border-gold/30 hover:bg-bg-elevated/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <HolderBadge holderClass={cls} size="sm" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatNumber(summary?.distribution[DISTRIBUTION_KEY[cls]])}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-text-dim">
                  {cfg.threshold > 0 ? `≥ ${cfg.threshold}% of supply` : cfg.thresholdLabel}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {cfg.description}
                </p>
              </button>
            );
          })}
        </div>
      </motion.section>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
          setPage(1);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Start typing a wallet address or rank number… live results update automatically"
            aria-label="Search snapshot by address or rank"
            className="w-full rounded-lg border border-border bg-bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-text-dim focus:border-gold/50 focus:ring-1 focus:ring-gold/50"
          />
          {isFetching && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gold"
              aria-hidden
            />
          )}
          <span className="sr-only" aria-live="polite">
            {isFetching ? "Searching snapshot data" : "Search results updated"}
          </span>
        </div>
        <Select
          value={classFilter}
          onValueChange={(v) => {
            setClassFilter(v as "ALL" | HolderClass);
            setInput("");
            setQuery("");
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by holder class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All classes</SelectItem>
            {HOLDER_CLASS_ORDER.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {HOLDER_CLASS_CONFIG[cls].plural.charAt(0).toUpperCase() + HOLDER_CLASS_CONFIG[cls].plural.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="lg" className="sm:w-32">
          Search
        </Button>
      </motion.form>

      {!isFetching && trimmed && !isAddressPrefix && !invalidFullAddress && (
        <p className="mt-2 text-center text-xs text-text-dim" role="status">
          Showing live results for <span className="font-mono text-foreground">{trimmed}</span>
        </p>
      )}

      {isAddressPrefix && (
        <p className="mt-2 text-xs text-text-dim" role="status">
          Showing wallet addresses that start with{" "}
          <span className="font-mono text-foreground">{trimmed.toLowerCase()}</span>
          {holders.length === 0 ? " — no matches yet" : ""}
        </p>
      )}
      {invalidFullAddress && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/5 p-4 text-center text-sm text-danger">
          That is not a valid EVM address. A wallet address must be 0x followed by exactly 40 hexadecimal characters.
        </div>
      )}

      {isError && (
        <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4 text-center text-sm text-warning" role="status">
          {isRank && Number(trimmed) > (summary?.totalHolders ?? 0)
            ? `No wallet has rank ${trimmed}. Ranks currently run from 1 through ${(summary?.totalHolders ?? 0).toLocaleString()}.`
            : error instanceof Error
              ? error.message
              : "Lookup failed."}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden />
        </div>
      )}

      {holder && !isLoading && (
        <Card className="mt-6">
          <CardContent className="p-5">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gold" aria-hidden />
                <h2 className="text-lg font-semibold text-foreground">Wallet found</h2>
              </div>
              <code className="break-all rounded bg-bg-elevated px-2 py-1 text-xs text-gold">
                {holder.address}
              </code>
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <Copy className="h-3 w-3" aria-hidden />
                {shortenAddress(holder.address)}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Class" value={holder.holderClass}>
                <HolderBadge holderClass={holder.holderClass} size="sm" plain />
              </Metric>
              <Metric label="Ever-held rank" value={`#${formatNumber(holder.rank)}`} />
              <Metric label="Max balance" value={formatTokens(holder.balanceFormatted)} />
              <Metric label="Max supply %" value={`${formatNumber(holder.maxPercentageOfSupply ?? holder.percentageOfSupply)}%`} />
              <Metric label="Best rank" value={`#${formatNumber(holder.bestRank)}`} />
              <Metric label="Snapshots" value={formatNumber(holder.snapshotCount)} />
              <Metric label="First seen" value={holder.firstSeen ?? "—"} />
              <Metric
                label="Currently holds"
                value={holder.currentlyHolds ? "Yes" : "No"}
              />
              <Metric label="Latest balance" value={formatTokens(holder.latestBalanceFormatted)} />
              <Metric label="Latest supply %" value={`${formatNumber(holder.latestPercentageOfSupply)}%`} />
              <Metric label="Latest rank" value={holder.latestRank ? `#${formatNumber(holder.latestRank)}` : "—"} />
            </div>

            {holder.snapshots?.length ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Snapshot appearances</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {holder.snapshots.map((snapshot) => (
                    <span
                      key={snapshot}
                      className="rounded-full border border-border bg-bg-elevated/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {snapshot}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {!holder && !isLoading && !invalidFullAddress && (
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-text-dim">
                    {SORTABLE_COLUMNS.map((col) => (
                      <SortableTh
                        key={col.column}
                        label={col.label}
                        column={col.column}
                        align={col.align}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h) => (
                    <tr key={h.address} className="border-b border-border/60">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        #{h.rank.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-foreground">{shortenAddress(h.address)}</code>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <HolderBadge holderClass={h.holderClass} size="sm" plain />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatTokens(h.balanceFormatted)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatNumber(h.maxPercentageOfSupply ?? h.percentageOfSupply)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                        {formatTokens(h.latestBalanceFormatted)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            h.currentlyHolds
                              ? "bg-success/10 text-success"
                              : "bg-bg-elevated text-text-dim",
                          )}
                        >
                          {h.currentlyHolds ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {holders.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No wallets match this search.
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-text-dim">
                Page {page.toLocaleString()} of {totalPages.toLocaleString()}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 rounded-xl border border-border bg-bg-elevated/20 p-4 text-xs text-text-dim">
        <div className="flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:gap-1.5">
          <Database className="h-3.5 w-3.5 text-gold" aria-hidden />
          <span className="text-center sm:text-left">Read-only exploration of the exact platform snapshot artifact</span>
        </div>
        <p className="mt-2 text-center">
          Ever-held means a wallet held $OMNOM at any point during the 11-snapshot window.
          Max balance is the largest recorded balance, not necessarily the latest balance.
        </p>
        <p className="mt-1 text-center">
          Source: {summary?.sourceRepository}/{summary?.sourceFile} @ {summary?.sourceCommit?.slice(0, 7)}
          {" · "}
          <a
            href={
              summary?.sourceRepository && summary?.sourceCommit
                ? `https://github.com/${summary.sourceRepository}/tree/${summary.sourceCommit}`
                : "https://github.com/PennybagsCX/omnom-dao"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
          >
            View repository <ExternalLink className="inline h-3 w-3" aria-hidden />
          </a>
        </p>
        <p className="mt-1 text-center font-mono">SHA-256 {summary?.sourceFileSha256}</p>
        <p className="mt-3 text-center">
          Use this data to inform your vote in the{" "}
          <Link
            href="/governance-vote"
            className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
          >
            Foundational Governance Election
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Click-to-sort table header. The whole header cell is announced via
 * `aria-sort`; the inner button drives the toggle (same column → reverse
 * direction, new column → its natural default direction).
 */
function SortableTh({
  label,
  column,
  align = "left",
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: HolderSortKey;
  align?: "left" | "right" | "center";
  sortKey: HolderSortKey;
  sortDir: SortDirection;
  onSort: (column: HolderSortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "px-4 py-3",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        title={
          active
            ? `Sorted by ${label}, ${sortDir === "asc" ? "ascending" : "descending"} — click to reverse`
            : `Sort by ${label}`
        }
        className={cn(
          "group inline-flex cursor-pointer items-center gap-1 whitespace-nowrap uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50",
          active && "text-gold",
        )}
      >
        <span>{label}</span>
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown
            className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        )}
      </button>
    </th>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  /** Optional node replacing the plain value (e.g. a HolderBadge). */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-text-dim">{label}</div>
      {children ? (
        <div className="mt-1 text-sm">{children}</div>
      ) : (
        <div className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</div>
      )}
    </div>
  );
}
