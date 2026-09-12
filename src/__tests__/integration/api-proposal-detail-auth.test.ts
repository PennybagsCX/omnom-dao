import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE, makeProposal } from "@/__tests__/helpers/mocks";
import { MIGRATION_STATEMENTS } from "../../../scripts/migrations";

/**
 * Integration tests for GET /api/v1/proposals/[id] — authenticated myVote
 * hydration.
 *
 * Unlike the sibling api-*.test.ts suites (which mock `db.execute` with
 * hand-crafted rows), this suite backs `db` with a REAL in-memory libsql
 * client running the actual migration schema. That validates every SQL
 * statement the route issues against the real table definitions — the class
 * of bug where a query references a nonexistent column (e.g. the `voted_at`
 * 500 that broke the detail page for every logged-in visitor on Turso while
 * anonymous requests worked) is invisible to hand-mocked rows.
 */

const PROPOSAL_ID = "prop-real-1";

// ── Hoisted mock state ───────────────────────────────────────────
const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    getSessionAddress: vi.fn(),
    getProposalById: vi.fn(),
    lookupHolderClasses: vi.fn(),
    finalizeProposal: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
  getSessionAddress: hoisted.getSessionAddress,
  RATE_WINDOWS: {
    proposalPerUser: { limit: 3, windowSeconds: 604800 },
    noncePerAddress: { limit: 5, windowSeconds: 300 },
    apiPerIp: { limit: 60, windowSeconds: 60 },
    verifyPerIp: { limit: 10, windowSeconds: 300 },
    commentPerUser: { limit: 30, windowSeconds: 86400 },
  },
}));
vi.mock("@/lib/proposal-service", () => ({ getProposalById: hoisted.getProposalById }));
vi.mock("@/lib/snapshot", () => ({ lookupHolderClasses: hoisted.lookupHolderClasses }));
vi.mock("@/lib/proposal-finalize", () => ({ finalizeProposal: hoisted.finalizeProposal }));
// The key difference: db is a REAL in-memory libsql client, not a vi.fn().
vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  return { db: createClient({ url: ":memory:" }) };
});

function buildReq() {
  return {
    method: "GET",
    url: `http://localhost/api/v1/proposals/${PROPOSAL_ID}`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}`),
    headers: new Headers(),
    json: vi.fn(),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/proposals/[id]/route").GET>[0];
}

async function get() {
  const { GET } = await import("@/app/api/v1/proposals/[id]/route");
  const res = (await GET(buildReq(), {
    params: Promise.resolve({ id: PROPOSAL_ID }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  // Apply the real production schema to the in-memory database.
  const { db } = await import("@/lib/db");
  for (const stmt of MIGRATION_STATEMENTS) {
    await db.execute(stmt.sql);
  }
});

beforeEach(async () => {
  vi.clearAllMocks();
  const { db } = await import("@/lib/db");

  // Reset seeded tables between tests.
  await db.execute("DELETE FROM votes");
  await db.execute("DELETE FROM proposals");
  await db.execute("DELETE FROM users");

  hoisted.getProposalById.mockResolvedValue(
    makeProposal({ id: PROPOSAL_ID, votingEndsAt: "2030-01-01T00:00:00.000Z" }),
  );
  hoisted.lookupHolderClasses.mockResolvedValue(new Map());
  hoisted.finalizeProposal.mockResolvedValue(undefined);

  // Seed: two users, the proposal, and one FOR vote from DOLPHIN (power 10).
  await db.execute({
    sql: "INSERT INTO users (wallet_address) VALUES (?), (?)",
    args: [ADDR_DOLPHIN, ADDR_WHALE],
  });
  await db.execute({
    sql: "INSERT INTO proposals (id, title, description, author_address) VALUES (?, ?, ?, ?)",
    args: [PROPOSAL_ID, "Real-schema proposal", "Body long enough.", ADDR_DOLPHIN],
  });
  await db.execute({
    sql: "INSERT INTO votes (proposal_id, voter_address, choice, voting_power) VALUES (?, ?, ?, ?)",
    args: [PROPOSAL_ID, ADDR_DOLPHIN, "FOR", 10],
  });
});

describe("GET /api/v1/proposals/[id] — myVote hydration against the real schema", () => {
  it("returns the signed-in voter's ballot on the real schema (regression: voted_at)", async () => {
    hoisted.getSessionAddress.mockResolvedValue(ADDR_DOLPHIN);

    const { status, body } = await get();

    // Pre-fix this was 500 INTERNAL_ERROR ("no such column: voted_at") for
    // EVERY authenticated visitor while anonymous requests returned 200.
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as {
      myVote: { choice: string; votingPower: number; votedAt: string } | null;
      votes: { totalFor: number };
    };
    expect(data.myVote).toEqual({
      choice: "FOR",
      votingPower: 10,
      votedAt: expect.any(String),
    });
    expect(data.votes.totalFor).toBe(10);
  });

  it("returns myVote: null for anonymous visitors", async () => {
    hoisted.getSessionAddress.mockResolvedValue(null);

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as { myVote: unknown }).myVote).toBeNull();
  });

  it("does not leak another voter's ballot into a different session", async () => {
    hoisted.getSessionAddress.mockResolvedValue(ADDR_WHALE);

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as { myVote: unknown }).myVote).toBeNull();
  });
});
