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

const BG_MAP: Record<HolderClass, string> = {
  [HolderClass.WHALE]: "bg-amber-500/15 border-amber-600/40",
  [HolderClass.DOLPHIN]: "bg-sky-500/15 border-sky-600/40",
  [HolderClass.FISH]: "bg-slate-500/15 border-slate-600/40",
};

/**
 * Holder class badge — a core piece of OMNOM brand identity.
 * Color-coded: 🐋 Whale (amber), 🐬 Dolphin (sky), 🐟 Fish (slate).
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
        BG_MAP[holderClass],
        cfg.colorClass,
        sz.badge,
        className,
      )}
      title={`${cfg.label} holder · ${cfg.threshold}% of supply`}
    >
      <span aria-hidden className={sz.emoji}>
        {cfg.emoji}
      </span>
      <span className={sz.label}>{cfg.label}</span>
    </span>
  );
}
