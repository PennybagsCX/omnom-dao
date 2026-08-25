"use client";

import type { ComponentType, SVGProps } from "react";
import * as LucideIcons from "lucide-react";

type LucideIcon = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    // lucide icons forward arbitrary className/strokeWidth props
    strokeWidth?: number | string;
  }
>;

/**
 * Resolve a lucide-react icon by its PascalCase name (e.g. "Vote", "CheckCircle2").
 * Returns `null` when the name is unknown so configs can reference icons that
 * may not exist without crashing the render tree.
 *
 * Centralizes emoji → SVG icon rendering for config-driven metadata
 * (proposal types, statuses, vote choices, notifications, nav items).
 */
export function DynamicIcon({
  name,
  className,
  size,
  strokeWidth,
  "aria-hidden": ariaHidden,
}: {
  name: string;
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
    />
  );
}
