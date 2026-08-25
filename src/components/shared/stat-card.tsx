import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Short label above the value. */
  label: string;
  /** The primary value (already formatted). */
  value: ReactNode;
  /** Optional supporting text under the value. */
  subtitle?: ReactNode;
  /** Optional leading icon/emoji. */
  icon?: ReactNode;
  /** Accent color applied to the icon + value. */
  accent?: "gold" | "gold2" | "green" | "danger" | "default";
  className?: string;
}

const ACCENT_MAP: Record<NonNullable<StatCardProps["accent"]>, string> = {
  gold: "text-gold",
  gold2: "text-gold-hover",
  green: "text-success",
  danger: "text-danger",
  default: "text-foreground",
};

/**
 * Stat card — label, large value, optional icon and subtitle.
 * Used in the dashboard stats row and the landing stats bar.
 */
export function StatCard({
  label,
  value,
  subtitle,
  icon,
  accent = "default",
  className,
}: StatCardProps) {
  const accentClass = ACCENT_MAP[accent];
  return (
    <Card className={cn("overflow-hidden transition-colors hover:border-gold/30", className)}>
      <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
        <div className="flex items-center gap-2">
          {icon ? (
            <span aria-hidden className={cn("text-lg", accentClass)}>
              {icon}
            </span>
          ) : null}
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <span className={cn("font-mono text-2xl font-bold leading-tight", accentClass)}>
          {value}
        </span>
        {subtitle ? (
          <span className="text-xs text-text-dim">{subtitle}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
