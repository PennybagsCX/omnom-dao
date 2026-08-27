import { HOLDER_CLASS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { HolderClass } from "@/types";

interface HolderBadgeProps {
  /** The holder class to render. */
  holderClass: HolderClass;
  /** Visual size variant. */
  size?: "sm" | "md" | "lg";
  /** Show only the emoji + label, no background pill. */
  plain?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { badge: "px-2 py-0.5 text-xs", emoji: "text-sm", label: "text-xs" },
  md: { badge: "px-2.5 py-1 text-sm", emoji: "text-base", label: "text-sm" },
  lg: { badge: "px-3 py-1.5 text-base", emoji: "text-xl", label: "text-base" },
} as const;

/**
 * Holder class badge — a core piece of OMNOM brand identity.
 * Seven tiers: 🦑 Kraken (fuchsia), 🐋 Whale (amber), 🐬 Dolphin (sky),
 * 🦈 Shark (indigo), 🐙 Octopus (violet), 🦀 Crab (orange), 🦄 Seahorse (slate).
 */
export function HolderBadge({
  holderClass,
  size = "md",
  plain = false,
  className,
}: HolderBadgeProps) {
  const cfg = HOLDER_CLASS_CONFIG[holderClass];
  const sz = SIZE_MAP[size];

  if (plain) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-medium", cfg.colorClass, className)}>
        <span aria-hidden className={sz.emoji}>
          {cfg.emoji}
        </span>
        <span className={sz.label}>{cfg.label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        cfg.bgClass,
        cfg.borderClass,
        cfg.colorClass,
        sz.badge,
        className,
      )}
      title={`${cfg.label} holder · ${cfg.thresholdLabel}`}
    >
      <span aria-hidden className={sz.emoji}>
        {cfg.emoji}
      </span>
      <span className={sz.label}>{cfg.label}</span>
    </span>
  );
}
