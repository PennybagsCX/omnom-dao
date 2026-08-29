import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for /api/v1/elections/[electionKey]/comments/*
 * DB, auth, rate-limit, and snapshot are mocked; sanitize + text use real impls.
 *
 * Mirrors `api-comments.test.ts` with one structural difference: the
 * eligibility gate lives at the snapshot level (every voter must be in the
 * ever-held snapshot), enforced via `lookupHolder`. Comments are also
 * blocked after the voting window closes.
 */

const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    lookupHolder: vi.fn(),
    lookupHolderClasses: vi.fn(),
    checkRateLimit: vi.fn(),
    execute: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
  RATE_WINDOWS: {
    commentPerUser: { limit: 30, windowSeconds: 86400 },
    proposalPerUser: { limit: 3, windowSeconds: 604800 },
    noncePerAddress: { limit: 5, windowSeconds: 300 },
    apiPerIp: { limit: 60, windowSeconds: 60 },
    verifyPerIp: { limit: 10, windowSeconds: 300 },
  },
}));
vi.mock("@/lib/snapshot", () => ({
  lookupHolder: hoisted.lookupHolder,
  lookupHolderClasses: hoisted.lookupHolderClasses,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
  userActionBucket: (a: string, b: string) => `rl:${a}:${b.toLowerCase()}`,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
// Note: `@/lib/constants` is NOT mocked — the route imports `isAdminAddress`
// and `RATE_LIMITS`, both of which are stable pure functions. Mocking them
// would require reproducing the full `ERROR_CODE_MAP` shape that `apiError`
// reads. Letting the real implementation through keeps the test surface
// honest and avoids the cascading "No export defined" failures.

const ELECTION_KEY = "foundational-2026";

function session() {
  return { sub: ADDR_DOLPHIN, holderClass: "DOLPHIN", votingPower: 1, iat: 1, exp: 9 };
}

function buildReq(body: unknown, method: "POST" | "GET" = "POST", query: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/v1/elections/${ELECTION_KEY}/comments`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/elections/[electionKey]/comments/route").POST>[0];
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/v1/elections/[electionKey]/comments/route");
  const res = (await POST(buildReq(body, "POST"), {
    params: Promise.resolve({ electionKey: ELECTION_KEY }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function get(query: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/v1/elections/[electionKey]/comments/route");
  const res = (await GET(buildReq(undefined, "GET", query), {
    params: Promise.resolve({ electionKey: ELECTION_KEY }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function openElectionRow() {
  const start = new Date(Date.now() - 60_000).toISOString();
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return { election_key: ELECTION_KEY, voting_starts_at: start, voting_ends_at: end };
}

function closedElectionRow() {
  const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() - 60_000).toISOString();
  return { election_key: ELECTION_KEY, voting_starts_at: start, voting_ends_at: end };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue(session());
  hoisted.lookupHolder.mockResolvedValue({ address: ADDR_DOLPHIN, holderClass: "DOLPHIN" });
  hoisted.lookupHolderClasses.mockResolvedValue(new Map());
  hoisted.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: 0, count: 1 });
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    const sql = stmt.sql;
    if (sql.includes("FROM governance_election WHERE")) return Promise.resolve({ rows: [openElectionRow()], columns: [], rowsAffected: 0 });
    if (sql.startsWith("SELECT created_at FROM election_comments WHERE author_address")) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("SELECT COUNT(*) AS cnt FROM election_comments")) {
      return { rows: [{ cnt: 0 }], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("SELECT id, election_key")) {
      return {
        rows: [],
        columns: [],
        rowsAffected: 0,
      };
    }
    if (sql.startsWith("SELECT content FROM election_comments")) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("SELECT id FROM election_comments WHERE id = ?")) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("INSERT INTO election_comments")) {
      return { rows: [{ id: "ecm-1", created_at: "2026-08-29T12:00:00.000Z" }], columns: [], rowsAffected: 1 };
    }
    return { rows: [], columns: [], rowsAffected: 0 };
  });
});

describe("POST /api/v1/elections/[electionKey]/comments — auth + snapshot eligibility", () => {
  it("401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError("nope"));
    const { status, body } = await post({ content: "hi" });
    expect(status).toBe(401);
    expect(body.error).toBeTruthy();
  });

  it("404 when the election does not exist", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM governance_election WHERE")) return Promise.resolve({ rows: [], columns: [], rowsAffected: 0 });
      return Promise.resolve({ rows: [], columns: [], rowsAffected: 0 });
    });
    const { status, body } = await post({ content: "hi" });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("NOT_FOUND");
  });

  it("404 NOT_IN_SNAPSHOT when the wallet is not in the ever-held snapshot", async () => {
    hoisted.lookupHolder.mockResolvedValue(null);
    const { status, body } = await post({ content: "hi" });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("NOT_IN_SNAPSHOT");
  });

  it("409 VOTING_CLOSED when posting after the window closes", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM governance_election WHERE")) {
        return Promise.resolve({ rows: [closedElectionRow()], columns: [], rowsAffected: 0 });
      }
      return Promise.resolve({ rows: [], columns: [], rowsAffected: 0 });
    });
    const { status, body } = await post({ content: "hi" });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
  });

  it("400 on missing content", async () => {
    const { status, body } = await post({});
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("201 on a valid post", async () => {
    const { status, body } = await post({ content: "Quadratic looks right." });
    expect(status).toBe(201);
    const data = body.data as { comment: { content: string; electionKey: string } };
    expect(data.comment.content).toBe("Quadratic looks right.");
    expect(data.comment.electionKey).toBe(ELECTION_KEY);
  });

  it("rejects fuzzy duplicates within the rolling window", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.includes("FROM governance_election WHERE")) return Promise.resolve({ rows: [openElectionRow()], columns: [], rowsAffected: 0 });
      if (sql.startsWith("SELECT created_at FROM election_comments WHERE author_address")) {
        return { rows: [], columns: [], rowsAffected: 0 };
      }
      if (sql.startsWith("SELECT content FROM election_comments")) {
        // Tiny Levenshtein distance from "Quadratic looks right" → "Quadratic looks right!" (1 edit).
        return { rows: [{ content: "Quadratic looks right" }], columns: [], rowsAffected: 1 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await post({ content: "Quadratic looks right!" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("429 when daily comment limit is exceeded", async () => {
    hoisted.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0, count: 31 });
    const { status, body } = await post({ content: "spam" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });
});

describe("GET /api/v1/elections/[electionKey]/comments", () => {
  it("returns paginated threaded comments", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.includes("FROM governance_election WHERE")) return Promise.resolve({ rows: [openElectionRow()], columns: [], rowsAffected: 0 });
      if (sql.startsWith("SELECT COUNT(*) AS cnt FROM election_comments")) {
        return { rows: [{ cnt: 1 }], columns: [], rowsAffected: 0 };
      }
      if (sql.startsWith("SELECT id, election_key")) {
        return {
          rows: [
            {
              id: "ecm-1",
              election_key: ELECTION_KEY,
              author_address: ADDR_DOLPHIN,
              content: "first comment",
              created_at: "2026-08-29T12:00:00.000Z",
              parent_id: null,
              deleted_at: null,
            },
          ],
          columns: [],
          rowsAffected: 0,
        };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await get();
    expect(status).toBe(200);
    const data = body.data as { comments: Array<{ id: string; electionKey: string }> };
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0]?.id).toBe("ecm-1");
    expect(data.comments[0]?.electionKey).toBe(ELECTION_KEY);
  });

  it("404 when the election is not configured", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM governance_election WHERE")) return Promise.resolve({ rows: [], columns: [], rowsAffected: 0 });
      return Promise.resolve({ rows: [], columns: [], rowsAffected: 0 });
    });
    const { status } = await get();
    expect(status).toBe(404);
  });
});

describe("DELETE /api/v1/elections/[electionKey]/comments/[commentId]", () => {
  function buildDeleteReq() {
    const url = new URL(`http://localhost/api/v1/elections/${ELECTION_KEY}/comments/ecm-1`);
    return {
      method: "DELETE",
      url: url.toString(),
      nextUrl: url,
      headers: new Headers(),
      json: vi.fn(),
      text: vi.fn(),
      cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
    } as unknown as Parameters<typeof import("@/app/api/v1/elections/[electionKey]/comments/[commentId]/route").DELETE>[0];
  }

  async function del() {
    const { DELETE } = await import(
      "@/app/api/v1/elections/[electionKey]/comments/[commentId]/route"
    );
    const res = (await DELETE(buildDeleteReq(), {
      params: Promise.resolve({ electionKey: ELECTION_KEY, commentId: "ecm-1" }),
    })) as NextResponse;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("soft-deletes the comment for the author", async () => {
    hoisted.execute.mockResolvedValueOnce({
      rows: [{ id: "ecm-1", author_address: ADDR_DOLPHIN, deleted_at: null }],
      columns: [],
      rowsAffected: 0,
    });
    const { status, body } = await del();
    expect(status).toBe(200);
    expect((body.data as { deleted: boolean }).deleted).toBe(true);
  });

  it("403 when a different wallet tries to delete someone else's comment", async () => {
    hoisted.execute.mockResolvedValueOnce({
      rows: [{ id: "ecm-1", author_address: "0x000000000000000000000000000000000000dEaD", deleted_at: null }],
      columns: [],
      rowsAffected: 0,
    });
    const { status, body } = await del();
    expect(status).toBe(403);
    expect((body.error as { code: string }).code).toBe("NOT_VERIFIED");
  });

  it("404 when the comment does not exist", async () => {
    hoisted.execute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });
    const { status } = await del();
    expect(status).toBe(404);
  });
});
