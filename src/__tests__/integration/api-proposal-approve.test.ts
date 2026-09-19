import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for the admin approve route — the voting window it sets
 * must match the per-type defaults advertised by the create flow (14d for
 * Chain Selection and Tokenomics Change, 7d otherwise), not a fixed 168h.
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
    notifyVotingStarted: vi.fn(),
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
    MISSING_FIELDS: { status: 400, message: "Missing fields" },
    NOT_VERIFIED: { status: 403, message: "Not verified" },
    PROPOSAL_NOT_FOUND: { status: 404, message: "Not found" },
    INTERNAL_ERROR: { status: 500, message: "Internal error" },
    VOTING_CLOSED: { status: 409, message: "Voting closed" },
  },
}));
vi.mock("@/lib/audit-log", () => ({ recordAuditEvent: hoisted.recordAuditEvent }));
vi.mock("@/lib/notifications", () => ({
  notifyVotingStarted: hoisted.notifyVotingStarted,
  notifyAuthorOfRejection: vi.fn(),
  notifyAdminsOfReview: vi.fn(),
  notifyProposalCreated: vi.fn(),
}));

const ADMIN = "0xaaaa000000000000000000000000000000000001";

function makeProposal(status: string, type = "GENERAL") {
  return {
    id: "prop-a1",
    title: "Approve me",
    description: "A description that is long enough.",
    type,
    status,
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-06-01T00:00:00.000Z",
    votingStartsAt: null,
    votingEndsAt: null,
    quorumRequired: 10,
    quorumAchieved: null,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    metadata: { type: "base", links: [], tags: [] },
  };
}

/** First read is the pre-check; the re-read after UPDATE must report ACTIVE. */
function queueProposal(status: string, type = "GENERAL") {
  hoisted.getProposalById
    .mockResolvedValueOnce(makeProposal(status, type))
    .mockResolvedValueOnce({ ...makeProposal(status, type), status: "ACTIVE" });
}

async function approve() {
  const { POST } = await import("@/app/api/v1/proposals/[id]/approve/route");
  const req = {
    method: "POST",
    url: "http://localhost/api/v1/proposals/prop-a1/approve",
    nextUrl: new URL("http://localhost/api/v1/proposals/prop-a1/approve"),
    headers: new Headers(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof POST>[0];
  const res = (await POST(req, {
    params: Promise.resolve({ id: "prop-a1" }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Voting window in hours from the UPDATE proposals statement, if any. */
function approvedWindowHours(): number | undefined {
  const update = hoisted.execute.mock.calls.find((c) =>
    (c[0] as { sql: string }).sql.includes("UPDATE proposals"),
  );
  if (!update) return undefined;
  const [, startIso, endIso] = (update[0] as { args: string[] }).args;
  return Math.round(
    (Date.parse(endIso!) - Date.parse(startIso!)) / (60 * 60 * 1000),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue({ sub: ADMIN });
  hoisted.isAdminAddress.mockReturnValue(true);
  hoisted.recordAuditEvent.mockResolvedValue(undefined);
  hoisted.notifyVotingStarted.mockResolvedValue(undefined);
  hoisted.getProposalById.mockReset();
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n });
});

describe("POST /api/v1/proposals/[id]/approve — voting window", () => {
  it("gives high-impact types their advertised 14-day window", async () => {
    queueProposal("PENDING_REVIEW", "CHAIN_SELECTION");
    const { status } = await approve();
    expect(status).toBe(200);
    expect(approvedWindowHours()).toBe(336);
  });

  it("gives Tokenomics Change its advertised 14-day window too", async () => {
    queueProposal("PENDING_REVIEW", "TOKENOMICS_CHANGE");
    const { status } = await approve();
    expect(status).toBe(200);
    expect(approvedWindowHours()).toBe(336);
  });

  it("keeps the 7-day default for General Discussion", async () => {
    queueProposal("PENDING_REVIEW", "GENERAL");
    const { status } = await approve();
    expect(status).toBe(200);
    expect(approvedWindowHours()).toBe(168);
  });

  it("audits the approval with both window bounds", async () => {
    queueProposal("PENDING_REVIEW", "GENERAL");
    await approve();
    expect(hoisted.recordAuditEvent).toHaveBeenCalledTimes(1);
    const [, action, , , details] = hoisted.recordAuditEvent.mock.calls[0] as unknown[];
    expect(action).toBe("PROPOSAL_APPROVED");
    expect(details).toHaveProperty("votingStartsAt");
    expect(details).toHaveProperty("votingEndsAt");
  });
});

describe("POST /api/v1/proposals/[id]/approve — guards", () => {
  it("rejects non-admins", async () => {
    hoisted.requireAuth.mockResolvedValue({ sub: ADDR_WHALE });
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status } = await approve();
    expect(status).toBe(403);
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("only approves proposals pending review", async () => {
    hoisted.getProposalById.mockResolvedValueOnce(makeProposal("FAILED"));
    const { status, body } = await approve();
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("reports failure when the status transition does not stick", async () => {
    // Both reads return PENDING_REVIEW — the UPDATE did not take effect.
    hoisted.getProposalById.mockResolvedValue(makeProposal("PENDING_REVIEW"));
    const { status } = await approve();
    expect(status).toBe(500);
  });
});
