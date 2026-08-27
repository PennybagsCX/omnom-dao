// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hook tests mock only the transport (`@/lib/api`) and the toast channel
 * (`sonner`); the React Query orchestration (keys, caching, invalidation)
 * runs for real against a fresh QueryClient per test.
 */
const apiGetMock = vi.hoisted(() => vi.fn());
const fetchApiMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => {
  class ApiRequestError extends Error {}
  return {
    apiGet: apiGetMock,
    fetchApi: fetchApiMock,
    ApiRequestError,
    queryKeys: { proposals: ["proposals"] },
  };
});
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import { queryKeys as baseKeys } from "@/lib/api";
import {
  delegationQueryKeys,
  notificationQueryKeys,
  queryKeys,
  useCreateDelegation,
  useDelegation,
  useDelegationLeaderboard,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useRevokeDelegation,
  useUnreadNotificationCount,
} from "@/lib/delegation-api";

// React 18+ requires this flag for act() to run without warnings outside
// React's own test renderer setup.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidateSpy };
}

beforeEach(() => {
  apiGetMock.mockReset();
  fetchApiMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe("query keys", () => {
  it("lowercases the delegation info key", () => {
    expect(delegationQueryKeys.info("0xABCdef")).toEqual(["delegation", "0xabcdef"]);
  });

  it("builds stable leaderboard and notification keys", () => {
    expect(delegationQueryKeys.leaderboard).toEqual(["delegation-leaderboard"]);
    expect(notificationQueryKeys.list({ unreadOnly: true, page: 2, limit: 5 })).toEqual([
      "notifications",
      { unreadOnly: true, page: 2, limit: 5 },
    ]);
    expect(notificationQueryKeys.list()).toEqual(["notifications", {}]);
    expect(notificationQueryKeys.unreadCount).toEqual(["notifications", "unread-count"]);
  });

  it("re-exports the base api query keys untouched", () => {
    expect(queryKeys).toBe(baseKeys);
  });
});

describe("useDelegation", () => {
  it("fetches delegation state for the address as given", async () => {
    apiGetMock.mockResolvedValue({ outgoing: null, incomingCount: 0, incomingList: [] });
    const { result } = renderHook(() => useDelegation("0xAbC"), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/delegation/0xAbC", undefined, expect.anything());
    expect(result.current.data).toMatchObject({ incomingCount: 0 });
  });

  it("stays idle when the address is empty", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useDelegation(""), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useDelegationLeaderboard", () => {
  it("fetches the leaderboard endpoint", async () => {
    apiGetMock.mockResolvedValue({ leaderboard: [{ delegateeAddress: "0xd1", incomingCount: 2, totalDelegatedPower: 100 }] });
    const { result } = renderHook(() => useDelegationLeaderboard(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/delegations/leaderboard", undefined, expect.anything());
    expect(result.current.data!.leaderboard).toHaveLength(1);
  });
});

describe("useCreateDelegation", () => {
  it("POSTs, toasts, and invalidates the delegator's caches on success", async () => {
    fetchApiMock.mockResolvedValue({ delegation: { id: "d1" }, replaced: false });
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useCreateDelegation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ delegateeAddress: "0xDeF" });
    });

    expect(fetchApiMock).toHaveBeenCalledWith("/api/v1/delegation", {
      method: "POST",
      body: { delegateeAddress: "0xDeF" },
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Delegation created",
      { description: expect.stringContaining("24 hours") },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["delegation", "0xdef"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["delegation-leaderboard"] });
  });

  it("toasts the error message when the request fails", async () => {
    fetchApiMock.mockRejectedValue(new Error("time-lock conflict"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateDelegation(), { wrapper });

    await act(async () => {
      result.current.mutate({ delegateeAddress: "0x1" });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Could not create delegation", {
      description: "time-lock conflict",
    });
  });
});

describe("useRevokeDelegation", () => {
  it("DELETEs, toasts, and invalidates on success", async () => {
    fetchApiMock.mockResolvedValue({ delegation: { id: "d1" } });
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useRevokeDelegation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetchApiMock).toHaveBeenCalledWith("/api/v1/delegation", { method: "DELETE" });
    expect(toastSuccessMock).toHaveBeenCalledWith("Delegation revoked");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["delegation"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["delegation-leaderboard"] });
  });
});

describe("useNotifications", () => {
  it("uses default pagination filters", async () => {
    apiGetMock.mockResolvedValue({ notifications: [], total: 0, page: 1, limit: 20 });
    const { result } = renderHook(() => useNotifications(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/notifications",
      { unreadOnly: "false", page: "1", limit: "20" },
      expect.anything(),
    );
  });

  it("serializes explicit filters into the query string", async () => {
    apiGetMock.mockResolvedValue({ notifications: [], total: 0, page: 2, limit: 5 });
    const { result } = renderHook(
      () => useNotifications({ unreadOnly: true, page: 2, limit: 5 }),
      { wrapper: setup().wrapper },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/notifications",
      { unreadOnly: "true", page: "2", limit: "5" },
      expect.anything(),
    );
  });

  it("does not fetch when disabled", async () => {
    const { wrapper } = setup();
    renderHook(() => useNotifications({}, false), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});

describe("useUnreadNotificationCount", () => {
  it("polls the unread-count endpoint", async () => {
    apiGetMock.mockResolvedValue({ count: 3 });
    const { result } = renderHook(() => useUnreadNotificationCount(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ count: 3 }));
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/notifications/unread-count",
      undefined,
      expect.anything(),
    );
  });

  it("does not fetch or poll when disabled", async () => {
    const { wrapper } = setup();
    renderHook(() => useUnreadNotificationCount(false), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});

describe("useMarkNotificationRead", () => {
  it("PATCHes the single notification and invalidates the list", async () => {
    fetchApiMock.mockResolvedValue({ read: true });
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("n1");
    });

    expect(fetchApiMock).toHaveBeenCalledWith("/api/v1/notifications/n1/read", { method: "PATCH" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });
});

describe("useMarkAllNotificationsRead", () => {
  it("POSTs read-all, toasts, and invalidates", async () => {
    fetchApiMock.mockResolvedValue({ updated: 7 });
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(fetchApiMock).toHaveBeenCalledWith("/api/v1/notifications/read-all", { method: "POST" });
    expect(toastSuccessMock).toHaveBeenCalledWith("All notifications marked as read");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("toasts the error message when read-all fails", async () => {
    fetchApiMock.mockRejectedValue(new Error("db down"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });

    await act(async () => {
      result.current.mutate();
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Could not mark all as read", {
      description: "db down",
    });
  });
});
