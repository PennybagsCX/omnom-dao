"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import {
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/delegation-api";
import { useCurrentUser } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { NotificationType, type Notification } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** lucide icon name + label for each notification category. */
const NOTIFICATION_META: Record<
  NotificationType,
  { iconName: string; label: string }
> = {
  [NotificationType.PROPOSAL_CREATED]: { iconName: "FilePlus", label: "New proposal" },
  [NotificationType.VOTING_STARTED]: { iconName: "Vote", label: "Voting started" },
  [NotificationType.VOTING_ENDING_SOON]: { iconName: "Timer", label: "Ending soon" },
  [NotificationType.PROPOSAL_RESULT]: { iconName: "BarChart3", label: "Result" },
  [NotificationType.MENTION]: { iconName: "MessageCircle", label: "Mention" },
};

/**
 * Notification bell for the site header.
 *
 * - Renders a bell icon button with an unread-count badge.
 * - Polls the unread count via the lib hook's `refetchInterval` (60s). We do
 *   NOT also run a manual `setInterval` invalidation — that previously caused
 *   double polling (two overlapping refetch cycles) which was pure overhead.
 * - Opens a glassmorphism dropdown showing the 5 most recent notifications with
 *   framer-motion animation, Escape-to-close, click-outside, and a focus trap.
 * - Hides entirely when no authed user is present (the unread-count query is
 *   disabled in that case).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Only fetch notifications when the user is authenticated to avoid
  // unnecessary 401 errors for anonymous visitors.
  const { data: me } = useCurrentUser({ retry: false });
  const isAuthenticated = Boolean(me);

  const { data: countData } = useUnreadNotificationCount(isAuthenticated);
  const unreadCount = countData?.unreadCount ?? 0;

  // 5 most recent notifications (only fetched when the bell is open or has items).
  const { data: recentData } = useNotifications(
    { page: 1, limit: 5 },
    isAuthenticated && (open || unreadCount > 0),
  );
  const notifications = recentData?.notifications ?? [];

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on outside click / Escape, restore focus to trigger on close.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Restore focus to the trigger when the panel closes.
  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
    }
  }, [open]);

  // Move focus into the panel when it opens (basic focus management).
  useEffect(() => {
    if (open && panelRef.current) {
      const firstFocusable =
        panelRef.current.querySelector<HTMLElement>(
          "a, button, [tabindex]:not([tabindex='-1'])",
        );
      firstFocusable?.focus();
    }
  }, [open]);

  const handleNotificationClick = useCallback(
    (n: Notification) => {
      if (!n.read) markRead.mutate(n.id);
    },
    [markRead],
  );

  if (!isAuthenticated) return null;

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className={cn(
              "absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-background ring-2 ring-bg-deep",
              unreadCount > 9 ? "px-1" : "",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-label="Recent notifications"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))]",
              "overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl backdrop-blur-md",
              "max-h-[70vh] focus-visible:outline-none",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-danger/15 px-1.5 py-0.5 text-xs font-medium text-danger">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={markAllRead.isPending}
                  onClick={() => markAllRead.mutate()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  Mark all read
                </Button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                  <Bell className="h-7 w-7 opacity-70" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    No notifications yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You will see governance activity here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onClick={() => handleNotificationClick(n)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-bg-elevated/30 px-4 py-2 text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                View all notifications
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Notification row ──────────────────────────────────────────── */

function NotificationRow({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const router = useRouter();
  const meta = NOTIFICATION_META[notification.type] ?? NOTIFICATION_META[NotificationType.MENTION];
  const href = notification.proposalId
    ? `/proposals/${notification.proposalId}`
    : "/notifications";

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onClick();
          router.push(href);
        }}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
          !notification.read && "bg-gold/[0.04]",
        )}
      >
        <DynamicIcon
          name={meta.iconName}
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="line-clamp-1 text-sm font-medium text-foreground">
              {notification.title}
            </span>
            {!notification.read && (
              <span
                aria-label="Unread"
                className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gold"
              />
            )}
          </span>
          <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {notification.body}
          </span>
          <span className="mt-0.5 block text-[11px] text-text-dim">
            {timeAgo(notification.createdAt)}
          </span>
        </span>
      </button>
    </li>
  );
}
