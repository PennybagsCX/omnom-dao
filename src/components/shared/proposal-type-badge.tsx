import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ProposalType } from "@/types";

interface ProposalTypeBadgeProps {
  type: ProposalType;
  className?: string;
}

/**
 * Badge showing the proposal type with its brand emoji + accent color.
 */
export function ProposalTypeBadge({ type, className }: ProposalTypeBadgeProps) {
  const cfg = PROPOSAL_TYPE_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-xs font-medium",
        cfg.accentClass,
        className,
      )}
      title={cfg.description}
    >
      <DynamicIcon
        name={cfg.iconName}
        aria-hidden
        className="h-3 w-3 shrink-0"
      />
      {cfg.label}
    </span>
  );
}
