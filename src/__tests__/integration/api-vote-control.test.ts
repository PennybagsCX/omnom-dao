import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for the admin live-vote control route
 * (POST /api/v1/proposals/[id]/vote-control — pause / resume / stop).
 *
 * Pause writes `metadata.pausedAt` (no schema migration); resume shifts the
 * voting end forward by the paused duration and clears the marker; stop closes
 * now, LIFTS any pause (the finalizer skips paused proposals — leaving the
 * marker set would strand a stopped vote ACTIVE forever), and runs the
 * standard finalizer. Every action is admin-gated and audited.
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
    finalizeProposal: vi.fn(),
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
    MISSING_FIELDS: { status: 400, message: "Missing fields" },
    NOT_VERIFIED: { status: 403, message: "Not verified" },
    PROPOSAL_NOT_FOUND: { status: 404, message: "Not found" },
    VOTING_CLOSED: { status: 409, message: "Voting closed" },
    VOTING_PAUSED: { status: 409, message: "Voting paused" },
    INTERNAL_ERROR: { status: 500, message: "Internal error" },
  },
}));
vi.mock("@/lib/audit-log", () => ({ recordAuditEvent: hoisted.recordAuditEvent }));
vi.mock("@/lib/proposal-finalize", () => ({ finalizeProposal: hoisted.finalizeProposal }));

const ADMIN = "0xaaaa000000000000000000000000000000000001";
const PROPOSAL_ID = "prop-ctrl";

function activeProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    title: "Live vote",
    description: "A description.",
    type: "GENERAL",
    status: "ACTIVE",
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-09-20T00:00:00.000Z",
    votingStartsAt: "2026-09-22T12:00:00.000Z",
    votingEndsAt: "2026-09-29T12:00:00.000Z",
    quorumRequired: 5,
    quorumAchieved: null,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    metadata: { type: "base", links: [], tags: [] },
    pausedAt: null,
    ...overrides,
  };
}

async function postControl(action: string, id = PROPOSAL_ID) {
  const { POST } = await import("@/app/api/v1/proposals/[id]/vote-control/route");
  const req = {
    method: "POST",
    url: `http://localhost/api/v1/proposals/${id}/vote-control`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${id}/vote-control`),
    headers: new Headers(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
    json: async () => ({ action }),
  } as unknown as Parameters<typeof POST>[0];
  const res = (await POST(req, {
    params: Promise.resolve({ id }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function executedSqls(): string[] {
  return hoisted.execute.mock.calls.map((c) => (c[0] as { sql: string }).sql);
}

/**
 * The metadata JSON written by the Nth UPDATE-proposals statement. The pause
 * statement is `SET metadata = ?` (args[0]); resume/stop prepend the new
 * voting end (metadata at args[1]).
 */
function writtenMetadata(callIdx: number, argIdx: 0 | 1): Record<string, unknown> {
  const call = hoisted.execute.mock.calls[callIdx] as unknown as [{ args: unknown[] }];
  return JSON.parse(call[0].args[argIdx] as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue({ sub: ADMIN });
  hoisted.isAdminAddress.mockReturnValue(true);
  hoisted.recordAuditEvent.mockResolvedValue(undefined);
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n });
});

describe("POST /api/v1/proposals/[id]/vote-control — guards", () => {
  it("returns 401 when the session is missing or invalid", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError("No session"));
    const { status, body } = await postControl("pause");
    expect(status).toBe(401);
    expect((body.error as { code: string }).code).toBe("UNAUTHORIZED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admins without touching the proposal", async () => {
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status, body } = await postControl("pause");
    expect(status).toBe(403);
    expect((body.error as { code: string }).code).toBe("NOT_VERIFIED");
    expect(hoisted.execute).not.toHaveBeenCalled();
    expect(hoisted.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown action with 400", async () => {
    const { status } = await postControl("restart");
    expect(status).toBe(400);
    expect(hoisted.getProposalById).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown proposal", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(null);
    const { status, body } = await postControl("pause");
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("refuses controls on a proposal without a live vote", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(activeProposal({ status: "PASSED" }));
    const { status, body } = await postControl("pause");
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });
});

describe("pause", () => {
  it("writes pausedAt into metadata and audits the action", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(activeProposal());
    const { status } = await postControl("pause");

    expect(status).toBe(200);
    expect(executedSqls()).toEqual([
      "UPDATE proposals SET metadata = ?, updated_at = datetime('now') WHERE id = ?",
    ]);
    const meta = writtenMetadata(0, 0);
    expect(typeof meta.pausedAt).toBe("string");
    expect(meta.type).toBe("base"); // existing metadata preserved

    expect(hoisted.recordAuditEvent).toHaveBeenCalledWith(
      ADMIN,
      "VOTE_PAUSED",
      "proposal",
      PROPOSAL_ID,
      { pausedAt: meta.pausedAt },
    );
  });

  it("refuses to double-pause", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(
      activeProposal({ pausedAt: "2026-09-23T10:00:00.000Z" }),
    );
    const { status, body } = await postControl("pause");
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_PAUSED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });
});

describe("resume", () => {
  it("shifts the voting end by the paused duration and clears the marker", async () => {
    // Paused 2026-09-23T10:00, resumed 2h later → end moves +2h.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"));
      hoisted.getProposalById.mockResolvedValueOnce(
        activeProposal({ pausedAt: "2026-09-23T10:00:00.000Z" }),
      );
      const { status } = await postControl("resume");

      expect(status).toBe(200);
      expect(executedSqls()).toEqual([
        "UPDATE proposals SET voting_ends_at = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?",
      ]);
      const call = hoisted.execute.mock.calls[0] as unknown as [{ args: unknown[] }];
      expect(call[0].args[0]).toBe("2026-09-29T14:00:00.000Z"); // 12:00 end + 2h pause
      const meta = writtenMetadata(0, 1);
      expect(meta.pausedAt).toBeUndefined();
      expect(hoisted.recordAuditEvent).toHaveBeenCalledWith(
        ADMIN,
        "VOTE_RESUMED",
        "proposal",
        PROPOSAL_ID,
        { resumedAt: "2026-09-23T12:00:00.000Z", votingEndsAt: "2026-09-29T14:00:00.000Z" },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to resume a vote that is not paused", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(activeProposal());
    const { status, body } = await postControl("resume");
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_PAUSED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });
});

describe("stop", () => {
  it("closes now, lifts any pause, finalizes, and audits the outcome", async () => {
    // Regression: a paused vote stopped by an admin must have pausedAt cleared
    // BEFORE the finalizer runs — finalizeProposal skips paused proposals, so
    // keeping the marker would strand the vote ACTIVE past its end forever.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-25T09:00:00.000Z"));
      hoisted.getProposalById
        .mockResolvedValueOnce(
          activeProposal({ pausedAt: "2026-09-24T10:00:00.000Z" }), // pre-stop read
        )
        .mockResolvedValueOnce(activeProposal({ status: "EXPIRED" })); // post-finalize read
      hoisted.finalizeProposal.mockResolvedValueOnce({
        proposalId: PROPOSAL_ID,
        previousStatus: "ACTIVE",
        newStatus: "EXPIRED",
        reason: "Quorum not met",
        quorumAchieved: 0,
        quorumRequired: 5,
        passed: false,
      });
      const { status, body } = await postControl("stop");

      expect(status).toBe(200);
      expect((body.data as { proposal: { status: string } }).proposal.status).toBe("EXPIRED");

      const sqls = executedSqls();
      expect(sqls).toEqual([
        "UPDATE proposals SET voting_ends_at = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?",
      ]);
      const call = hoisted.execute.mock.calls[0] as unknown as [{ args: unknown[] }];
      expect(call[0].args[0]).toBe("2026-09-25T09:00:00.000Z"); // closed at "now"
      expect(writtenMetadata(0, 1).pausedAt).toBeUndefined(); // pause lifted

      // Finalizer ran after the close-and-unpause write.
      expect(hoisted.finalizeProposal).toHaveBeenCalledTimes(1);
      expect(hoisted.finalizeProposal).toHaveBeenCalledWith(PROPOSAL_ID);
      expect(hoisted.recordAuditEvent).toHaveBeenCalledWith(
        ADMIN,
        "VOTE_STOPPED",
        "proposal",
        PROPOSAL_ID,
        { stoppedAt: "2026-09-25T09:00:00.000Z", finalStatus: "EXPIRED" },
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 500 without auditing when the finalizer leaves the vote ACTIVE", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(activeProposal())
      .mockResolvedValueOnce(activeProposal()); // still ACTIVE after finalize
    hoisted.finalizeProposal.mockResolvedValueOnce(null);
    const { status, body } = await postControl("stop");

    expect(status).toBe(500);
    expect((body.error as { code: string }).code).toBe("INTERNAL_ERROR");
    expect(hoisted.recordAuditEvent).not.toHaveBeenCalled();
  });
});
