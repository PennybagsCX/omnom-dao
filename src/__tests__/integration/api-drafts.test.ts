import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";

/**
 * Integration tests for GET / POST / DELETE /api/v1/proposal-drafts.
 *
 * Covers the full draft lifecycle:
 *   - List user's drafts (auth-gated, owner-scoped)
 *   - Create new draft (POST without id)
 *   - Update existing draft (POST with id, owner-checked)
 *   - Delete draft (owner-checked)
 *   - Ownership enforcement (cannot edit/delete another wallet's draft)
 *   - Validation (invalid input, missing fields)
 *
 * DB + auth are mocked. The mock DB returns realistic shapes and tracks
 * in-memory state across test cases so we exercise the full flow.
 */

interface DraftRow {
  id: string;
  wallet_address: string;
  type: string;
  title: string;
  summary: string;
  body_markdown: string;
  tags: string;
  duration_hours: number;
  quorum_required: number;
  created_at: string;
  updated_at: string;
}

const ALICE = "0xalice0000000000000000000000000000000001";
const BOB = "0xbb00000000000000000000000000000000000002";

const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  // In-memory store keyed by id.
  const store = new Map<string, DraftRow>();
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    store,
    // Mock DB executor: routes SQL to in-memory ops.
    execute: vi.fn(async (stmt: { sql: string; args?: unknown[] }) => {
      const args = stmt.args ?? [];
      const s = stmt.sql.trim();
      if (s.startsWith("SELECT COUNT")) {
        const wallet = args[0] as string;
        let n = 0;
        for (const r of store.values()) if (r.wallet_address === wallet) n++;
        return { rows: [{ n }], rowsAffected: 0, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("SELECT") && s.includes("wallet_address FROM proposal_drafts")) {
        // Ownership check (SELECT wallet_address FROM proposal_drafts WHERE id = ?).
        const id = args[0] as string;
        const r = store.get(id);
        return { rows: r ? [{ wallet_address: r.wallet_address }] : [], rowsAffected: 0, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("SELECT") && s.includes("FROM proposal_drafts")) {
        const wallet = args[0] as string;
        const rows = Array.from(store.values())
          .filter((r) => r.wallet_address === wallet)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, 100);
        return { rows, rowsAffected: 0, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("UPDATE proposal_drafts")) {
        // [type, title, summary, body_markdown, tags, duration_hours, quorum_required, id, wallet]
        const [type, title, summary, body, tags, dur, quorum, id, wallet] = args as [
          string, string, string, string, string, number, number, string, string,
        ];
        const r = store.get(id);
        if (!r || r.wallet_address !== wallet) {
          return { rows: [], rowsAffected: 0, columns: [], lastInsertRowid: undefined };
        }
        store.set(id, { ...r, type, title, summary, body_markdown: body, tags, duration_hours: dur, quorum_required: quorum, updated_at: new Date().toISOString() });
        return { rows: [], rowsAffected: 1, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("INSERT INTO proposal_drafts")) {
        // [wallet, type, title, summary, body, tags, dur, quorum]
        const [wallet, type, title, summary, body, tags, dur, quorum] = args as [
          string, string, string, string, string, string, number, number,
        ];
        const id = "draft-" + Math.random().toString(16).slice(2, 10);
        store.set(id, {
          id, wallet_address: wallet, type, title, summary,
          body_markdown: body, tags, duration_hours: dur, quorum_required: quorum,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return { rows: [{ id }], rowsAffected: 1, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("DELETE FROM proposal_drafts") && s.includes("LIMIT")) {
        // Cap-enforcement delete: oldest first.
        const [wallet, limit] = args as [string, number];
        const matching = Array.from(store.values())
          .filter((r) => r.wallet_address === wallet)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
        let removed = 0;
        for (const r of matching.slice(0, limit)) {
          store.delete(r.id);
          removed++;
        }
        return { rows: [], rowsAffected: removed, columns: [], lastInsertRowid: undefined };
      }
      if (s.startsWith("DELETE FROM proposal_drafts")) {
        const [id, wallet] = args as [string, string];
        const r = store.get(id);
        if (!r || r.wallet_address !== wallet) {
          return { rows: [], rowsAffected: 0, columns: [], lastInsertRowid: undefined };
        }
        store.delete(id);
        return { rows: [], rowsAffected: 1, columns: [], lastInsertRowid: undefined };
      }
      return { rows: [], rowsAffected: 0, columns: [], lastInsertRowid: undefined };
    }),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
  RATE_WINDOWS: {},
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute: hoisted.execute }),
}));

beforeEach(() => {
  hoisted.store.clear();
  hoisted.requireAuth.mockReset();
  hoisted.execute.mockClear();
});

function sessionFor(wallet: string) {
  return { sub: wallet, holderClass: "DOLPHIN", votingPower: 1000, iat: 1, exp: 9 };
}

function buildReq(body: unknown, method: "GET" | "POST" | "DELETE" = "GET", id?: string) {
  const url = id
    ? `http://localhost/api/v1/proposal-drafts/${id}`
    : "http://localhost/api/v1/proposal-drafts";
  return {
    method,
    url,
    nextUrl: new URL(url),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposal-drafts/route").GET>[0];
}

interface DraftResponse {
  id?: string;
  created?: boolean;
  deleted?: boolean;
  drafts?: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    bodyMarkdown: string;
    tags: string[];
    durationHours: number;
    quorumRequired: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface ApiResponse {
  success: boolean;
  data: DraftResponse;
  error?: { code: string; message: string };
}

async function listDrafts(wallet: string): Promise<{ status: number; body: ApiResponse }> {
  hoisted.requireAuth.mockResolvedValue(sessionFor(wallet));
  const mod = await import("@/app/api/v1/proposal-drafts/route");
  const res = (await mod.GET(buildReq(null, "GET"))) as NextResponse;
  return { status: res.status, body: (await res.json()) as ApiResponse };
}

async function createDraft(
  wallet: string,
  data: Record<string, unknown>,
): Promise<{ status: number; body: ApiResponse; id: string | null }> {
  hoisted.requireAuth.mockResolvedValue(sessionFor(wallet));
  const mod = await import("@/app/api/v1/proposal-drafts/route");
  const res = (await mod.POST(buildReq(data, "POST"))) as NextResponse;
  const body = (await res.json()) as ApiResponse;
  return { status: res.status, body, id: body.data?.id ?? null };
}

async function updateDraft(
  wallet: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ status: number; body: ApiResponse }> {
  hoisted.requireAuth.mockResolvedValue(sessionFor(wallet));
  const mod = await import("@/app/api/v1/proposal-drafts/route");
  const res = (await mod.POST(buildReq({ id, ...data }, "POST"))) as NextResponse;
  return { status: res.status, body: (await res.json()) as ApiResponse };
}

async function deleteDraft(
  wallet: string,
  id: string,
): Promise<{ status: number; body: ApiResponse }> {
  hoisted.requireAuth.mockResolvedValue(sessionFor(wallet));
  const mod = await import("@/app/api/v1/proposal-drafts/[id]/route");
  const res = (await mod.DELETE(buildReq(null, "DELETE", id), {
    params: Promise.resolve({ id }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as ApiResponse };
}

describe("GET /api/v1/proposal-drafts", () => {
  it("returns 401 when unauthenticated", async () => {
    // Set the mock to reject BEFORE the request (don't use the helper,
    // which would overwrite the mock with a resolved session).
    hoisted.requireAuth.mockRejectedValue(
      Object.assign(new Error("unauth"), { code: "UNAUTHORIZED", statusCode: 401 }),
    );
    const mod = await import("@/app/api/v1/proposal-drafts/route");
    const res = (await mod.GET(buildReq(null, "GET"))) as NextResponse;
    expect(res.status).toBe(401);
  });

  it("returns an empty list for a fresh user", async () => {
    const { status, body } = await listDrafts(ALICE);
    expect(status).toBe(200);
    expect(body.data.drafts!).toEqual([]);
  });

  it("returns only the caller's drafts (owner isolation)", async () => {
    await createDraft(ALICE, { title: "Alice 1" });
    await createDraft(ALICE, { title: "Alice 2" });
    await createDraft(BOB, { title: "Bob 1" });

    const alice = await listDrafts(ALICE);
    const bob = await listDrafts(BOB);
    expect(alice.body.data.drafts!).toHaveLength(2);
    expect(bob.body.data.drafts!).toHaveLength(1);
    expect(alice.body.data.drafts!.every((d) => d.title.startsWith("Alice"))).toBe(true);
    expect(bob.body.data.drafts![0]!.title).toBe("Bob 1");
  });
});

describe("POST /api/v1/proposal-drafts", () => {
  it("creates a new draft when no id is supplied", async () => {
    const r = await createDraft(ALICE, { title: "New draft", bodyMarkdown: "x" });
    expect(r.status).toBe(200);
    expect(r.body.data.created!).toBe(true);
    expect(r.id).toBeTruthy();
  });

  it("updates an existing draft when id matches the caller's draft", async () => {
    const created = await createDraft(ALICE, { title: "Original" });
    const r = await updateDraft(ALICE, created.id!, { title: "Updated" });
    expect(r.status).toBe(200);
    expect(r.body.data.created!).toBe(false);
    // The list should still have 1 row (updated in place, not duplicated).
    const list = await listDrafts(ALICE);
    expect(list.body.data.drafts!).toHaveLength(1);
    expect(list.body.data.drafts![0]!.title).toBe("Updated");
  });

  it("rejects updates to a non-existent draft with 404", async () => {
    const r = await updateDraft(ALICE, "draft-doesnotexist", { title: "x" });
    expect(r.status).toBe(404);
  });

  it("rejects updates to a draft owned by another wallet with 404 (no info leak)", async () => {
    const bobsDraft = await createDraft(BOB, { title: "Bob's draft" });
    // Alice tries to update Bob's draft.
    const r = await updateDraft(ALICE, bobsDraft.id!, { title: "Hijacked" });
    expect(r.status).toBe(404);
    // Confirm Bob's draft is unchanged.
    const list = await listDrafts(BOB);
    expect(list.body.data.drafts![0]!.title).toBe("Bob's draft");
  });

  it("rejects invalid payload (title too long) with 400", async () => {
    const longTitle = "a".repeat(201);
    const r = await createDraft(ALICE, { title: longTitle });
    expect(r.status).toBe(400);
  });

  it("enforces 20-draft cap by deleting oldest when user is at cap", async () => {
    // Create 20 drafts as Alice.
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await createDraft(ALICE, { title: `Draft ${i}` });
      ids.push(r.id!);
    }
    let list = await listDrafts(ALICE);
    expect(list.body.data.drafts!).toHaveLength(20);

    // Create one more — should evict the oldest.
    const newOne = await createDraft(ALICE, { title: "Draft 20" });
    expect(newOne.status).toBe(200);

    list = await listDrafts(ALICE);
    expect(list.body.data.drafts!).toHaveLength(20);
    // The oldest ("Draft 0") should be gone.
    const titles = list.body.data.drafts!.map((d) => d.title).sort();
    expect(titles).not.toContain("Draft 0");
    expect(titles).toContain("Draft 20");
  });
});

describe("DELETE /api/v1/proposal-drafts/[id]", () => {
  it("deletes a draft owned by the caller", async () => {
    const r = await createDraft(ALICE, { title: "To delete" });
    const del = await deleteDraft(ALICE, r.id!);
    expect(del.status).toBe(200);
    expect(del.body.data.deleted!).toBe(true);
    const list = await listDrafts(ALICE);
    expect(list.body.data.drafts!).toHaveLength(0);
  });

  it("returns success (deleted:false) when draft doesn't exist", async () => {
    const r = await deleteDraft(ALICE, "nope");
    expect(r.status).toBe(200);
    expect(r.body.data.deleted!).toBe(false);
  });

  it("returns success (deleted:false) when deleting another wallet's draft", async () => {
    const bobsDraft = await createDraft(BOB, { title: "Bob" });
    const r = await deleteDraft(ALICE, bobsDraft.id!);
    expect(r.status).toBe(200);
    expect(r.body.data.deleted!).toBe(false);
    // Confirm Bob's draft is still there.
    const list = await listDrafts(BOB);
    expect(list.body.data.drafts!).toHaveLength(1);
  });

  it("rejects malformed id with 400", async () => {
    const r = await deleteDraft(ALICE, "x".repeat(100));
    expect(r.status).toBe(400);
  });
});
