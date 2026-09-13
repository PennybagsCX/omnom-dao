import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * finalizeProposal — quorum semantics under quadratic voting (v2).
 *
 * Pins THE critical denominator decision: quorum is measured against TOTAL
 * QUADRATIC POWER (Σ√balance), not raw token supply. Under sqrt-compressed
 * vote power a supply denominator would make any realistic quorum
 * unreachable — this suite fails if that regression ever lands.
 */
const hoisted = vi.hoisted(() => ({
  execute: vi.fn(),
  getProposalById: vi.fn(),
  notifyVoteResult: vi.fn(),
  totalQuadraticPower: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
vi.mock("@/lib/proposal-service", () => ({ getProposalById: hoisted.getProposalById }));
vi.mock("@/lib/notifications", () => ({ notifyVoteResult: hoisted.notifyVoteResult }));
vi.mock("@/lib/voting-power", () => ({
  totalQuadraticPower: hoisted.totalQuadraticPower,
}));

function activeProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "prop-f1",
    title: "Quorum semantics",
    type: "GENERAL",
    status: "ACTIVE",
    authorAddress: "0xabc",
    createdAt: "2026-06-01T00:00:00.000Z",
    votingStartsAt: "2026-06-01T00:00:00.000Z",
    votingEndsAt: new Date(Date.now() - 60_000).toISOString(), // window closed
    quorumRequired: 10,
    quorumAchieved: null,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    metadata: {},
    ...overrides,
  };
}

function stubTallies(forP: number, againstP: number, abstainP: number) {
  const rows: { choice: string; total: number }[] = [];
  if (forP) rows.push({ choice: "FOR", total: forP });
  if (againstP) rows.push({ choice: "AGAINST", total: againstP });
  if (abstainP) rows.push({ choice: "ABSTAIN", total: abstainP });
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    if (stmt.sql.includes("FROM votes WHERE proposal_id")) {
      return { rows, columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.startsWith("UPDATE proposals")) {
      return { rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
    }
    return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.notifyVoteResult.mockResolvedValue(undefined);
});

describe("finalizeProposal — quadratic quorum denominator", () => {
  it("measures quorum against TOTAL QUADRATIC POWER, not token supply", async () => {
    // Voted power 250 of total quadratic power 1000 → 25% ≥ 10% quorum.
    // (Against token supply ~1e12 this would be ~0% — the regression this
    // test exists to catch.)
    hoisted.getProposalById.mockResolvedValue(activeProposal());
    hoisted.totalQuadraticPower.mockResolvedValue(1000);
    stubTallies(200, 0, 50);

    const { finalizeProposal } = await import("@/lib/proposal-finalize");
    const result = await finalizeProposal("prop-f1");

    expect(result).not.toBeNull();
    expect(result!.quorumAchieved).toBe(25);
    expect(result!.newStatus).toBe("PASSED"); // quorum met + FOR majority

    const update = hoisted.execute.mock.calls.find((c) =>
      (c[0] as { sql: string }).sql.startsWith("UPDATE proposals"),
    ) as unknown as [{ sql: string; args: unknown[] }];
    expect(update).toBeDefined();
    expect(update![0].args[1]).toBe(25); // quorum_achieved persisted
  });

  it("expires the proposal when voted power misses the quadratic quorum", async () => {
    hoisted.getProposalById.mockResolvedValue(activeProposal());
    hoisted.totalQuadraticPower.mockResolvedValue(1000);
    stubTallies(50, 0, 0); // 5% of total quadratic power < 10%

    const { finalizeProposal } = await import("@/lib/proposal-finalize");
    const result = await finalizeProposal("prop-f1");

    expect(result!.newStatus).toBe("EXPIRED");
    expect(result!.quorumAchieved).toBe(5);
  });

  it("treats a total-power failure as 0% quorum (fail-closed)", async () => {
    hoisted.getProposalById.mockResolvedValue(activeProposal());
    hoisted.totalQuadraticPower.mockRejectedValue(new Error("snapshot io"));
    stubTallies(999, 0, 0);

    const { finalizeProposal } = await import("@/lib/proposal-finalize");
    const result = await finalizeProposal("prop-f1");

    expect(result!.quorumAchieved).toBe(0);
    expect(result!.newStatus).toBe("EXPIRED");
  });
});
