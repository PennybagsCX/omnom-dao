/**
 * Shared mock factories and test fixtures for the OMNOM DAO test suite.
 *
 * These factories isolate tests from real infrastructure (Turso/libSQL,
 * Vercel KV, next/headers, viem crypto) so unit + integration tests are
 * deterministic and fast.
 */
import { vi } from "vitest";
import type { Client, InStatement, ResultSet } from "@libsql/client";
import {
  HolderClass,
  ProposalStatus,
  ProposalType,
  type Proposal,
  type ProposalComment,
} from "@/types";
import type { SerializedHolder } from "@/lib/snapshot";

// ── Address fixtures ────────────────────────────────────────────

export const ADDR_WHALE = "0x5b38da6a701c568545dcfcb03fcb875f56beddc4";
export const ADDR_DOLPHIN = "0x4b0897b0513fdc7c541b6d9d7e929c4e5184ab37";
export const ADDR_FISH = "0x583031d11133ad61259a079313b7c443a4843f30";
export const ADDR_ABSENT = "0x0000000000000000000000000000000000000001";

// ── Holder fixtures ─────────────────────────────────────────────

export function makeHolder(overrides: Partial<SerializedHolder> = {}): SerializedHolder {
  return {
    address: ADDR_DOLPHIN,
    rank: 1,
    balanceRaw: "1000000000000000000",
    balanceFormatted: "1.0",
    percentageOfSupply: 0.5,
    holderClass: HolderClass.DOLPHIN,
    ...overrides,
  };
}

export function whaleHolder(): SerializedHolder {
  return makeHolder({
    address: ADDR_WHALE,
    rank: 1,
    balanceRaw: "2000000000000000000000000",
    balanceFormatted: "2,000,000.0",
    percentageOfSupply: 5.0,
    holderClass: HolderClass.WHALE,
  });
}

export function dolphinHolder(): SerializedHolder {
  return makeHolder({
    address: ADDR_DOLPHIN,
    rank: 2,
    balanceRaw: "5000000000000000000000",
    balanceFormatted: "5,000.0",
    percentageOfSupply: 0.05,
    holderClass: HolderClass.DOLPHIN,
  });
}

export function fishHolder(): SerializedHolder {
  return makeHolder({
    address: ADDR_FISH,
    rank: 100,
    balanceRaw: "1000000000000000000",
    balanceFormatted: "1.0",
    percentageOfSupply: 0.001,
    holderClass: HolderClass.FISH,
  });
}

// ── libSQL (Turso) client mock ──────────────────────────────────

export interface MockExecuteHandler {
  (stmt: InStatement): ResultSet;
}

/**
 * Build a fake libSQL `Client`. Each `execute` call is routed through the
 * provided handler, which maps the SQL statement (with bound args) to a
 * `InResultSet`. The handler may also be a jest/vi mock function.
 */
export function createMockDbClient(handler: MockExecuteHandler): Client {
  const wrapped = vi.fn((stmt: InStatement) => handler(stmt));
  return {
    execute: wrapped,
    batch: vi.fn(async () => []),
    transaction: vi.fn(async () => ({
      execute: wrapped,
      batch: vi.fn(async () => []),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      closed: false,
    })),
    close: vi.fn(),
    closed: false,
  } as unknown as Client;
}

/** Build a `ResultSet` from a list of plain row objects. */
export function resultSet(rows: Record<string, unknown>[]): ResultSet {
  return {
    rows: rows as unknown as ResultSet["rows"],
    columns: rows[0] ? Object.keys(rows[0]!) : [],
    columnTypes: [],
    rowsAffected: rows.length,
    lastInsertRowid: undefined,
  } as unknown as ResultSet;
}

/** Empty result set (zero rows). */
export const EMPTY_RESULT = {
  rows: [],
  columns: [],
  columnTypes: [],
  rowsAffected: 0,
  lastInsertRowid: undefined,
} as unknown as ResultSet;

// ── Vercel KV mock ──────────────────────────────────────────────

export interface KvState {
  /** In-memory map backing the KV store. */
  store: Map<string, unknown>;
  /** Counter per incr key. */
  counters: Map<string, number>;
  /** TTL expiry (ms epoch) per key. */
  ttls: Map<string, number>;
}

export function createKvState(): KvState {
  return { store: new Map(), counters: new Map(), ttls: new Map() };
}

/**
 * Build a mock `@vercel/kv` module object backed by an in-memory `KvState`.
 * Implements get/set/del/incr/expire with the subset of behavior the app
 * relies on (fixed-window counters + TTL expiry).
 */
export function createKvMock(state: KvState) {
  const now = () => Date.now();
  return {
    kv: {
      async get<T = unknown>(key: string): Promise<T | null> {
        if (state.ttls.get(key) !== undefined && state.ttls.get(key)! < now()) {
          state.store.delete(key);
          state.counters.delete(key);
        }
        return (state.store.get(key) as T) ?? null;
      },
      async set(key: string, value: unknown, opts?: { ex?: number }): Promise<string> {
        state.store.set(key, value);
        if (opts?.ex) state.ttls.set(key, now() + opts.ex * 1000);
        return "OK";
      },
      async del(key: string): Promise<number> {
        state.store.delete(key);
        state.counters.delete(key);
        return 1;
      },
      async incr(key: string): Promise<number> {
        if (state.ttls.get(key) !== undefined && state.ttls.get(key)! < now()) {
          state.counters.delete(key);
        }
        const next = (state.counters.get(key) ?? 0) + 1;
        state.counters.set(key, next);
        return next;
      },
      async expire(key: string, seconds: number): Promise<number> {
        state.ttls.set(key, now() + seconds * 1000);
        return 1;
      },
    },
  };
}

/** Advance the KV clock so windows expire (ms). */
export function expireKvWindows(state: KvState, ms: number): void {
  const target = Date.now() + ms;
  for (const [k, t] of state.ttls) {
    if (t <= target) {
      state.store.delete(k);
      state.counters.delete(k);
      state.ttls.delete(k);
    }
  }
}

// ── Proposal / comment fixtures ─────────────────────────────────

export function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "prop-1",
    title: "Test proposal title",
    description: "A description of the proposal.",
    type: ProposalType.GENERAL,
    status: ProposalStatus.ACTIVE,
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-06-01T00:00:00.000Z",
    votingStartsAt: "2026-06-01T00:00:00.000Z",
    votingEndsAt: "2026-07-01T00:00:00.000Z",
    quorumRequired: 10,
    quorumAchieved: null,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    metadata: { type: "base", links: [], tags: [] },
    ...overrides,
  };
}

export function makeComment(overrides: Partial<ProposalComment> = {}): ProposalComment {
  return {
    id: "cmt-1",
    proposalId: "prop-1",
    authorAddress: ADDR_DOLPHIN,
    content: "This is a comment.",
    createdAt: "2026-06-10T00:00:00.000Z",
    parentId: null,
    deletedAt: null,
    upvotes: 0,
    downvotes: 0,
    myReaction: null,
    ...overrides,
  };
}

// ── NextRequest builder ─────────────────────────────────────────

/**
 * Minimal `NextRequest`-shaped object for invoking route handlers directly.
 * Provides `json()`, `nextUrl.searchParams`, and the cookies API surface
 * the handlers use.
 */
export function buildRequest(opts: {
  url?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const url = new URL(opts.url ?? "http://localhost/api/v1/test");
  const bodyText = opts.body !== undefined ? JSON.stringify(opts.body) : null;
  return {
    method: opts.method ?? "POST",
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(opts.headers ?? {}),
    json: vi.fn(async () => (opts.body as Record<string, unknown>) ?? {}),
    text: vi.fn(async () => bodyText ?? ""),
    cookies: {
      get: vi.fn(),
      getAll: vi.fn(() => []),
    },
  };
}
