"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/api";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/delegation-api";
import type { Notification } from "@/types";
import { timeAgo } from "@/lib/utils";

/**
 * Notification center dropdown for navbar.
 * Part of Phase 3: Built-in Notification System enhancement.
 * Uses existing notification infrastructure from delegation-api.ts.
 */
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: me } = useCurrentUser({ retry: false });
  const { data: notificationsData, isLoading } = useNotifications({}, Boolean(me));
  const { data: unreadData } = useUnreadNotificationCount(Boolean(me));
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const router = useRouter();
  
  // Get notification data with proper typing
  const notifications = notificationsData?.notifications ?? [];
  const unreadCount = unreadData?.unreadCount ?? 0;

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    if (!me) return;
    
    const interval = setInterval(() => {
      router.refresh(); // Refresh to trigger refetch
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [me, router]);

  const handleNotificationClick = async (notification: Notification) => {
    // Navigate if proposal_id exists
    if (notification.proposalId) {
      router.push(`/proposals/${notification.proposalId}`);
      setIsOpen(false);
    }

    // Mark as read
    if (!notification.read) {
      await markRead.mutateAsync(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllRead.mutateAsync();
  };

  if (!me) return null;

  return (
    <div className="relative">
      {/* Notification bell button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        className={cn(
          "relative inline-flex items-center justify-center rounded-md p-2",
          "transition-colors hover:bg-bg-elevated",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "min-h-[44px] min-w-[44px]", // Touch target size
        )}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-gold" aria-hidden />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right rounded-lg border border-border bg-bg-surface shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-gold">
                      ({unreadCount} unread)
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={markAllRead.isPending}
                    className="text-xs text-text-dim transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {markAllRead.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      'Mark all read'
                    )}
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-text-dim" aria-hidden />
                  </div>
                ) : notifications && notifications.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="py-8 text-center">
                    <Bell className="mx-auto h-12 w-12 text-text-dim" aria-hidden />
                    <p className="mt-2 text-sm text-text-dim">No notifications yet</p>
                    <p className="mt-1 text-xs text-text-dim">
                      You&apos;ll see updates about proposals and votes here
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/settings?tab=notifications');
                  }}
                  className="w-full text-left text-xs text-text-dim transition-colors hover:text-foreground"
                >
                  Notification Settings →
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'PROPOSAL_CREATED':
        return '📝';
      case 'VOTING_STARTED':
        return '🗳️';
      case 'VOTING_ENDING_SOON':
        return '⏰';
      case 'PROPOSAL_RESULT':
        return '📊';
      case 'MENTION':
        return '@';
      default:
        return '🔔';
    }
  };

  const getColor = () => {
    if (notification.read) return 'border-border bg-bg-surface';
    return 'border-gold/30 bg-gold/5';
  };

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left transition-colors hover:bg-bg-elevated",
          "px-4 py-3 border-l-2",
          getColor(),
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-lg">
            {getIcon()}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground line-clamp-1">
                {notification.title}
              </p>
              {!notification.read && (
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-gold" />
              )}
            </div>
            <p className="mt-1 text-xs text-text-dim line-clamp-2">
              {notification.body}
            </p>
            <p className="mt-1 text-xs text-text-dim">
              {timeAgo(notification.createdAt)}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}
