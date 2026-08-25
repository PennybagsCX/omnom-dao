import { cn } from "@/lib/utils";

/**
 * Skeleton shimmer loader variants.
 * Uses the `.skeleton-shimmer` gradient sweep keyframe defined in globals.css.
 */
type SkeletonVariant = "card" | "list" | "detail" | "dashboard" | "stat-row";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  /** Number of repeated items for list/card variants. */
  count?: number;
  className?: string;
}

/** A single shimmer block. */
function Block({ className }: { className?: string }) {
  return <div className={cn("rounded bg-bg-elevated skeleton-shimmer", className)} aria-hidden />;
}

function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-5">
          <Block className="h-3 w-20" />
          <Block className="mt-3 h-7 w-28" />
          <Block className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <Block className="h-5 w-24" />
      <Block className="h-6 w-3/4" />
      <Block className="h-4 w-full" />
      <Block className="h-4 w-2/3" />
      <Block className="mt-4 h-2 w-full" />
      <div className="flex justify-between pt-1">
        <Block className="h-3 w-24" />
        <Block className="h-3 w-20" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Block className="h-5 w-28" />
      <Block className="h-9 w-2/3" />
      <div className="flex gap-3">
        <Block className="h-4 w-32" />
        <Block className="h-4 w-24" />
      </div>
      <div className="space-y-2 pt-4">
        <Block className="h-4 w-full" />
        <Block className="h-4 w-full" />
        <Block className="h-4 w-5/6" />
        <Block className="h-4 w-3/4" />
      </div>
      <Block className="mt-6 h-2 w-full" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* profile */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-6">
        <Block className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Block className="h-5 w-32" />
          <Block className="h-4 w-44" />
          <Block className="h-4 w-24" />
        </div>
      </div>
      <StatRowSkeleton />
      <div className="space-y-3">
        <Block className="h-5 w-40" />
        <CardSkeleton />
      </div>
    </div>
  );
}

/**
 * Variant-driven loading skeleton. Renders the appropriate layout for the
 * context it appears in so layout shift is minimized.
 */
export function LoadingSkeleton({
  variant = "card",
  count = 3,
  className,
}: LoadingSkeletonProps) {
  if (variant === "stat-row") {
    return <StatRowSkeleton />;
  }
  if (variant === "detail") {
    return <div className={className} role="status" aria-label="Loading"><DetailSkeleton /></div>;
  }
  if (variant === "dashboard") {
    return (
      <div className={className} role="status" aria-label="Loading dashboard">
        <DashboardSkeleton />
      </div>
    );
  }
  // list / card
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Single inline shimmer block for ad-hoc use. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <Block className={className} />;
}
