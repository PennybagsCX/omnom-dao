import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import {
  ADDR_DOLPHIN,
  ADDR_WHALE,
  makeProposal,
} from "@/__tests__/helpers/mocks";

/**
 * Integration tests for GET/POST /api/v1/proposals.
 * All data-access layers are mocked; the route handlers are invoked directly.
 */

// ── Hoisted mock state ───────────────────────────────────────────
const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
    constructor(code: "UNAUTHORIZED" = "UNAUTHORIZED") {
      super("auth required");
      this.name = "UnauthorizedError";
      this.code = code;
    }
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    canCreateProposalType: vi.fn(),
    listProposals: vi.fn(),
    checkRateLimit: vi.fn(),
    execute: vi.fn(),
    notifyProposalCreated: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
  canCreateProposalType: hoisted.canCreateProposalType,
  RATE_WINDOWS: {
    proposalPerUser: { limit: 3, windowSeconds: 604800 },
    noncePerAddress: { limit: 5, windowSeconds: 300 },
    apiPerIp: { limit: 60, windowSeconds: 60 },
    verifyPerIp: { limit: 10, windowSeconds: 300 },
    commentPerUser: { limit: 30, windowSeconds: 86400 },
  },
}));
vi.mock("@/lib/proposal-service", () => ({ listProposals: hoisted.listProposals }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
  userActionBucket: (a: string, b: string) => `rl:${a}:${b.toLowerCase()}`,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
vi.mock("@/lib/notifications", () => ({ notifyProposalCreated: hoisted.notifyProposalCreated }));

const GOOD_BODY = {
  title: "A valid proposal title",
  description: "This is a sufficiently long description body for the proposal.",
  type: "GENERAL",
};

function sessionFor(address: string) {
  return {
    sub: address,
    holderClass: "DOLPHIN",
    votingPower: 5000,
    iat: 1,
    exp: 9999999999,
  };
}

function buildPostReq(body: unknown) {
  return {
    method: "POST",
    url: "http://localhost/api/v1/proposals",
    nextUrl: new URL("http://localhost/api/v1/proposals"),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposals/route").POST>[0];
}

function buildGetReq(query: Record<string, string>) {
  const url = new URL("http://localhost/api/v1/proposals");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return {
    method: "GET",
    url: url.toString(),
    nextUrl: url,
    headers: new Headers(),
    json: vi.fn(),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposals/route").GET>[0];
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/v1/proposals/route");
  const res = (await POST(buildPostReq(body))) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function get(query: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/v1/proposals/route");
  const res = (await GET(buildGetReq(query))) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue(sessionFor(ADDR_DOLPHIN));
  hoisted.canCreateProposalType.mockReturnValue(true);
  hoisted.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 2, resetAt: 0, count: 1 });
  hoisted.notifyProposalCreated.mockResolvedValue(undefined);
  // Anti-spam: no prior proposals.
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    if (stmt.sql.startsWith("SELECT created_at FROM proposals WHERE author_address")) {
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("INSERT INTO proposals")) {
      return { rows: [{ id: "new-prop" }], columns: ["id"], rowsAffected: 1, lastInsertRowid: 1n };
    }
    if (stmt.sql.startsWith("SELECT id, title")) {
      return {
        rows: [
          {
            id: "new-prop",
            title: GOOD_BODY.title,
            description: GOOD_BODY.description,
            type: "GENERAL",
            status: "PENDING_REVIEW",
            author_address: ADDR_DOLPHIN,
            created_at: "2026-06-15T00:00:00.000Z",
            updated_at: null,
            voting_starts_at: null,
            voting_ends_at: null,
            quorum_required: 10,
            quorum_achieved: null,
            votes_for: 0,
            votes_against: 0,
            votes_abstain: 0,
            metadata: JSON.stringify({ type: "base", links: [], tags: [] }),
          },
        ],
        columns: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      };
    }
    return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
  });
});

describe("GET /api/v1/proposals", () => {
  it("returns a paginated list with meta", async () => {
    const proposals = [makeProposal({ id: "p1" }), makeProposal({ id: "p2" })];
    hoisted.listProposals.mockResolvedValue({ proposals, total: 2 });
    const { status, body } = await get({ page: "1", pageSize: "20" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as { proposals: unknown[] }).proposals).toHaveLength(2);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 2, totalPages: 1 });
  });

  it("passes status/type/sort filters through to listProposals", async () => {
    hoisted.listProposals.mockResolvedValue({ proposals: [], total: 0 });
    await get({ status: "ACTIVE", type: "GENERAL", sort: "votesFor", sortOrder: "asc" });
    expect(hoisted.listProposals).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        type: "GENERAL",
        sortBy: "votesFor",
        sortOrder: "asc",
        limit: 20,
        offset: 0,
      }),
    );
  });

  it("computes offset from page + pageSize", async () => {
    hoisted.listProposals.mockResolvedValue({ proposals: [], total: 0 });
    await get({ page: "3", pageSize: "10" });
    expect(hoisted.listProposals).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 20 }));
  });

  it("rejects an invalid sort key with 400", async () => {
    const { status } = await get({ sort: "bogus" });
    expect(status).toBe(400);
  });
});

describe("POST /api/v1/proposals — auth + validation", () => {
  it("returns 401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError());
    const { status, body } = await post(GOOD_BODY);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("rejects a short title with 400", async () => {
    const { status } = await post({ ...GOOD_BODY, title: "short" });
    expect(status).toBe(400);
  });

  it("rejects a too-short description with 400", async () => {
    const { status } = await post({ ...GOOD_BODY, description: "tiny" });
    expect(status).toBe(400);
  });
});

describe("POST /api/v1/proposals — tier gating", () => {
  it("returns 403 when the holder class cannot create this type", async () => {
    hoisted.canCreateProposalType.mockReturnValue(false);
    const { status, body } = await post({ ...GOOD_BODY, type: "CHAIN_SELECTION" });
    expect(status).toBe(403);
    expect((body.error as { code: string }).code).toBe("NOT_VERIFIED");
  });

  it("allows creation when the tier check passes", async () => {
    const { status } = await post(GOOD_BODY);
    expect(status).toBe(201);
  });

  it("whales can create high-impact types (canCreateProposalType wired to holder class)", async () => {
    hoisted.requireAuth.mockResolvedValue(sessionFor(ADDR_WHALE));
    hoisted.canCreateProposalType.mockReturnValue(true);
    const { status } = await post({ ...GOOD_BODY, type: "TOKENOMICS_CHANGE" });
    expect(status).toBe(201);
  });

  it("shark session can create high-impact types", async () => {
    // Create a mock shark session - rank 4, meets SHARK requirement
    const sharkSession = {
      sub: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
      holderClass: "SHARK",
      votingPower: 500000000,
      iat: 1,
      exp: 9999999999,
    };
    hoisted.requireAuth.mockResolvedValue(sharkSession);
    hoisted.canCreateProposalType.mockReturnValue(true);
    const { status } = await post({ ...GOOD_BODY, type: "TECHNICAL" });
    expect(status).toBe(201);
  });

  it("octopus session gets 403 for high-impact types with class-requirement message", async () => {
    // Create a mock octopus session - rank 3, below SHARK requirement
    const octopusSession = {
      sub: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
      holderClass: "OCTOPUS",
      votingPower: 50000000,
      iat: 1,
      exp: 9999999999,
    };
    hoisted.requireAuth.mockResolvedValue(octopusSession);
    hoisted.canCreateProposalType.mockReturnValue(false);
    const { status, body } = await post({ ...GOOD_BODY, type: "CHAIN_SELECTION" });
    expect(status).toBe(403);
    expect((body.error as { code: string }).code).toBe("NOT_VERIFIED");
  });
});

describe("POST /api/v1/proposals — anti-spam", () => {
  it("blocks when the 3/week rate limit is exceeded", async () => {
    hoisted.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0, count: 4 });
    const { status, body } = await post(GOOD_BODY);
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });

  it("blocks when the last proposal was < 24h ago", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT created_at FROM proposals WHERE author_address")) {
        return { rows: [{ created_at: new Date().toISOString() }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status, body } = await post(GOOD_BODY);
    expect(status).toBe(429);
    expect((body.error as { code: string }).code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/v1/proposals — success path", () => {
  it("creates a proposal and returns 201 with the proposal body", async () => {
    const { status, body } = await post(GOOD_BODY);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as { proposal: { id: string } }).proposal.id).toBe("new-prop");
    // Non-draft proposals fan out notifications.
    expect(hoisted.notifyProposalCreated).toHaveBeenCalledWith("new-prop", ADDR_DOLPHIN);
  });

  it("sanitizes the description before persisting", async () => {
    await post({ ...GOOD_BODY, description: GOOD_BODY.description + "<script>x</script>" });
    const insertCall = hoisted.execute.mock.calls.find(
      (c) => typeof c[0] === "object" && (c[0] as { sql: string }).sql.startsWith("INSERT INTO proposals"),
    );
    const args = (insertCall![0] as { args: unknown[] }).args;
    // description is the 2nd positional arg after title; script tag stripped.
    expect(args[1]).not.toContain("<script>");
  });
});
