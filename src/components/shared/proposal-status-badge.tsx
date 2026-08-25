import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { PROPOSAL_STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ProposalStatus } from "@/types";

interface ProposalStatusBadgeProps {
  status: ProposalStatus;
  /** Apply the pulse-glow animation (used for ACTIVE proposals). */
  pulse?: boolean;
  className?: string;
}

/**
 * Status badge with color and emoji for each ProposalStatus.
 * Active badges optionally pulse to draw attention.
 */
export function ProposalStatusBadge({
  status,
  pulse = false,
  className,
}: ProposalStatusBadgeProps) {
  const cfg = PROPOSAL_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.badgeClass,
        pulse && status === ProposalStatus.ACTIVE && "animate-pulse-glow",
        className,
      )}
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
