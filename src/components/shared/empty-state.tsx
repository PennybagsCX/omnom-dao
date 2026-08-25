import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Large illustration / emoji / icon. */
  icon?: ReactNode;
  /** Headline. */
  title: string;
  /** Supporting description. */
  description?: ReactNode;
  /** Optional call-to-action node (typically a button or link). */
  action?: ReactNode;
  className?: string;
}

/**
 * Illustrated empty state with icon, title, description, and optional CTA.
 * Use for "no proposals", "no votes yet", "nothing matches your filters".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden className="mb-1 text-5xl opacity-80">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
