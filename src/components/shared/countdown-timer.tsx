"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Sparkles, Timer } from "lucide-react";

import { cn, getTimeRemaining } from "@/lib/utils";

/**
 * Live countdown to a fixed target date.
 *
 * Two modes, depending on the props:
 *
 *   - **Compact / segmented mode** (default — backward-compatible API):
 *     pass `endsAt` (ISO string) and optionally `compact`. Renders the
 *     classic segmented `Nd : Nh : Nm : Ns` line, with `compact` collapsing
 *     to an icon + label like "1d 2h left". Turns red when <24h remain.
 *     Existing call sites in `proposal-card.tsx`, `delegation-card.tsx`,
 *     and `proposals/[id]/page.tsx` use this mode.
 *
 *   - **FGE panel mode** (new — homepage + /governance-vote hero):
 *     pass `target` (Date | ISO string), `label`, optional `closedText`.
 *     Renders the large 4-card days/hours/minutes/seconds panel with
 *     entrance animation and label header. SSR-safe (renders initial
 *     value at request time).
 */
type BaseProps = {
  className?: string;
};

type EndsAtMode = BaseProps & {
  /** ISO 8601 end timestamp (legacy / compact mode). */
  endsAt: string;
  /** When true, render a label + clock icon instead of the segmented line. */
  compact?: boolean;
  /** Disambiguate from `target` mode. */
  target?: never;
  label?: never;
  closedText?: never;
  ariaLabel?: string;
};

type TargetMode = BaseProps & {
  /** The date being counted down to (FGE panel mode). */
  target: Date | string;
  /** Optional label that goes above the stat cards. */
  label?: string;
  /** Optional label for the closed/celebratory state. */
  closedText?: string;
  /** Optional aria-label override (defaults to the visible label). */
  ariaLabel?: string;
  /** Disambiguate from `endsAt` mode. */
  endsAt?: never;
  compact?: never;
};

export type CountdownTimerProps = EndsAtMode | TargetMode;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function diffParts(targetMs: number, nowMs: number): Parts {
  const total = Math.max(0, targetMs - nowMs);
  const days = Math.floor(total / DAY_MS);
  const hours = Math.floor((total % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((total % MINUTE_MS) / MINUTE_MS);
  const seconds = Math.floor((total % MINUTE_MS) / 1000);
  return { days, hours, minutes, seconds, total };
}

function fmt(n: number): string {
  return n.toString().padStart(2, "0");
}

export function CountdownTimer(props: CountdownTimerProps) {
  if ("endsAt" in props && props.endsAt) {
    return <CompactCountdown {...(props as EndsAtMode)} />;
  }
  return <PanelCountdown {...(props as TargetMode)} />;
}

/* ── Compact / segmented mode (legacy) ─────────────────────────── */

function CompactCountdown({ endsAt, compact = false, className, ariaLabel }: EndsAtMode) {
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
      <span
        className={cn("inline-flex items-center gap-1 font-mono text-sm", color, className)}
        aria-label={ariaLabel ?? "Time remaining"}
      >
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
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role="timer"
      aria-live="off"
      aria-label={ariaLabel ?? "Time remaining"}
    >
      <Clock className="h-4 w-4" aria-hidden />
      <div
        className={cn(
          "inline-flex items-center font-mono text-sm font-semibold",
          urgent ? "text-danger" : "text-foreground",
        )}
      >
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

/* ── FGE panel mode (homepage + election page) ─────────────────── */

function PanelCountdown({ target, label, closedText, ariaLabel, className }: TargetMode) {
  const targetMs = new Date(target).getTime();
  // Initial render uses the server's Date.now(); client hydrates with the same
  // value (no mismatch), then a useEffect upgrades it to the live ticker.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    // Skip initial sync to avoid a cascading render. The interval below
    // updates every second; if server time differs from client time the
    // first tick converges immediately. Safe for short-lived mount/unmount.
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = diffParts(targetMs, now);
  const isClosed = parts.total === 0;

  if (isClosed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm font-medium text-gold",
          className,
        )}
        role="status"
        aria-live="polite"
        data-testid="countdown-timer"
        data-state="closed"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {closedText ?? "Voting is now live"}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      data-testid="countdown-timer"
      data-state="active"
      className={cn(
        "rounded-2xl border border-border bg-bg-elevated/30 px-4 py-5 backdrop-blur sm:px-6 sm:py-6",
        className,
      )}
      role="timer"
    >
      {label && (
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-widest text-text-dim">
          <Timer className="h-3.5 w-3.5" aria-hidden />
          <span aria-label={ariaLabel ?? label}>{label}</span>
        </div>
      )}

      <ol
        aria-label={`Time remaining${label ? `: ${label}` : ""}`}
        aria-live="polite"
        className="grid grid-cols-4 gap-2 sm:gap-3"
      >
        <Cell value={parts.days} label="Days" />
        <Cell value={parts.hours} label="Hours" pad />
        <Cell value={parts.minutes} label="Minutes" pad />
        <Cell value={parts.seconds} label="Seconds" pad />
      </ol>
    </motion.div>
  );
}

function Cell({ value, label, pad }: { value: number; label: string; pad?: boolean }) {
  const display = pad ? fmt(value) : value.toString();
  return (
    <li
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-bg-deep/60 px-1.5 py-3 sm:px-3 sm:py-4",
      )}
    >
      <span
        suppressHydrationWarning
        className={cn(
          "font-mono font-bold tabular-nums leading-none text-gold",
          "text-3xl sm:text-4xl md:text-5xl",
        )}
      >
        {display}
      </span>
      <span className="mt-1.5 text-[0.625rem] font-medium uppercase tracking-widest text-text-dim sm:mt-2 sm:text-xs">
        {label}
      </span>
    </li>
  );
}