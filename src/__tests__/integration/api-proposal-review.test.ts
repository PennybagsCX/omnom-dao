import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for the admin review surface — the reject route's author
 * notification and the notification lib's admin-targeted review request.
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
    notifyAuthorOfRejection: vi.fn(),
    getUserIdByAddress: vi.fn(),
    getUserSettings: vi.fn(),
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
  NOTIFICATION_TYPE_CONFIG: {
    PROPOSAL_CREATED: { emoji: "🗳️" },
    VOTING_STARTED: { emoji: "🚀" },
    VOTING_ENDING_SOON: { emoji: "⏳" },
    PROPOSAL_RESULT: { emoji: "🏁" },
    MENTION: { emoji: "💬" },
  },
}));
vi.mock("@/lib/audit-log", () => ({ recordAuditEvent: hoisted.recordAuditEvent }));
vi.mock("@/lib/notifications", () => ({
  notifyAuthorOfRejection: hoisted.notifyAuthorOfRejection,
  notifyAdminsOfReview: vi.fn(),
  notifyProposalCreated: vi.fn(),
}));
vi.mock("@/lib/user-settings", () => ({
  getUserIdByAddress: hoisted.getUserIdByAddress,
  getUserSettings: hoisted.getUserSettings,
}));

const ADMIN = "0xaaaa000000000000000000000000000000000001";

function makeProposal(status: string) {
  return {
    id: "prop-r1",
    title: "Reject me",
    description: "A description that is long enough.",
    type: "GENERAL",
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

function buildReq(body: unknown) {
  return {
    method: "PATCH",
    url: "http://localhost/api/v1/proposals/prop-r1/reject",
    nextUrl: new URL("http://localhost/api/v1/proposals/prop-r1/reject"),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<
    typeof import("@/app/api/v1/proposals/[id]/reject/route").POST
  >[0];
}

async function reject(body: unknown) {
  const { POST } = await import("@/app/api/v1/proposals/[id]/reject/route");
  const res = (await POST(buildReq(body), {
    params: Promise.resolve({ id: "prop-r1" }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue({ sub: ADMIN });
  hoisted.isAdminAddress.mockReturnValue(true);
  hoisted.recordAuditEvent.mockResolvedValue(undefined);
  hoisted.notifyAuthorOfRejection.mockResolvedValue(undefined);
  hoisted.getProposalById.mockImplementation(async () =>
    makeProposal("FAILED"),
  );
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n });
});

describe("POST /api/v1/proposals/[id]/reject — author notification", () => {
  it("notifies the author with the sanitized reason after a successful rejection", async () => {
    const { status } = await reject({ reason: "Off-topic for this DAO." });
    expect(status).toBe(200);
    expect(hoisted.notifyAuthorOfRejection).toHaveBeenCalledTimes(1);
    expect(hoisted.notifyAuthorOfRejection).toHaveBeenCalledWith(
      "prop-r1",
      "Off-topic for this DAO.",
    );
  });

  it("still succeeds when the author notification fails (best-effort delivery)", async () => {
    hoisted.notifyAuthorOfRejection.mockRejectedValue(new Error("db down"));
    const { status } = await reject({ reason: "Nope." });
    expect(status).toBe(200);
  });

  it("requires a reason", async () => {
    const { status, body } = await reject({});
    expect(status).toBe(400);
    expect((body.error as { code: string }).code).toBeDefined();
    expect(hoisted.notifyAuthorOfRejection).not.toHaveBeenCalled();
  });

  it("rejects non-admins", async () => {
    hoisted.requireAuth.mockResolvedValue({ sub: ADDR_WHALE });
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status } = await reject({ reason: "Nope." });
    expect(status).toBe(403);
    expect(hoisted.notifyAuthorOfRejection).not.toHaveBeenCalled();
  });
});

describe("notifications lib — admin review targeting", () => {
  it("notifyAdminsOfReview fans out only to registered admin users", async () => {
    // Real notifications lib against a mocked db: two admins (one registered),
    // one regular user, one proposer.
    vi.doUnmock("@/lib/notifications");
    vi.resetModules();
    hoisted.getUserSettings.mockResolvedValue({
      notifications: {
        proposalCreated: true,
        votingStarted: true,
        votingEndingSoon: true,
        proposalResult: true,
        mention: true,
      },
    });
    hoisted.isAdminAddress.mockImplementation(
      (addr: string) => addr === ADMIN || addr === "0xbbbb000000000000000000000000000000000002",
    );
    hoisted.getProposalById.mockResolvedValue(makeProposal("PENDING_REVIEW"));
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.startsWith("SELECT id, wallet_address FROM users")) {
        return {
          rows: [
            { id: "u-admin", wallet_address: ADMIN },
            { id: "u-not-admin", wallet_address: ADDR_DOLPHIN },
            { id: "u-admin2", wallet_address: "0xbbbb000000000000000000000000000000000002" },
          ],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      }
      if (stmt.sql.startsWith("INSERT INTO notifications")) {
        return { rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });

    const { notifyAdminsOfReview } = await import("@/lib/notifications");
    await notifyAdminsOfReview("prop-r1", ADDR_DOLPHIN);

    const inserts = hoisted.execute.mock.calls
      .filter((c) => (c[0] as { sql: string }).sql.startsWith("INSERT INTO notifications"))
      .map((c) => (c[0] as { args: string[] }).args[0]);
    expect(inserts).toContain("u-admin");
    expect(inserts).toContain("u-admin2");
    expect(inserts).not.toContain("u-not-admin");
  });
});

describe("notifications lib — ending-soon idempotency", () => {
  async function runEndingSoon(alreadySent: boolean) {
    vi.doUnmock("@/lib/notifications");
    vi.resetModules();
    hoisted.getUserSettings.mockResolvedValue({
      notifications: {
        proposalCreated: true,
        votingStarted: true,
        votingEndingSoon: true,
        proposalResult: true,
        mention: true,
      },
    });
    hoisted.isAdminAddress.mockReturnValue(false);
    hoisted.getProposalById.mockResolvedValue({
      ...makeProposal("ACTIVE"),
      votingEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });
    hoisted.execute.mockImplementation(async (stmt: { sql: string }) => {
      if (stmt.sql.includes("FROM notifications WHERE type = 'VOTING_ENDING_SOON'")) {
        return {
          rows: alreadySent ? [{ 1: 1 }] : [],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      }
      if (stmt.sql.startsWith("SELECT id FROM users")) {
        return {
          rows: [{ id: "u-1" }, { id: "u-2" }],
          columns: [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      }
      if (stmt.sql.startsWith("INSERT INTO notifications")) {
        return { rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
      }
      return { rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined };
    });

    const { notifyEndingSoon } = await import("@/lib/notifications");
    await notifyEndingSoon("prop-r1");
    return hoisted.execute.mock.calls.filter((c) =>
      (c[0] as { sql: string }).sql.startsWith("INSERT INTO notifications"),
    ).length;
  }

  it("fans out when no prior ending-soon notification exists", async () => {
    const inserts = await runEndingSoon(false);
    expect(inserts).toBe(2); // one per user
  });

  it("skips entirely when the proposal already had its ending-soon wave", async () => {
    const inserts = await runEndingSoon(true);
    expect(inserts).toBe(0);
  });
});
