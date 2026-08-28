"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ClipboardList,
  Filter,
  PlusCircle,
  RotateCcw,
  Search,
  Timer,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProposalCard } from "@/components/shared/proposal-card";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useCurrentUser, useProposals, fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { FGE_VOTING_ENDS_AT, FGE_VOTING_STARTS_AT } from "@/lib/election";
import {
  ProposalStatus,
  ProposalType,
  type Proposal,
} from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

const STATUS_TABS: { value: "all" | ProposalStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: ProposalStatus.DRAFT, label: "Draft" },
  { value: ProposalStatus.PENDING_REVIEW, label: "Pending Review" },
  { value: ProposalStatus.ACTIVE, label: "Active" },
  { value: ProposalStatus.PASSED, label: "Passed" },
  { value: ProposalStatus.FAILED, label: "Failed" },
  { value: ProposalStatus.EXPIRED, label: "Expired" },
];

const TYPE_OPTIONS: { value: "all" | ProposalType; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: ProposalType.CHAIN_SELECTION, label: "Chain Selection" },
  { value: ProposalType.TOKENOMICS_CHANGE, label: "Tokenomics Change" },
  { value: ProposalType.TREASURY, label: "Treasury" },
  { value: ProposalType.GUIDELINE, label: "Community Guideline" },
  { value: ProposalType.TECHNICAL, label: "Technical" },
  { value: ProposalType.GENERAL, label: "General" },
];

type SortValue = "createdAt:desc" | "createdAt:asc" | "votesFor:desc" | "votingEndsAt:asc";
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "votesFor:desc", label: "Most Voted" },
  { value: "votingEndsAt:asc", label: "Ending Soon" },
];

const PAGE_SIZE = 9;

/**
 * Watchdog: maximum time (ms) the proposals query may stay in its initial
 * loading state before we surface an error fallback. Without this, a fetch
 * that hangs indefinitely (e.g. an unavailable DB in dev) leaves the page on
 * the loading skeleton forever — React Query with `retry: false` only guards
 * against *retries*, not an in-flight request that never settles.
 */
const LOADING_TIMEOUT_MS = 10_000;

/**
 * Parsed snapshot of the URL search params relevant to the proposals filters.
 * `null` means "not yet seeded from the URL" (initial render / SSR).
 */
interface ProposalsUrlSeed {
  status: "all" | ProposalStatus;
  type: "all" | ProposalType;
  sort: SortValue;
}

/**
 * Tiny component that reads `useSearchParams()` and forwards the parsed
 * filter seed to the parent. This is the ONLY component wrapped in a
 * `<Suspense>` boundary — keeping the data-heavy `ProposalsList` outside of
 * Suspense prevents the Next.js 15 cold-load bug where the static fallback
 * (loading skeleton) is prerendered and the suspended subtree never resolves
 * on direct navigation / hard refresh. (See DESIGN.md §7.5.)
 */
function ProposalsSearchParams({
  onSeed,
}: {
  onSeed: (seed: ProposalsUrlSeed) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onSeed({
      status: (searchParams.get("status") as ProposalStatus) ?? "all",
      type: (searchParams.get("type") as ProposalType) ?? "all",
      sort: (searchParams.get("sort") as SortValue) ?? "createdAt:desc",
    });
  }, [searchParams, onSeed]);

  return null;
}

/**
 * Proposals list page (DESIGN.md §7.5).
 *
 * Public route. Filter bar (status tabs + type select + sort select + search),
 * responsive card grid, "Load More" pagination, and dedicated loading / empty
 * (no-proposals vs filtered-empty) / error states. Authenticated visitors get
 * a "Create Proposal" CTA in the header.
 *
 * NOTE: `ProposalsList` is rendered directly (NOT inside `<Suspense>`). Only
 * `ProposalsSearchParams` is wrapped in a Suspense boundary, which keeps the
 * list — and its data fetching — resolving on cold load. See the comment on
 * `ProposalsSearchParams` for details.
 */
export default function ProposalsPage() {
  const [seed, setSeed] = useState<ProposalsUrlSeed | null>(null);
  const onSeed = useCallback((s: ProposalsUrlSeed) => setSeed(s), []);

  return (
    <>
      <Suspense fallback={null}>
        <ProposalsSearchParams onSeed={onSeed} />
      </Suspense>
      <ProposalsList seed={seed} />
    </>
  );
}

function ProposalsList({ seed }: { seed: ProposalsUrlSeed | null }) {
  const router = useRouter();

  const { data: me } = useCurrentUser({ retry: false });
  const isAuthenticated = Boolean(me);

  // Fetch election phase so we can show a banner with the proposal-unlock
  // countdown. Refresh every 5 minutes; the value rarely changes.
  const { data: election } = useQuery({
    queryKey: ["election", "phase"],
    queryFn: () =>
      fetchApi<{
        phase: "UPCOMING" | "OPEN" | "CLOSED";
        startsAt: string;
        endsAt: string;
      }>("/api/v1/governance-vote"),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const proposalsUnlocked = election?.phase === "CLOSED";

  // ── Filter state ─────────────────────────────────────────────
  // Seeded from the URL only after the (Suspense-wrapped) `ProposalsSearchParams`
  // component reports back. Until then we render with sensible defaults so the
  // list + skeleton resolve immediately on cold load instead of being stuck
  // behind the Suspense fallback.
  const [statusFilter, setStatusFilter] = useState<"all" | ProposalStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ProposalType>("all");
  const [sort, setSort] = useState<SortValue>("createdAt:desc");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Apply the URL seed whenever it arrives (and before the user touches anything).
  // Uses the "adjust state during render" pattern to avoid cascading renders.
  const [prevSeed, setPrevSeed] = useState<typeof seed | undefined>(undefined);
  if (seed && seed !== prevSeed) {
    setPrevSeed(seed);
    setStatusFilter(seed.status);
    setTypeFilter(seed.type);
    setSort(seed.sort);
  }

  const filters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      type: typeFilter === "all" ? undefined : typeFilter,
      sortBy: sort.split(":")[0] as "createdAt" | "votingEndsAt" | "votesFor",
      sortOrder: sort.split(":")[1] as "asc" | "desc",
      pageSize,
    }),
    [statusFilter, typeFilter, sort, pageSize],
  );

  const { data, isLoading, isError, isFetching, refetch } = useProposals(filters);

  // ── Loading watchdog ─────────────────────────────────────────
  // If the initial query stays in `isLoading` longer than LOADING_TIMEOUT_MS,
  // flip to a synthetic error state so users never stare at a skeleton forever.
  // Reset whenever the query leaves the loading state or is manually retried.
  const [timedOut, setTimedOut] = useState(false);
  const [prevLoading, setPrevLoading] = useState(isLoading);
  // Reset the timeout flag as soon as loading finishes — done during render
  // to avoid a setState-in-effect cascading render.
  if (prevLoading !== isLoading) {
    setPrevLoading(isLoading);
    if (!isLoading) setTimedOut(false);
  }
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const showTimeoutError = timedOut && isLoading;
  const handleRetry = useCallback(() => {
    setTimedOut(false);
    void refetch();
  }, [refetch]);

  // Client-side title search (the API supports status/type/sort; search is a
  // progressive enhancement layered on top of the returned set).
  const visibleProposals = useMemo<Proposal[]>(() => {
    const all = data?.proposals ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [data?.proposals, search]);

  const hasActiveFilters =
    statusFilter !== "all" || typeFilter !== "all" || sort !== "createdAt:desc";

  // Rebuild the shareable URL from the *current* filter state instead of
  // reading `useSearchParams()` (which would force this component back inside a
  // Suspense boundary and re-introduce the cold-load bug).
  const syncUrl = useCallback(
    (
      next: {
        status?: "all" | ProposalStatus;
        type?: "all" | ProposalType;
        sort?: SortValue;
      } = {},
    ) => {
      const s = next.status ?? statusFilter;
      const t = next.type ?? typeFilter;
      const so = next.sort ?? sort;
      const params = new URLSearchParams();
      if (s !== "all") params.set("status", s);
      if (t !== "all") params.set("type", t);
      if (so !== "createdAt:desc") params.set("sort", so);
      const qs = params.toString();
      router.replace(qs ? `/proposals?${qs}` : "/proposals", {
        scroll: false,
      });
    },
    [router, statusFilter, typeFilter, sort],
  );

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSort("createdAt:desc");
    setSearch("");
    setPageSize(PAGE_SIZE);
    router.replace("/proposals");
  }, [router]);

  // Sync status/type to the URL for shareable filter views.
  const onStatusChange = useCallback(
    (v: "all" | ProposalStatus) => {
      setStatusFilter(v);
      setPageSize(PAGE_SIZE);
      syncUrl({ status: v });
    },
    [syncUrl],
  );

  const onTypeChange = useCallback(
    (v: "all" | ProposalType) => {
      setTypeFilter(v);
      setPageSize(PAGE_SIZE);
      syncUrl({ type: v });
    },
    [syncUrl],
  );

  const onSortChange = useCallback(
    (v: SortValue) => {
      setSort(v);
      setPageSize(PAGE_SIZE);
      syncUrl({ sort: v });
    },
    [syncUrl],
  );

  const totalProposals = visibleProposals.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* ── Page header ────────────────────────────────────── */}
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <ClipboardList className="h-6 w-6 text-gold" aria-hidden />
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Proposals
              </h1>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Browse proposals, cast your vote, and make your voice heard.
            </p>
          </div>
          {isAuthenticated && (
            <Button asChild>
              <Link href="/proposals/create">
                <PlusCircle className="h-4 w-4" aria-hidden /> Create Proposal
              </Link>
            </Button>
          )}
        </header>

        {/* ── Unlock banner — phase-aware countdown ── */}
        {!proposalsUnlocked && election && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mx-auto mt-6 max-w-xl"
            data-testid="proposals-unlock-banner"
          >
            {election.phase === "UPCOMING" && election.startsAt && (
              <CountdownTimer
                target={election.startsAt}
                label="Voting opens in · unlock after election"
                ariaLabel="Countdown to voting opening"
              />
            )}
            {election.phase === "OPEN" && election.endsAt && (
              <CountdownTimer
                target={election.endsAt}
                label="Voting closes in · unlock after election"
                ariaLabel="Countdown to voting closing"
              />
            )}
          </motion.div>
        )}

        {/* ── Filter bar ─────────────────────────────────────── */}
        <Card className="mt-6 p-4">
          {/* Status tabs */}
          <div
            role="tablist"
            aria-label="Filter proposals by status"
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3 justify-center"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => onStatusChange(tab.value)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-9 sm:py-1.5",
                    active
                      ? "border-gold/60 bg-gold/15 text-gold"
                      : "border-border bg-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Type / Sort / Search row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr]">
            <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as "all" | ProposalType)}>
              <SelectTrigger aria-label="Filter by type">
                <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => onSortChange(v as SortValue)}>
              <SelectTrigger aria-label="Sort proposals">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search proposals…"
                aria-label="Search proposals by title or description"
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7 sm:w-7"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {(hasActiveFilters || search) && (
            <div className="mt-3 flex items-center justify-between text-xs text-text-dim">
              <span>
                Showing {totalProposals} proposal{totalProposals === 1 ? "" : "s"}
                {search && ` matching “${search}”`}
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-11 items-center gap-1 px-1 text-muted-foreground transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
              >
                <RotateCcw className="h-3 w-3" aria-hidden /> Clear filters
              </button>
            </div>
          )}
        </Card>

        {/* ── Content ────────────────────────────────────────── */}
        <div className="mt-6">
          {showTimeoutError ? (
            <EmptyState
              icon={<Timer className="h-12 w-12" />}
              title="This is taking longer than expected"
              description="The proposals list hasn't loaded in time. This usually means the data source is slow or unavailable. Please try again."
              action={
                <Button onClick={handleRetry} variant="outline" size="sm">
                  Retry
                </Button>
              }
            />
          ) : isLoading ? (
            <LoadingSkeleton variant="card" count={6} />
          ) : isError ? (
            <EmptyState
              icon={<AlertTriangle className="h-12 w-12" />}
              title="Failed to load proposals"
              description="Something went wrong fetching proposals. Please try again."
              action={
                <Button onClick={() => refetch()} variant="outline" size="sm">
                  Refresh
                </Button>
              }
            />
          ) : totalProposals === 0 ? (
            <EmptyState
              icon={
                hasActiveFilters || search ? (
                  <Search className="h-12 w-12" />
                ) : (
                  <ClipboardList className="h-12 w-12" />
                )
              }
              title={
                hasActiveFilters || search
                  ? "No proposals match your filters"
                  : "No proposals yet"
              }
              description={
                hasActiveFilters || search
                  ? "Try adjusting or clearing your filters to see more proposals."
                  : "Be the first to create a governance proposal for the community."
              }
              action={
                hasActiveFilters || search ? (
                  <Button onClick={clearFilters} size="sm" variant="outline">
                    Clear filters
                  </Button>
                ) : isAuthenticated ? (
                  <Button asChild size="sm">
                    <Link href="/proposals/create">
                      <PlusCircle className="h-4 w-4" aria-hidden /> Create Proposal
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 text-center md:text-left md:grid-cols-2 lg:grid-cols-3">
                {visibleProposals.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.04, 0.3) }}
                  >
                    <ProposalCard proposal={p} className="h-full" />
                  </motion.div>
                ))}
              </div>

              {/* Load More — the API returns a page; we expand pageSize until
                  the returned set is smaller than requested. */}
              {visibleProposals.length >= pageSize && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setPageSize((s) => s + PAGE_SIZE)}
                    disabled={isFetching}
                  >
                    {isFetching ? "Loading…" : "Load More"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
