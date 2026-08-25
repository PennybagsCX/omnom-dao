import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, makeProposal } from "@/__tests__/helpers/mocks";
import { ProposalStatus } from "@/types";

/**
 * Integration tests for POST/PUT /api/v1/proposals/[id]/votes.
 * DB, auth, snapshot, and delegation layers are mocked.
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
    lookupHolder: vi.fn(),
    getOutgoingDelegation: vi.fn(),
    execute: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
  RATE_WINDOWS: {},
}));
vi.mock("@/lib/proposal-service", () => ({ getProposalById: hoisted.getProposalById }));
vi.mock("@/lib/snapshot", () => ({ lookupHolder: hoisted.lookupHolder }));
vi.mock("@/lib/delegation", () => ({
  getOutgoingDelegation: hoisted.getOutgoingDelegation,
  effectiveStatus: () => "active",
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));

const PROPOSAL_ID = "prop-1";

function sessionFor(power = 1000) {
  return { sub: ADDR_DOLPHIN, holderClass: "DOLPHIN", votingPower: power, iat: 1, exp: 9 };
}

function buildReq(body: unknown, method: "POST" | "PUT" = "POST") {
  return {
    method,
    url: `http://localhost/api/v1/proposals/${PROPOSAL_ID}/votes`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}/votes`),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposals/[id]/votes/route").POST>[0];
}

async function callVote(
  handler: "POST" | "PUT",
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const mod = await import("@/app/api/v1/proposals/[id]/votes/route");
  const fn = (mod as unknown as Record<string, (req: unknown, ctx: unknown) => Promise<NextResponse>>)[handler]!;
  const res = await fn(buildReq(body, handler), { params: Promise.resolve({ id: PROPOSAL_ID }) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function activeProposal(overrides = {}) {
  const start = new Date(Date.now() - 86_400_000).toISOString();
  const end = new Date(Date.now() + 86_400_000).toISOString();
  return makeProposal({ id: PROPOSAL_ID, status: ProposalStatus.ACTIVE, votingStartsAt: start, votingEndsAt: end, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue(sessionFor(1000));
  hoisted.getProposalById.mockResolvedValue(activeProposal());
  hoisted.lookupHolder.mockResolvedValue({ address: ADDR_DOLPHIN, balanceRaw: "1000", votingPower: 1000 });
  hoisted.getOutgoingDelegation.mockResolvedValue(null);
  // By default: no existing vote, insert succeeds, tally returns.
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    if (stmt.sql.startsWith("SELECT id FROM votes WHERE proposal_id")) {
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("INSERT INTO votes")) {
      return { rows: [{ id: "vote-1", created_at: "2026-06-15T00:00:00.000Z" }], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
    }
    if (stmt.sql.startsWith("SELECT choice, SUM")) {
      return { rows: [{ choice: "FOR", total: 1000 }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
  });
});

describe("POST /api/v1/proposals/[id]/votes — auth", () => {
  it("returns 401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError());
    const { status } = await callVote("POST", { choice: "FOR" });
    expect(status).toBe(401);
  });
});

describe("POST /api/v1/proposals/[id]/votes — voting window", () => {
  it("rejects voting on a CLOSED proposal with 409", async () => {
    hoisted.getProposalById.mockResolvedValue(activeProposal({ status: ProposalStatus.CLOSED }));
    const { status, body } = await callVote("POST", { choice: "FOR" });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
  });

  it("rejects voting when voting has ended (past votingEndsAt)", async () => {
    const pastStart = new Date(Date.now() - 200_000).toISOString();
    const pastEnd = new Date(Date.now() - 100_000).toISOString();
    hoisted.getProposalById.mockResolvedValue(activeProposal({ votingStartsAt: pastStart, votingEndsAt: pastEnd }));
    const { status } = await callVote("POST", { choice: "FOR" });
    expect(status).toBe(409);
  });

  it("rejects an invalid choice with 400", async () => {
    const { status } = await callVote("POST", { choice: "MAYBE" });
    expect(status).toBe(400);
  });
});

describe("POST /api/v1/proposals/[id]/votes — duplicate / power", () => {
  it("blocks double voting (pre-check finds an existing vote)", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id FROM votes WHERE proposal_id")) {
        return { rows: [{ id: "existing" }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status, body } = await callVote("POST", { choice: "FOR" });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("ALREADY_VOTED");
  });

  it("treats a UNIQUE constraint failure as already voted", async () => {
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("INSERT INTO votes")) throw new Error("UNIQUE constraint failed");
      if (stmt.sql.startsWith("SELECT id FROM votes WHERE proposal_id")) {
        return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status } = await callVote("POST", { choice: "FOR" });
    expect(status).toBe(409);
  });

  it("records voting power recomputed from the immutable snapshot (ignoring the stale JWT session value)", async () => {
    // Session claims 999 — must be IGNORED in favour of the snapshot balance.
    hoisted.requireAuth.mockResolvedValue(sessionFor(999));
    // 42 * 1e18 raw units -> 42 whole-token voting power.
    hoisted.lookupHolder.mockResolvedValue({
      address: ADDR_DOLPHIN,
      balanceRaw: "42000000000000000000",
      votingPower: 999,
    });
    const { status, body } = await callVote("POST", { choice: "AGAINST" });
    expect(status).toBe(201);
    expect((body.data as { vote: { votingPower: number } }).vote.votingPower).toBe(42);
  });
});

describe("PUT /api/v1/proposals/[id]/votes — change vote", () => {
  it("only permits changes within the final 12h window", async () => {
    // votingEndsAt far in the future (> 12h) -> 409.
    const end = new Date(Date.now() + 86_400_000).toISOString();
    hoisted.getProposalById.mockResolvedValue(activeProposal({ votingEndsAt: end }));
    const { status, body } = await callVote("PUT", { choice: "ABSTAIN" });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
  });

  it("allows a change when within the final 12h and a vote exists", async () => {
    // votingEndsAt < 12h away.
    const end = new Date(Date.now() + 3_600_000).toISOString();
    hoisted.getProposalById.mockResolvedValue(activeProposal({ votingEndsAt: end }));
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id, created_at FROM votes WHERE proposal_id")) {
        return { rows: [{ id: "vote-1", created_at: "2026-06-15T00:00:00.000Z" }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      if (stmt.sql.startsWith("SELECT choice, SUM")) {
        return { rows: [{ choice: "ABSTAIN", total: 1000 }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status, body } = await callVote("PUT", { choice: "ABSTAIN" });
    expect(status).toBe(200);
    expect((body.data as { vote: { choice: string } }).vote.choice).toBe("ABSTAIN");
  });

  it("returns 409 when changing but no existing vote exists", async () => {
    const end = new Date(Date.now() + 3_600_000).toISOString();
    hoisted.getProposalById.mockResolvedValue(activeProposal({ votingEndsAt: end }));
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id, created_at FROM votes WHERE proposal_id")) {
        return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const { status } = await callVote("PUT", { choice: "FOR" });
    expect(status).toBe(409);
  });
});
