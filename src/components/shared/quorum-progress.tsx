import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPercentage } from "@/lib/utils";

interface QuorumProgressProps {
  /** Achieved participation as a percentage of total supply (0–100). */
  achieved: number;
  /** Required quorum threshold percentage (0–100). */
  required: number;
  className?: string;
}

/**
 * Progress bar showing current votes vs the quorum threshold.
 * Turns green when achieved ≥ required, amber otherwise.
 */
export function QuorumProgress({ achieved, required, className }: QuorumProgressProps) {
  const met = achieved >= required;
  // Visual width: scale achieved relative to required so the bar "fills" at
  // the threshold marker, capping at 100%.
  const widthPct = Math.min(100, required > 0 ? (achieved / required) * 100 : achieved);

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">
          Quorum
        </span>
        <span className={cn("font-mono", met ? "text-success" : "text-warning")}>
          {formatPercentage(achieved)} / {formatPercentage(required)}
        </span>
      </div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated"
        role="progressbar"
        aria-valuenow={achieved}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-label={`Quorum ${formatPercentage(achieved)} of ${formatPercentage(required)} required`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            met ? "bg-success" : "bg-warning",
          )}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <p className={cn("mt-1 inline-flex items-center justify-center gap-1 text-xs w-full", met ? "text-success" : "text-text-dim")}>
        {met ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Quorum reached
          </>
        ) : (
          "Quorum not yet reached"
        )}
      </p>
    </div>
  );
}
