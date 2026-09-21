import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalStatus } from "@/types";

/**
 * Visibility rules for the public proposals list (proposal-service.ts):
 * DRAFT and PENDING_REVIEW proposals are never served publicly — filters
 * targeting them return an empty page and the unfiltered list excludes them.
 * Admin surfaces (review queue) use authed endpoints with their own queries
 * and are unaffected.
 */

const hoisted = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    title: "A public proposal",
    description: "Description",
    type: "GENERAL",
    status: "ACTIVE",
    author_address: "0xaaa0000000000000000000000000000000000001",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: null,
    voting_starts_at: "2026-06-01T00:00:00.000Z",
    voting_ends_at: "2026-06-08T00:00:00.000Z",
    quorum_required: 10,
    quorum_achieved: null,
    votes_for: 0,
    votes_against: 0,
    votes_abstain: 0,
    metadata: JSON.stringify({ type: "base", links: [], tags: [] }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
    if (stmt.sql.startsWith("SELECT COUNT")) {
      return { rows: [{ cnt: 1 }], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    }
    if (stmt.sql.includes("FROM proposals")) {
      return {
        rows: [proposalRow()],
        columns: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      };
    }
    // attachHolderClasses and any aux query — no matches.
    return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
  });
});

describe("listProposals — non-public statuses", () => {
  it("returns an empty page for status=DRAFT without touching the database", async () => {
    const { listProposals } = await import("@/lib/proposal-service");
    const result = await listProposals({ status: ProposalStatus.DRAFT, limit: 20, offset: 0 });
    expect(result).toEqual({ proposals: [], total: 0 });
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("returns an empty page for status=PENDING_REVIEW without touching the database", async () => {
    const { listProposals } = await import("@/lib/proposal-service");
    const result = await listProposals({ status: ProposalStatus.PENDING_REVIEW, limit: 20, offset: 0 });
    expect(result).toEqual({ proposals: [], total: 0 });
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("excludes drafts and pending-review items from the unfiltered list", async () => {
    const { listProposals } = await import("@/lib/proposal-service");
    const result = await listProposals({ limit: 20, offset: 0 });
    expect(result.proposals).toHaveLength(1);
    // The NOT IN clause protects both COUNT and SELECT queries.
    const queries = hoisted.execute.mock.calls.map((c) => (c[0] as { sql: string }).sql);
    expect(queries.filter((sql) => sql.includes("NOT IN"))).toHaveLength(2);
    // COUNT carries just the exclusion args; the SELECT appends limit/offset.
    const countStmt = hoisted.execute.mock.calls.find(
      (c) => (c[0] as { sql: string }).sql.startsWith("SELECT COUNT"),
    )![0] as { args: unknown[] };
    expect(countStmt.args).toEqual(["DRAFT", "PENDING_REVIEW"]);
    const listStmt = hoisted.execute.mock.calls.find(
      (c) => (c[0] as { sql: string }).sql.includes("LIMIT"),
    )![0] as { args: unknown[] };
    expect(listStmt.args).toEqual(["DRAFT", "PENDING_REVIEW", 20, 0]);
  });

  it("keeps explicit public status filters working (no NOT IN clause)", async () => {
    const { listProposals } = await import("@/lib/proposal-service");
    await listProposals({ status: ProposalStatus.ACTIVE, limit: 20, offset: 0 });
    const queries = hoisted.execute.mock.calls.map((c) => (c[0] as { sql: string }).sql);
    expect(queries.every((sql) => !sql.includes("NOT IN"))).toBe(true);
    const listStmt = hoisted.execute.mock.calls.find(
      (c) => (c[0] as { sql: string }).sql.includes("LIMIT"),
    )![0] as { args: unknown[] };
    expect(listStmt.args).toContain(ProposalStatus.ACTIVE);
  });

  it("still serves every finalized status on /results (listFinalizedProposals untouched)", async () => {
    const { listFinalizedProposals } = await import("@/lib/proposal-service");
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM proposals")) {
        return {
          rows: [
            proposalRow({ id: "p2", status: "EXECUTED" }),
            proposalRow({ id: "p3", status: "FAILED" }),
          ],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });
    const finalized = await listFinalizedProposals();
    expect(finalized.map((p) => p.status)).toEqual(["EXECUTED", "FAILED"]);
    const stmt = hoisted.execute.mock.calls.find(
      (c) => (c[0] as { sql: string }).sql.includes("FROM proposals"),
    )![0] as { args: unknown[] };
    expect(stmt.args).toEqual([
      ProposalStatus.PASSED,
      ProposalStatus.FAILED,
      ProposalStatus.EXPIRED,
      ProposalStatus.EXECUTED,
    ]);
  });
});
