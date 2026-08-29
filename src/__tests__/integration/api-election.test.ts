import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, buildRequest, resultSet } from "@/__tests__/helpers/mocks";

const hoisted = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  lookupHolder: vi.fn(),
  lookupHolderClasses: vi.fn(),
  dbExecute: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: hoisted.requireAuth,
  UnauthorizedError: class UnauthorizedError extends Error {
    code = "UNAUTHORIZED";
    statusCode = 401;
  },
}));
vi.mock("@/lib/snapshot", () => ({
  lookupHolder: hoisted.lookupHolder,
  lookupHolderClasses: hoisted.lookupHolderClasses,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.dbExecute } }));

// Test-only mock wallets — class is the HolderClass enum value the route
// receives from `lookupHolderClasses`. These keep the holder-class tally
// test self-contained without depending on the real holders.json artifact.
const KRAKEN_ADDR = "0x000000000000000000000000000000000000a001";
const WHALE_ADDR = "0x000000000000000000000000000000000000a002";
const DOLPHIN_ADDR = "0x000000000000000000000000000000000000a003";
const SHARK_ADDR = "0x000000000000000000000000000000000000a004";

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
  hoisted.lookupHolderClasses.mockReset().mockResolvedValue(new Map());
  hoisted.dbExecute.mockReset().mockImplementation((stmt: { sql: string }) => {
    const sql = stmt.sql;
    if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
    if (sql.includes("GROUP BY choice")) return Promise.resolve(resultSet([{ choice: "QUADRATIC", cnt: 3 }]));
    if (sql.startsWith("SELECT voter_address")) {
      // Mirrors the new `tallyByHolderClass()` query. Empty by default —
      // individual tests override to inject ballots and matching class lookups.
      return Promise.resolve(resultSet([]));
    }
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

  describe("ballotsByHolderClass field", () => {
    it("returns 7 entries (one per canonical class) when no ballots exist", async () => {
      const { status, body } = await get();
      expect(status).toBe(200);
      const data = body.data as Record<string, unknown>;
      const rows = data.ballotsByHolderClass as Array<{ holderClass: string }>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(7);
      // Order: KRAKEN → SEAHORSE (descending rank).
      expect(rows.map((r) => r.holderClass)).toEqual([
        "KRAKEN",
        "WHALE",
        "DOLPHIN",
        "SHARK",
        "OCTOPUS",
        "CRAB",
        "SEAHORSE",
      ]);
      // FISH legacy alias is never surfaced.
      expect(rows.find((r) => r.holderClass === "FISH")).toBeUndefined();
    });

    it("returns eligible counts from SNAPSHOT.expectedDistribution", async () => {
      const { body } = await get();
      const data = body.data as { ballotsByHolderClass: Array<{ holderClass: string; eligibleCount: number }> };
      const rows = data.ballotsByHolderClass;
      const byClass = Object.fromEntries(rows.map((r) => [r.holderClass, r.eligibleCount]));
      expect(byClass.KRAKEN).toBe(1);
      expect(byClass.WHALE).toBe(3);
      expect(byClass.DOLPHIN).toBe(30);
      expect(byClass.SHARK).toBe(326);
      expect(byClass.OCTOPUS).toBe(1078);
      expect(byClass.CRAB).toBe(1701);
      expect(byClass.SEAHORSE).toBe(22547);
    });

    it("buckets ballots by holder class and choice correctly", async () => {
      hoisted.dbExecute.mockReset().mockImplementation((stmt: { sql: string }) => {
        const sql = stmt.sql;
        if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
        if (sql.includes("GROUP BY choice")) {
          // 1 KRAKEN-QUADRATIC + 1 WHALE-1W1V + 2 DOLPHIN (1 QUADRATIC + 1 TIERED) = 4 total
          return Promise.resolve(resultSet([
            { choice: "QUADRATIC", cnt: 2 },
            { choice: "ONE_WALLET_ONE_VOTE", cnt: 1 },
            { choice: "TIERED", cnt: 1 },
          ]));
        }
        if (sql.startsWith("SELECT voter_address")) {
          const DOLPHIN_2 = "0x000000000000000000000000000000000000a005";
          return Promise.resolve(resultSet([
            { voter_address: KRAKEN_ADDR, choice: "QUADRATIC" },
            { voter_address: WHALE_ADDR, choice: "ONE_WALLET_ONE_VOTE" },
            { voter_address: DOLPHIN_ADDR, choice: "QUADRATIC" },
            { voter_address: DOLPHIN_2, choice: "TIERED" },
          ]));
        }
        return Promise.resolve(resultSet([]));
      });
      hoisted.lookupHolderClasses.mockReset().mockImplementation(
        async (addresses: string[]) =>
          new Map(
            addresses.map((addr) => {
              const lower = addr.toLowerCase();
              if (lower === KRAKEN_ADDR.toLowerCase()) return [lower, "KRAKEN"];
              if (lower === WHALE_ADDR.toLowerCase()) return [lower, "WHALE"];
              if (lower === DOLPHIN_ADDR.toLowerCase()) return [lower, "DOLPHIN"];
              if (lower === SHARK_ADDR.toLowerCase()) return [lower, "SHARK"];
              // DOLPHIN_2 (0x...a005) — also a DOLPHIN for this test.
              if (lower.endsWith("a005")) return [lower, "DOLPHIN"];
              return [lower, null];
            }),
          ),
      );

      const { body } = await get();
      const data = body.data as {
        ballotsByHolderClass: Array<{
          holderClass: string;
          count: number;
          turnoutPercentage: number;
          byChoice: Array<{ choice: string; count: number; percentage: number }>;
        }>;
      };
      const rows = data.ballotsByHolderClass;
      const byName = Object.fromEntries(rows.map((r) => [r.holderClass, r]));

      expect(byName.KRAKEN?.count).toBe(1);
      expect(byName.KRAKEN?.turnoutPercentage).toBe(100); // 1 of 1
      expect(byName.KRAKEN?.byChoice.find((c) => c.choice === "QUADRATIC")?.count).toBe(1);
      expect(byName.KRAKEN?.byChoice.find((c) => c.choice === "QUADRATIC")?.percentage).toBe(100);

      expect(byName.WHALE?.count).toBe(1);
      expect(byName.WHALE?.turnoutPercentage).toBeCloseTo(33.333, 1);
      expect(byName.WHALE?.byChoice.find((c) => c.choice === "ONE_WALLET_ONE_VOTE")?.count).toBe(1);

      expect(byName.DOLPHIN?.count).toBe(2);
      expect(byName.DOLPHIN?.turnoutPercentage).toBeCloseTo(6.667, 1);
      expect(byName.DOLPHIN?.byChoice.find((c) => c.choice === "QUADRATIC")?.count).toBe(1);
      expect(byName.DOLPHIN?.byChoice.find((c) => c.choice === "TIERED")?.count).toBe(1);

      // Other classes are zero.
      expect(byName.SHARK?.count).toBe(0);
      expect(byName.OCTOPUS?.count).toBe(0);
      expect(byName.CRAB?.count).toBe(0);
      expect(byName.SEAHORSE?.count).toBe(0);
    });

    it("buckets addresses not in the snapshot into SEAHORSE", async () => {
      const ORPHAN = "0x000000000000000000000000000000000000beef";
      hoisted.dbExecute.mockReset().mockImplementation((stmt: { sql: string }) => {
        const sql = stmt.sql;
        if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
        if (sql.includes("GROUP BY choice")) return Promise.resolve(resultSet([{ choice: "LINEAR", cnt: 1 }]));
        if (sql.startsWith("SELECT voter_address")) {
          return Promise.resolve(resultSet([{ voter_address: ORPHAN, choice: "LINEAR" }]));
        }
        return Promise.resolve(resultSet([]));
      });
      hoisted.lookupHolderClasses.mockReset().mockResolvedValue(new Map([[ORPHAN, null]]));

      const { body } = await get();
      const data = body.data as { ballotsByHolderClass: Array<{ holderClass: string; count: number }> };
      const seahorse = data.ballotsByHolderClass.find((r) => r.holderClass === "SEAHORSE")!;
      expect(seahorse.count).toBe(1);
    });

    it("preserves the existing `results` per-choice tally (regression)", async () => {
      hoisted.dbExecute.mockReset().mockImplementation((stmt: { sql: string }) => {
        const sql = stmt.sql;
        if (sql.includes("FROM governance_election WHERE")) return Promise.resolve(resultSet([electionRow()]));
        if (sql.includes("GROUP BY choice")) {
          return Promise.resolve(resultSet([
            { choice: "QUADRATIC", cnt: 2 },
            { choice: "ONE_WALLET_ONE_VOTE", cnt: 1 },
          ]));
        }
        if (sql.startsWith("SELECT voter_address")) {
          return Promise.resolve(resultSet([
            { voter_address: KRAKEN_ADDR, choice: "QUADRATIC" },
            { voter_address: WHALE_ADDR, choice: "QUADRATIC" },
            { voter_address: DOLPHIN_ADDR, choice: "ONE_WALLET_ONE_VOTE" },
          ]));
        }
        return Promise.resolve(resultSet([]));
      });
      hoisted.lookupHolderClasses.mockReset().mockResolvedValue(
        new Map([
          [KRAKEN_ADDR, "KRAKEN"],
          [WHALE_ADDR, "WHALE"],
          [DOLPHIN_ADDR, "DOLPHIN"],
        ]),
      );

      const { body } = await get();
      const data = body.data as Record<string, unknown>;
      const results = data.results as Array<{ choice: string; count: number; percentage: number }>;
      expect(results).toHaveLength(4);
      expect(results.find((r) => r.choice === "QUADRATIC")?.count).toBe(2);
      expect(results.find((r) => r.choice === "ONE_WALLET_ONE_VOTE")?.count).toBe(1);
      expect(data.totalBallots).toBe(3);
    });
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
