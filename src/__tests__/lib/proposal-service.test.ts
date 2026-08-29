import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { execute: executeMock },
}));

import {
  getProposalById,
  listProposals,
  rowToProposal,
} from "@/lib/proposal-service";
import { ProposalStatus } from "@/types";

const proposalRow = {
  id: "p-1",
  title: "Treasury grant",
  description: "Fund the audit",
  type: "TREASURY",
  status: ProposalStatus.ACTIVE,
  author_address: "0xauthor",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  voting_starts_at: "2026-08-03T00:00:00.000Z",
  voting_ends_at: "2026-08-10T00:00:00.000Z",
  quorum_required: 5,
  quorum_achieved: 2.5,
  votes_for: 100,
  votes_against: 40,
  votes_abstain: 10,
  metadata: JSON.stringify({ type: "base", links: ["https://x.test"], tags: ["a"] }),
};

function result(rows: Record<string, unknown>[]) {
  return { rows, columns: Object.keys(rows[0] ?? {}), rowsAffected: 0 };
}

describe("proposal-service", () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  describe("rowToProposal", () => {
    it("maps snake_case columns to the Proposal shape", () => {
      const proposal = rowToProposal(proposalRow);
      expect(proposal).toEqual({
        id: "p-1",
        title: "Treasury grant",
        description: "Fund the audit",
        type: "TREASURY",
        status: ProposalStatus.ACTIVE,
        authorAddress: "0xauthor",
        createdAt: "2026-08-01T00:00:00.000Z",
        votingStartsAt: "2026-08-03T00:00:00.000Z",
        votingEndsAt: "2026-08-10T00:00:00.000Z",
        quorumRequired: 5,
        quorumAchieved: 2.5,
        votesFor: 100,
        votesAgainst: 40,
        votesAbstain: 10,
        metadata: { type: "base", links: ["https://x.test"], tags: ["a"] },
        // Emoji fields default to zero counts + null reaction at the row-only
        // mapping layer; callers that need hydrated reactions overwrite these.
        emojiReactionCounts: {
          thumbs_up: 0,
          heart: 0,
          tada: 0,
          smile: 0,
          open_mouth: 0,
          cry: 0,
          thinking: 0,
          thumbs_down: 0,
        },
        myEmojiReaction: null,
      });
    });

    it("defaults metadata when the column is null", () => {
      const proposal = rowToProposal({ ...proposalRow, metadata: null as unknown as string });
      expect(proposal.metadata).toEqual({ type: "base", links: [], tags: [] });
    });

    it("defaults metadata when the JSON is invalid", () => {
      const proposal = rowToProposal({ ...proposalRow, metadata: "{not json" });
      expect(proposal.metadata).toEqual({ type: "base", links: [], tags: [] });
    });

    it("defaults metadata when the JSON is not an object", () => {
      const proposal = rowToProposal({ ...proposalRow, metadata: '"just a string"' });
      expect(proposal.metadata).toEqual({ type: "base", links: [], tags: [] });
    });

    it("preserves null voting/updated timestamps", () => {
      const proposal = rowToProposal({
        ...proposalRow,
        updated_at: null,
        voting_starts_at: null,
        voting_ends_at: null,
        quorum_achieved: null,
      });
      expect(proposal.votingStartsAt).toBeNull();
      expect(proposal.votingEndsAt).toBeNull();
      expect(proposal.quorumAchieved).toBeNull();
    });
  });

  describe("getProposalById", () => {
    it("returns the proposal when found", async () => {
      executeMock.mockResolvedValueOnce(result([proposalRow]));
      const proposal = await getProposalById("p-1");
      expect(proposal?.id).toBe("p-1");
      const call = executeMock.mock.calls[0]![0] as { sql: string; args: string[] };
      expect(call.sql).toContain("FROM proposals WHERE id = ?");
      expect(call.args).toEqual(["p-1"]);
    });

    it("returns null when no rows match", async () => {
      executeMock.mockResolvedValueOnce(result([]));
      expect(await getProposalById("missing")).toBeNull();
    });
  });

  describe("listProposals", () => {
    it("runs a count query then the filtered, ordered, paginated query", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 1 }]))
        .mockResolvedValueOnce(result([proposalRow]));

      const page = await listProposals({
        status: ProposalStatus.ACTIVE,
        type: "TREASURY",
        sortBy: "votesFor",
        sortOrder: "asc",
        limit: 10,
        offset: 20,
      });

      expect(page.total).toBe(1);
      expect(page.proposals).toHaveLength(1);
      expect(page.proposals[0]!.id).toBe("p-1");

      const count = executeMock.mock.calls[0]![0] as { sql: string; args: string[] };
      expect(count.sql).toContain("COUNT(*)");
      expect(count.sql).toContain("status = ?");
      expect(count.sql).toContain("type = ?");
      expect(count.args).toEqual(["ACTIVE", "TREASURY"]);

      const list = executeMock.mock.calls[1]![0] as { sql: string; args: string[] };
      expect(list.sql).toContain("ORDER BY votes_for ASC");
      expect(list.sql).toContain("LIMIT ? OFFSET ?");
      expect(list.args).toEqual(["ACTIVE", "TREASURY", 10, 20]);
    });

    it("defaults to created_at DESC with no filters", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 0 }]))
        .mockResolvedValueOnce(result([]));

      await listProposals({ limit: 5, offset: 0 });

      const list = executeMock.mock.calls[1]![0] as { sql: string; args: number[] };
      expect(list.sql).toContain("ORDER BY created_at DESC");
      expect(list.sql).not.toContain("WHERE");
      expect(list.args).toEqual([5, 0]);
    });

    it("supports votingEndsAt sort and status-only filtering", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 2 }]))
        .mockResolvedValueOnce(result([proposalRow, { ...proposalRow, id: "p-2" }]));

      const page = await listProposals({
        status: ProposalStatus.ACTIVE,
        sortBy: "votingEndsAt",
        limit: 50,
        offset: 0,
      });

      expect(page.total).toBe(2);
      expect(page.proposals.map((p) => p.id)).toEqual(["p-1", "p-2"]);
      const list = executeMock.mock.calls[1]![0] as { sql: string; args: (string | number)[] };
      expect(list.sql).toContain("ORDER BY voting_ends_at DESC");
      expect(list.args).toEqual(["ACTIVE", 50, 0]);
    });

    it("falls back to created_at for an unknown sort key", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 0 }]))
        .mockResolvedValueOnce(result([]));

      await listProposals({
        sortBy: "nope" as "createdAt",
        limit: 1,
        offset: 0,
      });

      const list = executeMock.mock.calls[1]![0] as { sql: string };
      expect(list.sql).toContain("ORDER BY created_at DESC");
    });

    it("reports total 0 when the count row is missing", async () => {
      executeMock.mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([]));
      const page = await listProposals({ limit: 1, offset: 0 });
      expect(page.total).toBe(0);
      expect(page.proposals).toEqual([]);
    });
  });
});
