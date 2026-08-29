import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for `POST /api/v1/proposals/[id]/reactions` (emoji).
 *
 * Mirrors the structure of `api-proposal-comment-reactions.test.ts`:
 *   DB, auth, and rate-limit are mocked. Toggle semantics are
 *     - No existing reaction            → INSERT (201)
 *     - Existing reaction (same emoji)  → DELETE (200, { reaction: null })
 *   Because the UNIQUE constraint includes emoji, there is no SWAP branch.
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

function session() {
  return { sub: ADDR_DOLPHIN, holderClass: "DOLPHIN", votingPower: 1, iat: 1, exp: 9 };
}

function buildReq(body: unknown) {
  const url = new URL(
    `http://localhost/api/v1/proposals/${PROPOSAL_ID}/reactions`,
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
    typeof import("@/app/api/v1/proposals/[id]/reactions/route").POST
  >[0];
}

async function react(body: unknown) {
  const { POST } = await import(
    "@/app/api/v1/proposals/[id]/reactions/route"
  );
  const res = (await POST(buildReq(body), {
    params: Promise.resolve({ id: PROPOSAL_ID }),
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
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    const sql = stmt.sql;
    if (sql.startsWith("SELECT id FROM proposals WHERE id = ?")) {
      return { rows: [{ id: PROPOSAL_ID }], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("SELECT id FROM proposal_emoji_reactions")) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    if (sql.startsWith("INSERT INTO proposal_emoji_reactions")) {
      return { rows: [], columns: [], rowsAffected: 1 };
    }
    if (sql.startsWith("DELETE FROM proposal_emoji_reactions")) {
      return { rows: [], columns: [], rowsAffected: 1 };
    }
    return { rows: [], columns: [], rowsAffected: 0 };
  });
});

describe("POST /api/v1/proposals/[id]/reactions — auth & validation", () => {
  it("401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError("nope"));
    const { status, body } = await react({ emoji: "heart" });
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
    const { status, body } = await react({ emoji: "heart" });
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("400 when body is invalid JSON", async () => {
    const req = buildReq({});
    req.json = vi.fn(async () => {
      throw new SyntaxError("nope");
    });
    const { POST } = await import(
      "@/app/api/v1/proposals/[id]/reactions/route"
    );
    const res = (await POST(req, {
      params: Promise.resolve({ id: PROPOSAL_ID }),
    })) as NextResponse;
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("400 when emoji is missing", async () => {
    const { status, body } = await react({});
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("400 when emoji is unknown", async () => {
    const { status, body } = await react({ emoji: "unicorn" });
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBe("MISSING_FIELDS");
  });

  it("404 when the proposal does not exist", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id FROM proposals WHERE id = ?")) {
        return { rows: [], columns: [], rowsAffected: 0 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await react({ emoji: "heart" });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });
});

describe("POST /api/v1/proposals/[id]/reactions — toggle branches", () => {
  it("INSERT branch: 201 with { reaction: { emoji } } on first click", async () => {
    const { status, body } = await react({ emoji: "heart" });
    expect(status).toBe(201);
    expect((body.data as { reaction: { emoji: string } }).reaction).toEqual({
      emoji: "heart",
    });
  });

  it("INSERT branch: works for every valid emoji key", async () => {
    const keys = [
      "thumbs_up",
      "heart",
      "tada",
      "smile",
      "open_mouth",
      "cry",
      "thinking",
      "thumbs_down",
    ];
    for (const emoji of keys) {
      const { status, body } = await react({ emoji });
      expect(status).toBe(201);
      expect((body.data as { reaction: { emoji: string } }).reaction).toEqual({
        emoji,
      });
    }
  });

  it("TOGGLE-OFF branch: existing same-emoji row → DELETE, returns { reaction: null }", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.startsWith("SELECT id FROM proposals WHERE id = ?")) {
        return { rows: [{ id: PROPOSAL_ID }], columns: [], rowsAffected: 0 };
      }
      if (sql.startsWith("SELECT id FROM proposal_emoji_reactions")) {
        return {
          rows: [{ id: "rxn-1" }],
          columns: [],
          rowsAffected: 0,
        };
      }
      if (sql.startsWith("DELETE FROM proposal_emoji_reactions")) {
        return { rows: [], columns: [], rowsAffected: 1 };
      }
      return { rows: [], columns: [], rowsAffected: 0 };
    });
    const { status, body } = await react({ emoji: "heart" });
    expect(status).toBe(200);
    expect((body.data as { reaction: null }).reaction).toBeNull();
  });

  it("case-insensitive voter: session.sub is lowercased before the SELECT", async () => {
    hoisted.requireAuth.mockResolvedValueOnce({
      sub: ADDR_DOLPHIN.toUpperCase(),
      holderClass: "DOLPHIN",
      votingPower: 1,
      iat: 1,
      exp: 9,
    });
    const { status, body } = await react({ emoji: "heart" });
    expect(status).toBe(201);
    expect((body.data as { reaction: { emoji: string } }).reaction).toEqual({
      emoji: "heart",
    });
  });
});