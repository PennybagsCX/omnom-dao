import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, makeProposal } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for GET/POST /api/v1/proposals/[id]/comments.
 * DB, auth, rate-limit, notifications are mocked; text/sanitize use real impls.
 */

const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    getProposalById: vi.fn(),
    checkRateLimit: vi.fn(),
    execute: vi.fn(),
    notifyMentions: vi.fn(),
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
vi.mock("@/lib/proposal-service", () => ({ getProposalById: hoisted.getProposalById }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
  userActionBucket: (a: string, b: string) => `rl:${a}:${b.toLowerCase()}`,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
vi.mock("@/lib/notifications", () => ({ notifyMentionsFromContent: hoisted.notifyMentions }));

const PROPOSAL_ID = "prop-1";

function session() {
  return { sub: ADDR_DOLPHIN, holderClass: "DOLPHIN", votingPower: 1, iat: 1, exp: 9 };
}

function buildReq(body: unknown, method: "POST" | "GET" = "POST", query: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}/comments`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    method,
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposals/[id]/comments/route").POST>[0];
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/v1/proposals/[id]/comments/route");
  const res = await POST(buildReq(body, "POST"), { params: Promise.resolve({ id: PROPOSAL_ID }) });
  return { status: (res as NextResponse).status, body: (await (res as NextResponse).json()) as Record<string, unknown> };
}

async function get(query: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/v1/proposals/[id]/comments/route");
  const res = (await GET(buildReq(undefined, "GET", query), {
    params: Promise.resolve({ id: PROPOSAL_ID }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue(session());
  hoisted.getProposalById.mockResolvedValue(makeProposal({ id: PROPOSAL_ID }));
  hoisted.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: 0, count: 1 });
  hoisted.notifyMentions.mockResolvedValue(undefined);
  // Default: no prior comment (no 30s throttle, no dup), insert succeeds.
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    if (stmt.sql.startsWith("SELECT created_at FROM comments WHERE author_address")) {
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("SELECT COUNT(*) AS cnt FROM comments")) {
      return { rows: [{ cnt: 1 }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("SELECT content FROM comments")) {
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("SELECT id, proposal_id")) {
      return {
        rows: [
          {
            id: "cmt-1",
            proposal_id: PROPOSAL_ID,
            author_address: ADDR_DOLPHIN,
            content: "hello",
            created_at: "2026-06-15T00:00:00.000Z",
            parent_id: null,
            deleted_at: null,
          },
        ],
        columns: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      };
    }
    if (stmt.sql.startsWith("INSERT INTO comments")) {
      return { rows: [{ id: "cmt-1", created_at: "2026-06-15T00:00:00.000Z" }], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
    }
    return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
  });
});

describe("POST /api/v1/proposals/[id]/comments — auth + proposal", () => {
  it("returns 401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError());
    const { status } = await post({ content: "hi" });
    expect(status).toBe(401);
  });

  it("returns 404 when the proposal does not exist", async () => {
    hoisted.getProposalById.mockResolvedValue(null);
    const { status } = await post({ content: "hi" });
    expect(status).toBe(404);
  });

  it("rejects an empty comment with 400", async () => {
    const { status } = await post({ content: "" });
    expect(status).toBe(400);
  });
});

describe("POST /api/v1/proposals/[id]/comments — rate limits", () => {
  it("blocks when the 30/day comment limit is exceeded", async () => {
    hoisted.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0, count: 31 });
    const { status, body } = await post({ content: "fresh content here" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("blocks when the previous comment was < 30s ago", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT created_at FROM comments WHERE author_address")) {
        return { rows: [{ created_at: new Date().toISOString() }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status, body } = await post({ content: "fresh content here" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/v1/proposals/[id]/comments — fuzzy duplicate detection", () => {
  it("blocks near-identical comments (Levenshtein ≤ 3)", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT content FROM comments")) {
        return { rows: [{ content: "Great proposal, fully support!" }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status, body } = await post({ content: "Great proposal, fully suport!" });
    expect(status).toBe(429);
    expect((body.error as { message: string }).message).toContain("similar");
  });

  it("does not flag clearly different comments", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT content FROM comments")) {
        return { rows: [{ content: "I completely disagree with everything here" }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      if (stmt.sql.startsWith("INSERT INTO comments")) {
        return { rows: [{ id: "cmt-1", created_at: "2026-06-15T00:00:00.000Z" }], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status } = await post({ content: "This is a brand new take on the matter" });
    expect(status).toBe(201);
  });
});

describe("POST /api/v1/proposals/[id]/comments — sanitization + success", () => {
  it("strips HTML before persisting the comment", async () => {
    const { status } = await post({ content: "nice <script>alert(1)</script> comment" });
    expect(status).toBe(201);
    const insertCall = hoisted.execute.mock.calls.find(
      (c) => typeof c[0] === "object" && (c[0] as { sql: string }).sql.startsWith("INSERT INTO comments"),
    );
    const args = (insertCall![0] as { args: unknown[] }).args;
    // content is the 3rd arg (proposal_id, author_address, content, parent_id).
    expect(args[2]).not.toContain("<script>");
    expect(args[2]).toContain("comment");
  });

  it("returns 201 with the created comment", async () => {
    const { status, body } = await post({ content: "a thoughtful remark" });
    expect(status).toBe(201);
    expect((body.data as { comment: { id: string } }).comment.id).toBe("cmt-1");
  });
});

describe("GET /api/v1/proposals/[id]/comments", () => {
  it("returns 404 when the proposal does not exist", async () => {
    hoisted.getProposalById.mockResolvedValue(null);
    const { status } = await get();
    expect(status).toBe(404);
  });

  it("returns paginated comments", async () => {
    const { status, body } = await get({ page: "1", limit: "50" });
    expect(status).toBe(200);
    expect((body.data as { comments: unknown[] }).comments).toHaveLength(1);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 50 });
  });

  it("renders '[deleted]' for soft-deleted comments", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT COUNT(*) AS cnt")) {
        return { rows: [{ cnt: 1 }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      if (stmt.sql.startsWith("SELECT id, proposal_id")) {
        return {
          rows: [
            {
              id: "cmt-1",
              proposal_id: PROPOSAL_ID,
              author_address: ADDR_DOLPHIN,
              content: "original",
              created_at: "2026-06-15T00:00:00.000Z",
              parent_id: null,
              deleted_at: "2026-06-16T00:00:00.000Z",
            },
          ],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { body } = await get();
    const comment = (body.data as { comments: Array<{ content: string }> }).comments[0]!;
    expect(comment.content).toBe("[deleted]");
  });
});
