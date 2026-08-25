import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, buildRequest, resultSet } from "@/__tests__/helpers/mocks";

const hoisted = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  lookupHolder: vi.fn(),
  dbExecute: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: hoisted.requireAuth,
  UnauthorizedError: class UnauthorizedError extends Error {
    code = "UNAUTHORIZED";
    statusCode = 401;
  },
}));
vi.mock("@/lib/snapshot", () => ({ lookupHolder: hoisted.lookupHolder }));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.dbExecute } }));

function electionRow(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - 60_000).toISOString();
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return {
    election_key: "foundational-2026",
    title: "Foundational Governance Election",
    voting_starts_at: start,
    voting_ends_at: end,
    eligible_wallet_count: 25_686,
    ...overrides,
  };
}

function req(body?: unknown) {
  return buildRequest({
    url: "http://localhost/api/v1/governance-vote",
    method: body === undefined ? "GET" : "POST",
    ...(body !== undefined ? { body } : {}),
  }) as unknown as Parameters<typeof import("@/app/api/v1/governance-vote/route").GET>[0];
}

async function get() {
  const { GET } = await import("@/app/api/v1/governance-vote/route");
  const res = (await GET(req() as never)) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/v1/governance-vote/route");
  const res = (await POST(req(body) as never)) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.resetModules();
  hoisted.requireAuth.mockReset().mockResolvedValue({ sub: ADDR_DOLPHIN, votingPower: 100 });
  hoisted.lookupHolder.mockReset().mockResolvedValue({ address: ADDR_DOLPHIN });
  hoisted.dbExecute.mockReset().mockImplementation((stmt: { sql: string }) => {
    const sql = stmt.sql;
    if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
    if (sql.includes("GROUP BY choice")) return Promise.resolve(resultSet([{ choice: "QUADRATIC", cnt: 3 }]));
    if (sql.startsWith("INSERT INTO governance_election_ballots")) return Promise.resolve(resultSet([]));
    if (sql.includes("WHERE election_key = ? AND voter_address = ?")) return Promise.resolve(resultSet([{ choice: "QUADRATIC" }]));
    return Promise.resolve(resultSet([]));
  });
});

describe("GET /api/v1/governance-vote", () => {
  it("returns election status, turnout, and results", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    const data = body.data as Record<string, unknown>;
    expect(data.phase).toBe("OPEN");
    expect(data.eligibleWalletCount).toBe(25_686);
    expect(data.totalBallots).toBe(3);
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("returns 404 when the election is not configured", async () => {
    hoisted.dbExecute.mockResolvedValue(resultSet([]));
    const { status } = await get();
    expect(status).toBe(404);
  });
});

describe("POST /api/v1/governance-vote", () => {
  it("casts one ballot for an eligible wallet", async () => {
    const { status, body } = await post({ choice: "QUADRATIC" });
    expect(status).toBe(200);
    const data = body.data as Record<string, unknown>;
    expect(data.userChoice).toBe("QUADRATIC");
  });

  it("rejects an invalid choice", async () => {
    const { status } = await post({ choice: "INVALID" });
    expect(status).toBe(400);
  });

  it("rejects a wallet outside the snapshot", async () => {
    hoisted.lookupHolder.mockResolvedValue(null);
    const { status, body } = await post({ choice: "LINEAR" });
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe("NOT_IN_SNAPSHOT");
  });

  it("updates an existing ballot while voting is open", async () => {
    hoisted.dbExecute.mockImplementation((stmt: { sql: string }) => {
      const sql = stmt.sql;
      if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
      if (sql.includes("GROUP BY choice")) return Promise.resolve(resultSet([{ choice: "ONE_WALLET_ONE_VOTE", cnt: 1 }]));
      if (sql.includes("WHERE election_key = ? AND voter_address = ?")) return Promise.resolve(resultSet([{ choice: "ONE_WALLET_ONE_VOTE" }]));
      if (sql.startsWith("UPDATE governance_election_ballots")) return Promise.resolve(resultSet([]));
      if (sql.startsWith("INSERT INTO governance_election_ballot_events")) return Promise.resolve(resultSet([]));
      return Promise.resolve(resultSet([]));
    });
    const { status, body } = await post({ choice: "ONE_WALLET_ONE_VOTE" });
    expect(status).toBe(200);
    expect((body.data as Record<string, unknown>).userChoice).toBe("ONE_WALLET_ONE_VOTE");
  });

  it("records a ballot event for audit purposes", async () => {
    await post({ choice: "TIERED" });
    const eventInsert = hoisted.dbExecute.mock.calls.find(([stmt]) =>
      (stmt as { sql: string }).sql.startsWith("INSERT INTO governance_election_ballot_events"),
    );
    expect(eventInsert).toBeTruthy();
  });

  it("rejects ballots outside the election window", async () => {
    hoisted.dbExecute.mockImplementation((stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM governance_election WHERE")) {
        return Promise.resolve(resultSet([
          electionRow({
            voting_starts_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            voting_ends_at: new Date(Date.now() - 1000).toISOString(),
          }),
        ]));
      }
      if (stmt.sql.includes("GROUP BY choice")) return Promise.resolve(resultSet([]));
      return Promise.resolve(resultSet([]));
    });
    const { status, body } = await post({ choice: "TIERED" });
    expect(status).toBe(409);
    expect((body.error as Record<string, unknown>).code).toBe("VOTING_CLOSED");
  });
});
