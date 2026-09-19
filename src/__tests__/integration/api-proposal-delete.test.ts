import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for the admin proposal-delete route. A FAILED proposal
 * (rejected or quorum-failed) must be hard-deleted together with its child
 * rows — comments (and their reactions), votes, proposal emoji reactions —
 * with notifications detached and the action recorded in the public audit
 * log. Only admins may delete, and only FAILED proposals.
 */

const hoisted = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    code = "UNAUTHORIZED" as const;
    statusCode = 401;
  }
  return {
    UnauthorizedError,
    requireAuth: vi.fn(),
    execute: vi.fn(),
    getProposalById: vi.fn(),
    isAdminAddress: vi.fn(),
    recordAuditEvent: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: hoisted.UnauthorizedError,
  requireAuth: hoisted.requireAuth,
}));
vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
vi.mock("@/lib/proposal-service", () => ({ getProposalById: hoisted.getProposalById }));
vi.mock("@/lib/constants", () => ({
  isAdminAddress: hoisted.isAdminAddress,
  ERROR_CODE_MAP: {
    UNAUTHORIZED: { status: 401, message: "Unauthorized" },
    VALIDATION_ERROR: { status: 400, message: "Validation error" },
    NOT_VERIFIED: { status: 403, message: "Not verified" },
    PROPOSAL_NOT_FOUND: { status: 404, message: "Not found" },
    VOTING_CLOSED: { status: 409, message: "Voting closed" },
    INTERNAL_ERROR: { status: 500, message: "Internal error" },
  },
}));
vi.mock("@/lib/audit-log", () => ({ recordAuditEvent: hoisted.recordAuditEvent }));

const ADMIN = "0xaaaa000000000000000000000000000000000001";
const PROPOSAL_ID = "prop-del";

function makeFailedProposal() {
  return {
    id: PROPOSAL_ID,
    title: "Delete me",
    description: "A description that is long enough.",
    type: "GENERAL",
    status: "FAILED",
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-06-01T00:00:00.000Z",
    votingStartsAt: null,
    votingEndsAt: null,
    quorumRequired: 10,
    quorumAchieved: null,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    metadata: { type: "base", links: [], tags: [], rejectionReason: "Test data" },
  };
}

async function deleteProposal() {
  const { DELETE } = await import("@/app/api/v1/proposals/[id]/delete/route");
  const req = {
    method: "DELETE",
    url: `http://localhost/api/v1/proposals/${PROPOSAL_ID}/delete`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}/delete`),
    headers: new Headers(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof DELETE>[0];
  const res = (await DELETE(req, {
    params: Promise.resolve({ id: PROPOSAL_ID }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** SQL text of every executed statement, in order. */
function executedSqls(): string[] {
  return hoisted.execute.mock.calls.map((c) => (c[0] as { sql: string }).sql);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue({ sub: ADMIN });
  hoisted.isAdminAddress.mockReturnValue(true);
  hoisted.recordAuditEvent.mockResolvedValue(undefined);
  hoisted.getProposalById.mockReset();
  hoisted.execute.mockReset();
  // Default: no comment rows, every mutation affects 1 row.
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n });
});

describe("DELETE /api/v1/proposals/[id]/delete — happy path", () => {
  it("hard-deletes a FAILED proposal, children first, proposal row last", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeFailedProposal());
    const { status, body } = await deleteProposal();

    expect(status).toBe(200);
    expect(body.data).toEqual({ deleted: true, id: PROPOSAL_ID });

    const sqls = executedSqls();
    expect(sqls).toEqual([
      "SELECT id FROM comments WHERE proposal_id = ?",
      "DELETE FROM comments WHERE proposal_id = ?",
      "DELETE FROM votes WHERE proposal_id = ?",
      "DELETE FROM proposal_emoji_reactions WHERE proposal_id = ?",
      "UPDATE notifications SET proposal_id = NULL WHERE proposal_id = ?",
      "DELETE FROM proposals WHERE id = ? AND status = ?",
    ]);
    // The final DELETE is status-guarded with FAILED.
    const finalCall = hoisted.execute.mock.calls.at(-1) as [{ args: string[] }];
    expect(finalCall[0].args).toEqual([PROPOSAL_ID, "FAILED"]);
  });

  it("detaches notifications and records the audit event with rejection context", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeFailedProposal());
    await deleteProposal();

    expect(hoisted.recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(hoisted.recordAuditEvent).toHaveBeenCalledWith(
      ADMIN,
      "PROPOSAL_DELETED",
      "proposal",
      PROPOSAL_ID,
      { title: "Delete me", status: "FAILED", rejectionReason: "Test data" },
    );
  });

  it("deletes comment reactions by explicit comment ids before the comments themselves", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeFailedProposal());
    hoisted.execute.mockResolvedValueOnce({
      rows: [{ id: "c-1" }, { id: "c-2" }],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });
    await deleteProposal();

    const calls = hoisted.execute.mock.calls as Array<[{ sql: string; args: string[] }]>;
    const sqls = calls.map((c) => c[0].sql);
    const reactionsIdx = sqls.indexOf("DELETE FROM comment_reactions WHERE comment_id IN (?, ?)");
    const emojiIdx = sqls.indexOf("DELETE FROM comment_emoji_reactions WHERE comment_id IN (?, ?)");
    const commentsIdx = sqls.indexOf("DELETE FROM comments WHERE proposal_id = ?");

    expect(reactionsIdx).toBeGreaterThan(-1);
    expect(emojiIdx).toBeGreaterThan(-1);
    expect(reactionsIdx).toBeLessThan(commentsIdx);
    expect(emojiIdx).toBeLessThan(commentsIdx);
    expect(calls[reactionsIdx]?.[0].args).toEqual(["c-1", "c-2"]);
    expect(calls[emojiIdx]?.[0].args).toEqual(["c-1", "c-2"]);
  });

  it("skips the comment-reaction deletes entirely when there are no comments", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeFailedProposal());
    await deleteProposal();

    const withReactions = executedSqls().filter((s) =>
      s.includes("comment_reactions") || s.includes("comment_emoji_reactions"),
    );
    expect(withReactions).toEqual([]);
  });
});

describe("DELETE /api/v1/proposals/[id]/delete — guards", () => {
  it("rejects non-admins without touching the database", async () => {
    hoisted.requireAuth.mockResolvedValue({ sub: ADDR_WHALE });
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status, body } = await deleteProposal();

    expect(status).toBe(403);
    expect((body.error as { code: string }).code).toBe("NOT_VERIFIED");
    expect(hoisted.execute).not.toHaveBeenCalled();
    expect(hoisted.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is missing or invalid", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError("No session"));
    const { status, body } = await deleteProposal();

    expect(status).toBe(401);
    expect((body.error as { code: string }).code).toBe("UNAUTHORIZED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown proposal", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(null);
    const { status, body } = await deleteProposal();

    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it.each(["EXPIRED", "PASSED", "ACTIVE", "PENDING_REVIEW", "DRAFT"])(
    "refuses to delete a %s proposal",
    async (statusValue) => {
      hoisted.getProposalById.mockResolvedValueOnce({
        ...makeFailedProposal(),
        status: statusValue,
      });
      const { status, body } = await deleteProposal();

      expect(status).toBe(409);
      expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
      expect(hoisted.execute).not.toHaveBeenCalled();
      expect(hoisted.recordAuditEvent).not.toHaveBeenCalled();
    },
  );

  it("returns 409 without auditing when the guarded DELETE affects 0 rows", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeFailedProposal());
    hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 0, lastInsertRowid: 0n });
    const { status, body } = await deleteProposal();

    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(hoisted.recordAuditEvent).not.toHaveBeenCalled();
  });
});
