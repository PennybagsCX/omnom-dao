"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CopyAddress } from "@/components/shared/copy-address";
import { HolderBadge } from "@/components/shared/holder-badge";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { cn, formatDateTime } from "@/lib/utils";
import { DelegationStatus, type Delegation, HolderClass } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

interface DelegationCardProps {
  /** The delegation relationship to render. */
  delegation: Delegation;
  /** Voting power being delegated (informational display). Optional. */
  votingPower?: number | string;
  /** Holder class of the delegator, if known (shows a badge). */
  delegatorClass?: HolderClass;
  /** Holder class of the delegatee, if known (shows a badge). */
  delegateeClass?: HolderClass;
  /** Address to highlight as "you" (renders a "You" tag next to it). */
  currentAddress?: string;
  /** Optional revoke control rendered in the card footer. */
  onRevoke?: () => void;
  /** Whether the revoke action is in progress. */
  revoking?: boolean;
  /** Compact layout (used inside dense lists / leaderboards). */
  compact?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  DelegationStatus,
  { label: string; icon: typeof ShieldCheck; className: string; dot: string }
> = {
  [DelegationStatus.ACTIVE]: {
    label: "Active",
    icon: ShieldCheck,
    className:
      "border-emerald-600/40 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  [DelegationStatus.PENDING]: {
    label: "Pending",
    icon: Clock,
    className: "border-amber-600/40 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  [DelegationStatus.REVOKED]: {
    label: "Revoked",
    icon: XCircle,
    className: "border-slate-600/40 bg-slate-500/10 text-slate-300",
    dot: "bg-slate-400",
  },
};

/**
 * Delegation relationship card.
 *
 * Renders delegator → delegatee with holder badges, status indicator, and
 * optional voting power + revoke control. Reusable in the settings page
 * (outgoing delegation) and the delegation leaderboard (incoming list).
 */
export function DelegationCard({
  delegation,
  votingPower,
  delegatorClass,
  delegateeClass,
  currentAddress,
  onRevoke,
  revoking = false,
  compact = false,
  className,
}: DelegationCardProps) {
  const status = STATUS_CONFIG[delegation.status];
  const StatusIcon = status.icon;

  const delegatorIsYou =
    currentAddress &&
    delegation.delegatorAddress.toLowerCase() === currentAddress.toLowerCase();
  const delegateeIsYou =
    currentAddress &&
    delegation.delegateeAddress.toLowerCase() === currentAddress.toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={cn(
        "rounded-lg border border-border bg-card/80 backdrop-blur-sm",
        compact ? "p-3" : "p-4 sm:p-5",
        className,
      )}
    >
      {/* Status row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            status.className,
          )}
        >
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>

        {votingPower !== undefined && (
          <span className="font-mono text-xs text-text-dim">
            {typeof votingPower === "number"
              ? votingPower.toLocaleString(undefined, { maximumFractionDigits: 3 })
              : votingPower}{" "}
            vp delegated
          </span>
        )}
      </div>

      {/* Address flow: delegator → delegatee */}
      <div className="flex items-center gap-3">
        <AddressBlock
          label="Delegator"
          address={delegation.delegatorAddress}
          holderClass={delegatorClass}
          isYou={!!delegatorIsYou}
          compact={compact}
        />

        <ArrowRight
          className="h-4 w-4 shrink-0 text-text-dim"
          aria-label="delegates to"
        />

        <AddressBlock
          label="Delegate"
          address={delegation.delegateeAddress}
          holderClass={delegateeClass}
          isYou={!!delegateeIsYou}
          compact={compact}
        />
      </div>

      {/* Footer meta: timing / countdown / revoke */}
      {(delegation.status === DelegationStatus.PENDING ||
        onRevoke) && (
        <div
          className={cn(
            "mt-4 flex flex-col gap-3 border-t border-border pt-3",
            "sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          {delegation.status === DelegationStatus.PENDING && (
            <div className="flex items-center gap-2 text-xs">
              <StatusIcon className="h-3.5 w-3.5 text-amber-400" aria-hidden />
              <span className="text-muted-foreground">Effective in</span>
              <CountdownTimer endsAt={delegation.effectiveAt} compact />
            </div>
          )}

          {delegation.status !== DelegationStatus.PENDING && (
            <span className="text-xs text-text-dim">
              {delegation.status === DelegationStatus.REVOKED && delegation.revokedAt
                ? `Revoked ${formatDateTime(delegation.revokedAt)}`
                : `Created ${formatDateTime(delegation.createdAt)}`}
            </span>
          )}

          {onRevoke && delegation.status !== DelegationStatus.REVOKED && (
            <button
              type="button"
              onClick={onRevoke}
              disabled={revoking}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-rose-600/30 px-2.5 py-1 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:self-auto"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              {revoking ? "Revoking…" : "Revoke"
              }
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ── Address block ─────────────────────────────────────────────── */

function AddressBlock({
  label,
  address,
  holderClass,
  isYou,
  compact,
}: {
  label: string;
  address: string;
  holderClass?: HolderClass;
  isYou?: boolean;
  compact: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated/40 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-text-dim">
          {label}
        </span>
        {isYou && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            You
          </Badge>
        )}
      </div>
      <CopyAddress address={address} />
      {holderClass && !compact && (
        <div className="mt-1.5">
          <HolderBadge holderClass={holderClass} size="sm" plain />
        </div>
      )}
    </div>
  );
}
