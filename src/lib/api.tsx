"use client";

/**
 * OMNOM DAO — API client + React Query hooks.
 *
 * All API routes return a uniform `ApiResponse<T>` envelope:
 *   { success: boolean, data?: T, error?: ApiError, meta?: ApiMeta }
 *
 * This module provides:
 *   - `fetchApi<T>` — typed fetcher that unwraps the envelope and throws on error.
 *   - A typed `ApiRequestError` exception carrying the machine error code + HTTP status.
 *   - React Query hooks for the public + authenticated surface (proposals,
 *     votes, comments, current user, dashboard, settings).
 *
 * Toast notifications for mutations are surfaced via `sonner` (already mounted
 * globally by the Providers wrapper).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { toast } from "sonner";

import {
  ErrorCode,
  type ApiError as ApiErrorShape,
  type ApiResponse,
  type CreateProposalRequest,
  type ElectionComment,
  type EmojiKey,
  type EmojiReactionCounts,
  type HolderClass,
  type Proposal,
  type ProposalComment,
  type VoteChoice,
} from "@/types";
import { emptyEmojiCounts } from "@/lib/emoji-reactions";

// ─────────────────────────────────────────────────────────────
// Response payloads (mirror the route handlers)
// ─────────────────────────────────────────────────────────────

export interface MeData {
  address: string;
  displayName: string;
  class: HolderClass;
  balanceRaw: string;
  balanceFormatted: string;
  rank: number;
  votingPower: number;
  createdAt: string;
  settings: {
    notifications: {
      proposalCreated: boolean;
      votingStarted: boolean;
      votingEndingSoon: boolean;
      proposalResult: boolean;
      mention: boolean;
    };
    preferredWallet: string | null;
    displayFormat: "full" | "abbreviated" | "raw";
  };
}

export interface DashboardProfile {
  address: string;
  displayName: string;
  class: HolderClass;
  balanceFormatted: string;
  rank: number;
  votingPower: number;
  createdAt: string;
}

export interface DashboardRecentVote {
  proposalId: string;
  choice: string;
  votingPower: number;
  createdAt: string;
}

export interface ProposalFilters {
  status?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface DashboardData {
  profile: DashboardProfile;
  recentVotes: DashboardRecentVote[];
  authoredProposals: Proposal[];
  notifications: {
    unread: number;
    recent: Array<{
      id: string;
      type: string;
      title: string;
      read: boolean;
      createdAt: string;
    }>;
  };
}

export interface ProposalDetailData {
  proposal: Proposal;
  votes: { totalFor: number; totalAgainst: number; totalAbstain: number };
  voterCount: number;
  comments: ProposalComment[];
  myVote: {
    choice: VoteChoice;
    votingPower: number;
    votedAt: string;
  } | null;
}

export interface CastVoteData {
  vote: {
    id: string;
    proposalId: string;
    voterAddress: string;
    choice: VoteChoice;
    votingPower: number;
    createdAt: string;
    txHash: string | null;
  };
  proposal: { votesFor: number; votesAgainst: number; votesAbstain: number };
}

export interface CreateProposalData {
  proposal: Proposal;
}

export interface UpdateSettingsData {
  updated: boolean;
  address: string;
  displayName: string | null;
  notifications: Record<string, boolean> | null;
  preferredWallet: string | null;
  displayFormat: "full" | "abbreviated" | "raw" | null;
}

// ─────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────

/** Typed API error thrown by `fetchApi` when `success` is false or HTTP >= 400. */
export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown[];

  constructor(error: ApiErrorShape, status: number) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

// ─────────────────────────────────────────────────────────────
// Core fetcher
// ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Query params appended to the URL. */
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: FetchOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs.length > 0 ? `${path}?${qs}` : path;
}

/**
 * Typed fetch wrapper. Unwraps the `ApiResponse<T>` envelope and returns `data`.
 * Throws {@link ApiRequestError} on any non-success response.
 */
export async function fetchApi<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const url = buildUrl(path, query);

  const res = await fetch(url, {
    method,
    signal,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: method === "GET" ? "default" : "no-store",
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      {
        code: ErrorCode.INTERNAL_ERROR,
        message: "Unexpected response from the server.",
      },
      res.status,
    );
  }

  if (!json.success || json.error) {
    throw new ApiRequestError(
      json.error ?? {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unknown error occurred.",
      },
      res.status,
    );
  }

  return json.data as T;
}

/** Convenience GET. */
export function apiGet<T>(path: string, query?: FetchOptions["query"], signal?: AbortSignal) {
  return fetchApi<T>(path, { method: "GET", query, signal });
}

// ─────────────────────────────────────────────────────────────
// Query key factories (stable, co-located)
// ─────────────────────────────────────────────────────────────

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  proposals: (filters?: Record<string, string | undefined>) =>
    ["proposals", filters ?? {}] as const,
  proposal: (id: string) => ["proposal", id] as const,
  proposalDetail: (id: string) => ["proposal-detail", id] as const,
  comments: (proposalId: string, page = 1) =>
    ["comments", proposalId, page] as const,
  electionComments: (electionKey: string, page = 1) =>
    ["election-comments", electionKey, page] as const,
  tags: (query?: string) => ["tags", query ?? ""] as const,
};

// ─────────────────────────────────────────────────────────────
// React Query hooks — queries
// ─────────────────────────────────────────────────────────────

/** GET /api/v1/me — current authenticated user.
 *
 * JWT-based authentication (SIWE or dev auth). The HttpOnly cookie cannot be
 * pre-checked from JS, so we always fetch — anonymous visitors incur one request
 * per hard page load (bounded by QueryClient defaults: staleTime 30s,
 * refetchOnWindowFocus false, retry false). 401 resolves to undefined data,
 * which all callers already treat as logged-out.
 */
export function useCurrentUser(
  options?: Omit<UseQueryOptions<MeData, ApiRequestError>, "queryKey" | "queryFn">,
) {
  return useQuery<MeData, ApiRequestError>({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<MeData>("/api/v1/me", undefined, signal),
    enabled: true,
    // Fail fast: never retry so the UI surfaces an error state after the
    // first failure (~6s on a slow/failing DB) rather than lingering.
    retry: false,
    ...options,
  });
}

/** GET /api/v1/dashboard — authenticated dashboard bundle. */
/** GET /api/v1/dashboard — authenticated dashboard bundle. */
export function useDashboard(
  options?: Omit<UseQueryOptions<DashboardData, ApiRequestError>, "queryKey" | "queryFn">,
) {
  const { isConnected } = useAccount();
  return useQuery<DashboardData, ApiRequestError>({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => apiGet<DashboardData>("/api/v1/dashboard", undefined, signal),
    enabled: isConnected,
    // Fail fast: never retry so the UI surfaces an error state promptly.
    retry: false,
    ...options,
  });
}

/** GET /api/v1/proposals — public, paginated, filterable list. */
export function useProposals(filters: ProposalFilters = {}, enabled = true) {
  const query: Record<string, string | undefined> = {
    status: filters.status,
    type: filters.type,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page: filters.page ? String(filters.page) : undefined,
    pageSize: filters.pageSize ? String(filters.pageSize) : undefined,
    limit: filters.limit ? String(filters.limit) : undefined,
  };
  return useQuery<{ proposals: Proposal[] }, ApiRequestError>({
    queryKey: queryKeys.proposals(query),
    queryFn: ({ signal }) =>
      apiGet<{ proposals: Proposal[] }>("/api/v1/proposals", query, signal),
    enabled,
    // BUG-2: fail fast (0 retries) so the page surfaces an error / empty state
    // after the FIRST failure instead of lingering on the loading skeleton
    // when the DB is unavailable.
    retry: false,
  });
}

/** GET /api/v1/proposals/[id] — proposal detail + tallies + comments. */
export function useProposalDetail(id: string, enabled = true) {
  return useQuery<ProposalDetailData, ApiRequestError>({
    queryKey: queryKeys.proposalDetail(id),
    queryFn: ({ signal }) =>
      apiGet<ProposalDetailData>(`/api/v1/proposals/${id}`, undefined, signal),
    enabled: enabled && id.length > 0,
    // Fail fast: never retry so a failing DB surfaces the error state promptly.
    retry: false,
  });
}

/** GET /api/v1/proposals/[id]/comments — paginated comments. */
export function useComments(proposalId: string, page = 1, enabled = true) {
  return useQuery<{ comments: ProposalComment[] }, ApiRequestError>({
    queryKey: queryKeys.comments(proposalId, page),
    queryFn: ({ signal }) =>
      apiGet<{ comments: ProposalComment[] }>(
        `/api/v1/proposals/${proposalId}/comments`,
        { page: String(page) },
        signal,
      ),
    enabled: enabled && proposalId.length > 0,
    // Fail fast: never retry so a failing DB surfaces the error state promptly.
    retry: false,
  });
}

/** GET /api/v1/elections/[electionKey]/comments — paginated election comments. */
export function useElectionComments(electionKey: string, page = 1, enabled = true) {
  return useQuery<{ comments: ElectionComment[] }, ApiRequestError>({
    queryKey: queryKeys.electionComments(electionKey, page),
    queryFn: ({ signal }) =>
      apiGet<{ comments: ElectionComment[] }>(
        `/api/v1/elections/${electionKey}/comments`,
        { page: String(page) },
        signal,
      ),
    enabled: enabled && electionKey.length > 0,
    retry: false,
  });
}

// ─────────────────────────────────────────────────────────────
// React Query hooks — mutations
// ─────────────────────────────────────────────────────────────

/** POST /api/v1/proposals — create a proposal. */
export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation<CreateProposalData, ApiRequestError, CreateProposalRequest>({
    mutationFn: (input) =>
      fetchApi<CreateProposalData>("/api/v1/proposals", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success("Proposal submitted!", {
        description: "It will enter review before voting opens.",
      });
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      toast.error("Could not create proposal", { description: error.message });
    },
  });
}

/** POST /api/v1/proposals/[id]/votes — cast a vote. */
export function useCastVote(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<CastVoteData, ApiRequestError, VoteChoice>({
    mutationFn: (choice) =>
      fetchApi<CastVoteData>(`/api/v1/proposals/${proposalId}/votes`, {
        method: "POST",
        body: { choice },
      }),
    onSuccess: (_data, choice) => {
      toast.success(`Vote cast: ${choice}`, {
        description: "Your voting power has been recorded.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      toast.error("Vote failed", { description: error.message });
    },
  });
}

/** PUT /api/v1/proposals/[id]/votes — change an existing vote. */
export function useChangeVote(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<CastVoteData, ApiRequestError, VoteChoice>({
    mutationFn: (choice) =>
      fetchApi<CastVoteData>(`/api/v1/proposals/${proposalId}/votes`, {
        method: "PUT",
        body: { choice },
      }),
    onSuccess: (_data, choice) => {
      toast.success(`Vote changed: ${choice}`, {
        description: "Your voting power has been recorded.",
      });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      toast.error("Vote change failed", { description: error.message });
    },
  });
}


/** GET /api/v1/tags — popular tags for autocomplete. */
export function useTags(query?: string, enabled = true) {
  return useQuery<{ tags: { name: string; count: number }[] }, ApiRequestError>({
    queryKey: queryKeys.tags(query),
    enabled,
    queryFn: () => {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      return apiGet<{ tags: { name: string; count: number }[] }>(
        `/api/v1/tags${qs}`,
      );
    },
    staleTime: 60_000,
  });
}

/** POST /api/v1/proposals/[id]/comments — create a comment. */
export function useCreateComment(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<
    { comment: ProposalComment },
    ApiRequestError,
    { content: string; parentId?: string }
  >({
    mutationFn: (input) =>
      fetchApi<{ comment: ProposalComment }>(
        `/api/v1/proposals/${proposalId}/comments`,
        { method: "POST", body: input },
      ),
    onSuccess: () => {
      toast.success("Comment posted");
      qc.invalidateQueries({ queryKey: ["comments", proposalId] });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
    },
    onError: (error) => {
      toast.error("Could not post comment", { description: error.message });
    },
  });
}

/** POST /api/v1/proposals/[id]/comments/[commentId]/reactions — toggle upvote/downvote. */
export function useToggleReaction(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<
    { reaction: { type: string } | null },
    ApiRequestError,
    { commentId: string; type: "up" | "down" },
    { snapshots: Array<[readonly unknown[], unknown]> }
  >({
    mutationFn: ({ commentId, type }) =>
      fetchApi<{ reaction: { type: string } | null }>(
        `/api/v1/proposals/${proposalId}/comments/${commentId}/reactions`,
        { method: "POST", body: { type } },
      ),
    onMutate: async ({ commentId, type }) => {
      // Apply the optimistic update to BOTH caches that serve proposal comments:
      // 1. ["proposal-detail", proposalId] — the proposal detail page embeds
      //    comments directly in the GET response, so the page reads from here.
      // 2. ["comments", proposalId, *] — any page using `useComments()` directly.
      const snapshots: Array<[readonly unknown[], unknown]> = [];

      await qc.cancelQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      const detailSnapshots = qc.getQueriesData<
        ProposalDetailData | { comments: ProposalComment[] }
      >({ queryKey: queryKeys.proposalDetail(proposalId) });
      for (const [key, data] of detailSnapshots) {
        if (!data || typeof data !== "object" || !("comments" in data)) {
          snapshots.push([key, data]);
          continue;
        }
        const d = data as { comments: ProposalComment[] };
        qc.setQueryData(key, {
          ...d,
          comments: d.comments.map((c) =>
            c.id === commentId ? applyOptimisticReaction(c, type) : c,
          ),
        });
        snapshots.push([key, data]);
      }

      await qc.cancelQueries({ queryKey: ["comments", proposalId] });
      const commentsSnapshots = qc.getQueriesData<{ comments: ProposalComment[] }>({
        queryKey: ["comments", proposalId],
      });
      for (const [key, data] of commentsSnapshots) {
        if (!data) {
          snapshots.push([key, data]);
          continue;
        }
        qc.setQueryData(key, {
          ...data,
          comments: data.comments.map((c) =>
            c.id === commentId ? applyOptimisticReaction(c, type) : c,
          ),
        });
        snapshots.push([key, data]);
      }
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not register reaction", { description: error.message });
    },
    onSettled: () => {
      // Reconcile with server truth regardless of success / failure.
      qc.invalidateQueries({ queryKey: ["comments", proposalId] });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
    },
  });
}

/** POST /api/v1/elections/[electionKey]/comments — create an election comment. */
export function useCreateElectionComment(electionKey: string) {
  const qc = useQueryClient();
  return useMutation<
    { comment: ElectionComment },
    ApiRequestError,
    { content: string; parentId?: string }
  >({
    mutationFn: (input) =>
      fetchApi<{ comment: ElectionComment }>(
        `/api/v1/elections/${electionKey}/comments`,
        { method: "POST", body: input },
      ),
    onSuccess: () => {
      toast.success("Comment posted");
      qc.invalidateQueries({ queryKey: ["election-comments", electionKey] });
    },
    onError: (error) => {
      toast.error("Could not post comment", { description: error.message });
    },
  });
}

/** POST /api/v1/elections/[electionKey]/comments/[commentId]/reactions — toggle reaction. */
export function useToggleElectionReaction(electionKey: string) {
  const qc = useQueryClient();
  return useMutation<
    { reaction: { type: string } | null },
    ApiRequestError,
    { commentId: string; type: "up" | "down" },
    { snapshots: Array<[readonly unknown[], unknown]> }
  >({
    mutationFn: ({ commentId, type }) =>
      fetchApi<{ reaction: { type: string } | null }>(
        `/api/v1/elections/${electionKey}/comments/${commentId}/reactions`,
        { method: "POST", body: { type } },
      ),
    onMutate: async ({ commentId, type }) => {
      await qc.cancelQueries({ queryKey: ["election-comments", electionKey] });
      const snapshots = qc.getQueriesData<{ comments: ElectionComment[] }>({
        queryKey: ["election-comments", electionKey],
      });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, {
          ...data,
          comments: data.comments.map((c) =>
            c.id === commentId ? applyOptimisticReaction(c, type) : c,
          ),
        });
      });
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not register reaction", { description: error.message });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["election-comments", electionKey] });
    },
  });
}

/**
 * Compute the next state of a comment after a vote/reaction click, without
 * waiting for the server. Mirrors the three server branches (DELETE on
 * toggle, UPDATE on swap, INSERT on first click) so `onSettled`
 * invalidation reconciles cleanly.
 *
 * Counts are clamped at 0 to defend against drift if the optimistic state
 * races a recent refetch.
 */
function applyOptimisticReaction<
  T extends { upvotes: number; downvotes: number; myReaction: string | null },
>(current: T, type: "up" | "down"): T {
  const prev = current.myReaction;
  let upvotes = current.upvotes;
  let downvotes = current.downvotes;
  if (prev === type) {
    // Same type → toggle off.
    if (type === "up") upvotes = Math.max(0, upvotes - 1);
    else downvotes = Math.max(0, downvotes - 1);
    return { ...current, upvotes, downvotes, myReaction: null };
  }
  // Switching or first click: decrement previous bucket, increment new bucket.
  if (prev === "up") upvotes = Math.max(0, upvotes - 1);
  if (prev === "down") downvotes = Math.max(0, downvotes - 1);
  if (type === "up") upvotes += 1;
  else downvotes += 1;
  return { ...current, upvotes, downvotes, myReaction: type };
}

/**
 * Apply an optimistic emoji-reaction toggle to a comment or proposal. Mirrors
 * the two server branches (DELETE on toggle off / INSERT on first click) so
 * the `onSettled` invalidation reconciles cleanly. Counts clamped at 0 to
 * defend against drift if the optimistic state races a recent refetch.
 *
 * Note: a user may only hold ONE emoji reaction at a time per target. The
 * `myEmojiReaction` field is a single `EmojiKey | null`, not a set — clicking
 * a different emoji replaces the previous one (counts shift by +1 new / −1
 * old). This mirrors Discord's UX.
 */
function applyOptimisticEmojiReaction<
  T extends {
    emojiReactionCounts: EmojiReactionCounts;
    myEmojiReaction: EmojiKey | null;
  },
>(current: T, emoji: EmojiKey): T {
  const prev = current.myEmojiReaction;
  const counts: EmojiReactionCounts = { ...(current.emojiReactionCounts ?? emptyEmojiCounts()) };
  if (prev === emoji) {
    // Same emoji → toggle off.
    counts[emoji] = Math.max(0, counts[emoji] - 1);
    return { ...current, emojiReactionCounts: counts, myEmojiReaction: null };
  }
  // Switching or first click: decrement previous bucket, increment new bucket.
  if (prev && counts[prev] !== undefined) {
    counts[prev] = Math.max(0, counts[prev] - 1);
  }
  counts[emoji] = (counts[emoji] ?? 0) + 1;
  return { ...current, emojiReactionCounts: counts, myEmojiReaction: emoji };
}

/** POST /api/v1/proposals/[id]/reactions — toggle emoji reaction on proposal. */
export function useToggleProposalReaction(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<
    { reaction: { emoji: EmojiKey } | null },
    ApiRequestError,
    { emoji: EmojiKey },
    { snapshots: Array<[readonly unknown[], unknown]> }
  >({
    mutationFn: ({ emoji }) =>
      fetchApi<{ reaction: { emoji: EmojiKey } | null }>(
        `/api/v1/proposals/${proposalId}/reactions`,
        { method: "POST", body: { emoji } },
      ),
    onMutate: async ({ emoji }) => {
      const snapshots: Array<[readonly unknown[], unknown]> = [];

      // Optimistically update the proposal detail cache.
      await qc.cancelQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      const detailSnapshots = qc.getQueriesData<ProposalDetailData>({
        queryKey: queryKeys.proposalDetail(proposalId),
      });
      for (const [key, data] of detailSnapshots) {
        if (!data || typeof data !== "object" || !data.proposal) {
          snapshots.push([key, data]);
          continue;
        }
        qc.setQueryData(key, {
          ...data,
          proposal: applyOptimisticEmojiReaction(data.proposal, emoji),
        });
        snapshots.push([key, data]);
      }

      // Optimistically update any list-view proposals cache that contains this
      // proposal (so cards reflect the new count immediately).
      const listSnapshots = qc.getQueriesData<{ proposals: Proposal[] }>({
        queryKey: ["proposals"],
      });
      for (const [key, data] of listSnapshots) {
        if (!data) {
          snapshots.push([key, data]);
          continue;
        }
        qc.setQueryData(key, {
          ...data,
          proposals: data.proposals.map((p) =>
            p.id === proposalId ? applyOptimisticEmojiReaction(p, emoji) : p,
          ),
        });
        snapshots.push([key, data]);
      }
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not register emoji reaction", {
        description: error.message,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

/** POST /api/v1/proposals/[id]/comments/[commentId]/emoji-reactions — toggle emoji reaction on proposal comment. */
export function useToggleCommentEmojiReaction(proposalId: string) {
  const qc = useQueryClient();
  return useMutation<
    { reaction: { emoji: EmojiKey } | null },
    ApiRequestError,
    { commentId: string; emoji: EmojiKey },
    { snapshots: Array<[readonly unknown[], unknown]> }
  >({
    mutationFn: ({ commentId, emoji }) =>
      fetchApi<{ reaction: { emoji: EmojiKey } | null }>(
        `/api/v1/proposals/${proposalId}/comments/${commentId}/emoji-reactions`,
        { method: "POST", body: { emoji } },
      ),
    onMutate: async ({ commentId, emoji }) => {
      const snapshots: Array<[readonly unknown[], unknown]> = [];

      // 1. proposal-detail cache embeds comments inline.
      await qc.cancelQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
      const detailSnapshots = qc.getQueriesData<
        ProposalDetailData | { comments: ProposalComment[] }
      >({ queryKey: queryKeys.proposalDetail(proposalId) });
      for (const [key, data] of detailSnapshots) {
        if (!data || typeof data !== "object" || !("comments" in data)) {
          snapshots.push([key, data]);
          continue;
        }
        const d = data as { comments: ProposalComment[] };
        qc.setQueryData(key, {
          ...d,
          comments: d.comments.map((c) =>
            c.id === commentId ? applyOptimisticEmojiReaction(c, emoji) : c,
          ),
        });
        snapshots.push([key, data]);
      }

      // 2. direct comments list cache.
      await qc.cancelQueries({ queryKey: ["comments", proposalId] });
      const commentsSnapshots = qc.getQueriesData<{ comments: ProposalComment[] }>({
        queryKey: ["comments", proposalId],
      });
      for (const [key, data] of commentsSnapshots) {
        if (!data) {
          snapshots.push([key, data]);
          continue;
        }
        qc.setQueryData(key, {
          ...data,
          comments: data.comments.map((c) =>
            c.id === commentId ? applyOptimisticEmojiReaction(c, emoji) : c,
          ),
        });
        snapshots.push([key, data]);
      }
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not register emoji reaction", {
        description: error.message,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", proposalId] });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposalId) });
    },
  });
}

/** POST /api/v1/elections/[electionKey]/comments/[commentId]/emoji-reactions — toggle emoji reaction on election comment. */
export function useToggleElectionCommentEmojiReaction(electionKey: string) {
  const qc = useQueryClient();
  return useMutation<
    { reaction: { emoji: EmojiKey } | null },
    ApiRequestError,
    { commentId: string; emoji: EmojiKey },
    { snapshots: Array<[readonly unknown[], unknown]> }
  >({
    mutationFn: ({ commentId, emoji }) =>
      fetchApi<{ reaction: { emoji: EmojiKey } | null }>(
        `/api/v1/elections/${electionKey}/comments/${commentId}/emoji-reactions`,
        { method: "POST", body: { emoji } },
      ),
    onMutate: async ({ commentId, emoji }) => {
      await qc.cancelQueries({ queryKey: queryKeys.electionComments(electionKey) });
      const snapshots = qc.getQueriesData<{ comments: ElectionComment[] }>({
        queryKey: ["election-comments", electionKey],
      });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, {
          ...data,
          comments: data.comments.map((c) =>
            c.id === commentId ? applyOptimisticEmojiReaction(c, emoji) : c,
          ),
        });
      });
      return { snapshots };
    },
    onError: (error, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not register emoji reaction", {
        description: error.message,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.electionComments(electionKey) });
    },
  });
}

/** PATCH /api/v1/settings — update display name / preferences. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation<
    UpdateSettingsData,
    ApiRequestError,
    {
      displayName?: string;
      notifications?: Record<string, boolean>;
      preferredWallet?: string | null;
      displayFormat?: "full" | "abbreviated" | "raw";
    }
  >({
    mutationFn: (input) =>
      fetchApi<UpdateSettingsData>("/api/v1/settings", { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: queryKeys.me });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (error) => {
      toast.error("Could not save settings", { description: error.message });
    },
  });
}

/** GET /api/v1/notifications — list user's notifications with unread count. */
export function useNotifications(page = 1, limit = 20) {
  return useQuery<{ notifications: Notification[]; unreadCount: number }, ApiRequestError>({
    queryKey: ["notifications", page, limit],
    queryFn: () => apiGet<{ notifications: Notification[]; unreadCount: number }>(
      `/api/v1/notifications?page=${page}&limit=${limit}`,
    ),
    staleTime: 30_000, // 30 seconds
  });
}

/** GET /api/v1/notifications/unread-count — just the badge count. */
export function useUnreadCount() {
  return useQuery<{ unreadCount: number }, ApiRequestError>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiGet<{ unreadCount: number }>(`/api/v1/notifications/unread-count`),
    staleTime: 30_000,
    refetchInterval: 30_000, // Auto-refresh every 30 seconds
  });
}

/** PUT /api/v1/notifications/[id]/read — mark a single notification as read. */
export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, ApiRequestError, string>({
    mutationFn: (id) =>
      fetchApi<{ success: boolean }>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: "PUT",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

/** PUT /api/v1/notifications/read-all — mark all notifications as read. */
export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean }, ApiRequestError, void>({
    mutationFn: () =>
      fetchApi<{ success: boolean }>(`/api/v1/notifications/read-all`, {
        method: "PUT",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      toast.success("All notifications marked as read");
    },
    onError: (error) => {
      toast.error("Could not mark notifications as read", { description: error.message });
    },
  });
}

// Filter types for API calls
export interface ProposalFilters {
  status?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}
