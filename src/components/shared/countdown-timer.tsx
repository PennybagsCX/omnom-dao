"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { getTimeRemaining } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  /** ISO 8601 end timestamp. */
  endsAt: string;
  /** Compact mode hides the segmented d/h/m/s boxes and shows a label string. */
  compact?: boolean;
  className?: string;
}

/**
 * Live countdown to a voting end timestamp — updates every second.
 * Renders segmented days/hours/minutes/seconds boxes, or a compact label.
 * Color turns red when less than 24 hours remain.
 */
export function CountdownTimer({ endsAt, compact = false, className }: CountdownTimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = getTimeRemaining(endsAt);

  if (remaining.ended) {
    return (
      <span className={cn("text-sm font-medium text-text-dim", className)}>Ended</span>
    );
  }

  const urgent = remaining.days === 0;
  const color = urgent ? "text-danger" : "text-muted-foreground";

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-mono text-sm", color, className)}>
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {remaining.label}
      </span>
    );
  }

  const segments = [
    { value: remaining.days, label: "d" },
    { value: remaining.hours, label: "h" },
    { value: remaining.minutes, label: "m" },
    { value: remaining.seconds, label: "s" },
  ];

  return (
    <div className={cn("inline-flex items-center gap-2", className)} role="timer" aria-live="off">
      <Clock className="h-4 w-4" aria-hidden />
      <div className={cn("inline-flex items-center font-mono text-sm font-semibold", urgent ? "text-danger" : "text-foreground")}>
        {segments.map((seg, i) => (
          <span key={seg.label} className="inline-flex items-center">
            <span className="tabular-nums">{String(seg.value).padStart(2, "0")}</span>
            <span className={cn("mx-0.5", color)}>{seg.label}</span>
            {i < segments.length - 1 && <span className={cn("mr-1", color)}>:</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
