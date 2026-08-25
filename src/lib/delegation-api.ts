"use client";

/**
 * React Query hooks for the Delegation + Notification APIs (Phase 3).
 *
 * Kept in a `.ts` module so the backend layer can own them; the existing
 * `api.tsx` is a frontend-owned file. Both modules share the same
 * `fetchApi`/`apiGet` primitives and `ApiResponse` envelope.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiGet, fetchApi, ApiRequestError, queryKeys as baseKeys } from "@/lib/api";
import type { CreateDelegationResult } from "@/lib/delegation";
import type {
  Delegation,
  DelegationInfo,
  DelegationLeaderboardEntry,
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types";

// ─────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────

export const delegationQueryKeys = {
  info: (address: string) => ["delegation", address.toLowerCase()] as const,
  leaderboard: ["delegation-leaderboard"] as const,
};

export const notificationQueryKeys = {
  list: (filters?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
    ["notifications", filters ?? {}] as const,
  unreadCount: ["notifications", "unread-count"] as const,
};

// ─────────────────────────────────────────────────────────────
// Delegation — queries
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/delegation/[address] — delegation state for an address.
 * Public, so it can be polled for any address.
 */
export function useDelegation(address: string, enabled = true) {
  return useQuery<DelegationInfo, ApiRequestError>({
    queryKey: delegationQueryKeys.info(address),
    queryFn: ({ signal }) =>
      apiGet<DelegationInfo>(`/api/v1/delegation/${address}`, undefined, signal),
    enabled: enabled && address.length > 0,
    // Fail fast: never retry so the UI surfaces an error state promptly.
    retry: false,
  });
}

/** GET /api/v1/delegations/leaderboard — top delegates by delegated power. */
export function useDelegationLeaderboard() {
  return useQuery<{ leaderboard: DelegationLeaderboardEntry[] }, ApiRequestError>({
    queryKey: delegationQueryKeys.leaderboard,
    queryFn: ({ signal }) =>
      apiGet<{ leaderboard: DelegationLeaderboardEntry[] }>(
        "/api/v1/delegations/leaderboard",
        undefined,
        signal,
      ),
    // Fail fast: never retry so the UI surfaces an error state promptly.
    retry: false,
  });
}

// ─────────────────────────────────────────────────────────────
// Delegation — mutations
// ─────────────────────────────────────────────────────────────

/** POST /api/v1/delegation — create a delegation (24h time-lock). */
export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation<
    CreateDelegationResult,
    ApiRequestError,
    { delegateeAddress: string }
  >({
    mutationFn: (input) =>
      fetchApi<CreateDelegationResult>("/api/v1/delegation", {
        method: "POST",
        body: input,
      }),
    onSuccess: (data, variables) => {
      toast.success("Delegation created", {
        description:
          "It takes effect in 24 hours. You can override it by voting directly.",
      });
      qc.invalidateQueries({ queryKey: delegationQueryKeys.info(variables.delegateeAddress) });
      qc.invalidateQueries({ queryKey: delegationQueryKeys.leaderboard });
    },
    onError: (error) => {
      toast.error("Could not create delegation", { description: error.message });
    },
  });
}

/** DELETE /api/v1/delegation — revoke the caller's delegation instantly. */
export function useRevokeDelegation() {
  const qc = useQueryClient();
  return useMutation<{ delegation: Delegation }, ApiRequestError, void>({
    mutationFn: () => fetchApi<{ delegation: Delegation }>("/api/v1/delegation", { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Delegation revoked");
      qc.invalidateQueries({ queryKey: ["delegation"] });
      qc.invalidateQueries({ queryKey: delegationQueryKeys.leaderboard });
    },
    onError: (error) => {
      toast.error("Could not revoke delegation", { description: error.message });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Notifications — queries
// ─────────────────────────────────────────────────────────────

export interface NotificationListData extends NotificationListResponse {
  notifications: Notification[];
}

/** GET /api/v1/notifications — paginated list for the authed user. */
export function useNotifications(
  filters: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  enabled = true,
) {
  const query: Record<string, string | undefined> = {
    unreadOnly: filters.unreadOnly ? "true" : "false",
    page: filters.page ? String(filters.page) : "1",
    limit: filters.limit ? String(filters.limit) : "20",
  };
  return useQuery<NotificationListData, ApiRequestError>({
    queryKey: notificationQueryKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<NotificationListData>("/api/v1/notifications", query, signal),
    enabled,
    // Fail fast: never retry so the UI surfaces an error state promptly.
    retry: false,
  });
}

/** GET /api/v1/notifications/unread-count — badge count (poll-friendly). */
export function useUnreadNotificationCount(enabled = true) {
  return useQuery<UnreadCountResponse, ApiRequestError>({
    queryKey: notificationQueryKeys.unreadCount,
    queryFn: ({ signal }) =>
      apiGet<UnreadCountResponse>("/api/v1/notifications/unread-count", undefined, signal),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    // Fail fast: never retry so the UI surfaces an error state promptly.
    retry: false,
  });
}

// ─────────────────────────────────────────────────────────────
// Notifications — mutations
// ─────────────────────────────────────────────────────────────

/** PATCH /api/v1/notifications/[id]/read — mark one as read. */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<{ read: true }, ApiRequestError, string>({
    mutationFn: (id) =>
      fetchApi<{ read: true }>(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** POST /api/v1/notifications/read-all — mark all as read. */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation<{ updated: number }, ApiRequestError, void>({
    mutationFn: () =>
      fetchApi<{ updated: number }>("/api/v1/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      toast.error("Could not mark all as read", { description: error.message });
    },
  });
}

// Re-export base keys for convenience so consumers import from one place.
export { baseKeys as queryKeys };
