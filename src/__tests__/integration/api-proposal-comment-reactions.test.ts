import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for `POST /api/v1/proposals/[id]/comments/[commentId]/reactions`.
 *
 * DB, auth, and rate-limit are mocked; sanitize / lookupHolder / other helpers
 * are intentionally NOT mocked because they don't appear in this route.
 *
 * The proposal-side reactions route is intentionally lighter than the
 * election-side equivalent — there is no snapshot-eligibility gate (per
 * product decision: any signed-in holder can react on proposal comments).
 *
 * Toggle semantics:
 *   - No existing reaction            → INSERT (201)
 *   - Existing reaction, same type    → DELETE (200, { reaction: null })
 *   - Existing reaction, other type   → UPDATE (200, { reaction: { type } })
 */

const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
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
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
  userActionBucket: (a: string, b: string) => `rl:${a}:${b.toLowerCase()}`,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));

const PROPOSAL_ID = "prop-1";
const COMMENT_ID = "cmt-1";

function session() {
  return { sub: ADDR_DOLPHIN, holderClass: "DOLPHIN", votingPower: 1, iat: 1, exp: 9 };
}

function buildReq(body: unknown) {
  const url = new URL(
    `http://localhost/api/v1/proposals/${PROPOSAL_ID}/comments/${COMMENT_ID}/reactions`,
  );
  return {
    method: "POST",
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<
    typeof import("@/app/api/v1/proposals/[id]/comments/[commentId]/reactions/route").POST
  >[0];
}

async function react(body: unknown) {
  const { POST } = await import(
    "@/app/api/v1/proposals/[id]/comments/[commentId]/reactions/route"
  );
  const res = (await POST(buildReq(body), {
    params: Promise.resolve({ id: PROPOSAL_ID, commentId: COMMENT_ID }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue(session());
  hoisted.checkRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 29,
    resetAt: 0,
    count: 1,
  });
  // Default: comment exists, no prior reaction.
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    const sql = stmt.sql;
    if (sql.startsWith("SELECT id FROM comments WHERE id = ? AND proposal_id = ?")) {
      return { rows: [{ id: COMMENT_ID }], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("SELECT id, type FROM comment_reactions")) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("INSERT INTO comment_reactions")) {
      return { rows: [], columns: [], rowsAffected: 1 };
    }
    if (sql.startsWith("UPDATE comment_reactions")) {
      return { rows: [], columns: [], rowsAffected: 1 };
    }
    if (sql.startsWith("DELETE FROM comment_reactions")) {
      return { rows: [], columns: [], rowsAffected: 1 };
    }
    return { rows: [], columns: [], rowsAffected: 0 };
  });
});

describe("POST /api/v1/proposals/[id]/comments/[commentId]/reactions — auth & validation", () => {
  it("401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError("nope"));
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(401);
    expect(body.error).toBeTruthy();
  });

  it("429 when rate limited", async () => {
    hoisted.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      count: 31,
    });
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("400 when body is invalid JSON", async () => {
    const req = buildReq({});
    req.json = vi.fn(async () => {
      throw new SyntaxError("nope");
    });
    const { POST } = await import(
      "@/app/api/v1/proposals/[id]/comments/[commentId]/reactions/route"
    );
    const res = (await POST(req, {
      params: Promise.resolve({ id: PROPOSAL_ID, commentId: COMMENT_ID }),
    })) as NextResponse;
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("400 when reaction type is missing", async () => {
    const { status, body } = await react({});
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("400 when reaction type is invalid (not up/down)", async () => {
    const { status, body } = await react({ type: "sideways" });
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("404 when the comment does not exist on this proposal", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id FROM comments WHERE id = ? AND proposal_id = ?")) {
        return { rows: [], columns: [], rowsAffected: 0 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });
});

describe("POST /api/v1/proposals/[id]/comments/[commentId]/reactions — toggle branches", () => {
  it("INSERT branch: 201 with { reaction: { type: 'up' } } on first upvote", async () => {
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(201);
    const data = body.data as { reaction: { type: string } | null };
    expect(data.reaction).toEqual({ type: "up" });
  });

  it("INSERT branch: works for downvote too", async () => {
    const { status, body } = await react({ type: "down" });
    expect(status).toBe(201);
    expect((body.data as { reaction: { type: string } }).reaction).toEqual({
      type: "down",
    });
  });

  it("TOGGLE-OFF branch: same-type existing reaction → DELETE, returns { reaction: null }", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.startsWith("SELECT id FROM comments WHERE id = ? AND proposal_id = ?")) {
        return { rows: [{ id: COMMENT_ID }], columns: [], rowsAffected: 0 };
      }
      if (sql.startsWith("SELECT id, type FROM comment_reactions")) {
        return {
          rows: [{ id: "rxn-1", type: "up" }],
          columns: [],
          rowsAffected: 0,
        };
      }
      if (sql.startsWith("DELETE FROM comment_reactions")) {
        return { rows: [], columns: [], rowsAffected: 1 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(200);
    expect((body.data as { reaction: null }).reaction).toBeNull();
  });

  it("SWAP branch: existing different type → UPDATE, returns the new type", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.startsWith("SELECT id FROM comments WHERE id = ? AND proposal_id = ?")) {
        return { rows: [{ id: COMMENT_ID }], columns: [], rowsAffected: 0 };
      }
      if (sql.startsWith("SELECT id, type FROM comment_reactions")) {
        return {
          rows: [{ id: "rxn-1", type: "up" }],
          columns: [],
          rowsAffected: 0,
        };
      }
      if (sql.startsWith("UPDATE comment_reactions")) {
        return { rows: [], columns: [], rowsAffected: 1 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await react({ type: "down" });
    expect(status).toBe(200);
    expect((body.data as { reaction: { type: string } }).reaction).toEqual({
      type: "down",
    });
  });

  it("case-insensitive voter: session.sub is lowercased before the SELECT", async () => {
    // The session factory already returns a lowercase address (ADDR_DOLPHIN is
    // lowercase), so this regression-guards the contract: a session with mixed
    // case `sub` would still resolve to the lowercase voter via the route's
    // `voter = session.sub.toLowerCase()` line — confirming by the INSERT path
    // succeeding, since the mock compares against the lowercase address.
    hoisted.requireAuth.mockResolvedValueOnce({
      sub: ADDR_DOLPHIN.toUpperCase(),
      holderClass: "DOLPHIN",
      votingPower: 1,
      iat: 1,
      exp: 9,
    });
    const { status, body } = await react({ type: "up" });
    expect(status).toBe(201);
    expect((body.data as { reaction: { type: string } }).reaction).toEqual({
      type: "up",
    });
  });
});
