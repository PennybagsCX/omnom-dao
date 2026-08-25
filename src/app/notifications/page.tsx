"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { useCurrentUser } from "@/lib/api";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/delegation-api";
import { cn, timeAgo } from "@/lib/utils";
import { NotificationType, type Notification } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const PAGE_SIZE = 10;

/** Emoji + label per notification category. */
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

type Tab = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const { data: me, isLoading: meLoading, error: meError } = useCurrentUser();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useNotifications({ page: 1, limit: PAGE_SIZE });

  const { mutate: markAsRead } = useMarkNotificationRead();
  const { mutate: markAllAsRead } = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        markAsRead(notification.id);
      }
      
      // Navigate to related content if applicable
      if (notification.proposalId) {
        router.push(`/proposals/${notification.proposalId}`);
      }
    },
    [markAsRead, router]
  );

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Skeleton while loading user data (C5.1)
  if (meLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <NotificationsSkeleton />
      </div>
    );
  }

  if (meError || !me) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Lock className="h-12 w-12" />}
          title="Authentication required"
          description="Connect and verify your wallet to view your notifications."
          action={<ConnectCta>Connect Wallet</ConnectCta>}
        />
      </div>
    );
  }

  // Error loading notifications (C5.2) — surface a retryable error state instead
  // of rendering an empty inbox that masquerades as "no notifications".
  if (isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          title="Failed to load notifications"
          description="We couldn't reach the notification service. Please try again."
          action={
            <Button onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? "Retrying…" : "Retry"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="space-y-6"
      >
        {/* Header */}
        <header className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Governance activity and mentions for your account.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="shrink-0"
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </header>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              All
              {notifications.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {notifications.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-2">
              <span className="relative flex h-4 w-4">
                <span className="absolute top-0 right-0 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
                </span>
              </span>
              Unread
              {unreadCount > 0 && (
                <span className="ml-auto text-xs text-gold">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications list */}
        <div className="space-y-2">
          {isLoading ? (
            <NotificationsSkeleton count={3} />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-12 w-12 text-muted-foreground" />}
              title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
              description={
                tab === "unread"
                  ? "You're all caught up!"
                  : "When you interact with proposals or get mentioned, you'll see notifications here."
              }
            />
          ) : (
            notifications
              .filter((n) => tab === "all" || !n.read)
              .map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** Individual notification card. */
function NotificationCard({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const meta = NOTIFICATION_META[notification.type];
  const createdAt = timeAgo(notification.createdAt);

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        !notification.read && "border-gold/50 bg-gold/5",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <DynamicIcon
              name={meta.iconName}
              className="h-5 w-5 text-primary"
              aria-hidden
            />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {notification.body}
                </p>
              </div>
              <span className="text-xs text-text-dim shrink-0">{createdAt}</span>
            </div>
          </div>
          {!notification.read && (
            <div className="flex h-2 w-2 shrink-0 rounded-full bg-gold mt-2" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading skeleton for notifications list. */
function NotificationsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="h-24 animate-pulse bg-muted/50" />
      ))}
    </div>
  );
}
