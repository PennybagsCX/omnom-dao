import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for POST /api/v1/proposals/[id]/record-outcome — the
 * admin gate that transitions a PASSED proposal → EXECUTED once the
 * off-chain action is taken (GOVERNANCE_MECHANICS.md §6.1).
 * DB, auth layers are mocked; the real audit-log lib runs against the mocked
 * db client so the audit INSERT itself is asserted.
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
    INTERNAL_ERROR: { status: 500, message: "Internal error" },
    VOTING_CLOSED: { status: 409, message: "Voting closed" },
  },
}));

const ADMIN = "0xaaaa000000000000000000000000000000000001";
const PROPOSAL_ID = "prop-ro1";

function makeProposal(status: string) {
  return {
    id: PROPOSAL_ID,
    title: "Fund the community workshop",
    description: "A description that is long enough.",
    type: "GENERAL",
    status,
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-06-01T00:00:00.000Z",
    votingStartsAt: "2026-06-01T00:00:00.000Z",
    votingEndsAt: "2026-06-08T00:00:00.000Z",
    quorumRequired: 10,
    quorumAchieved: 12.5,
    votesFor: 100,
    votesAgainst: 20,
    votesAbstain: 5,
    metadata: { type: "base", links: ["https://example.com"], tags: ["treasury"] },
  };
}

function buildReq(body: unknown) {
  return {
    method: "POST",
    url: `http://localhost/api/v1/proposals/${PROPOSAL_ID}/record-outcome`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}/record-outcome`),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<
    typeof import("@/app/api/v1/proposals/[id]/record-outcome/route").POST
  >[0];
}

async function recordOutcome(body: unknown) {
  const { POST } = await import("@/app/api/v1/proposals/[id]/record-outcome/route");
  const res = (await POST(buildReq(body), {
    params: Promise.resolve({ id: PROPOSAL_ID }),
  })) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function findCall(prefix: string) {
  return hoisted.execute.mock.calls.find((c) =>
    (c[0] as { sql: string }).sql.startsWith(prefix),
  ) as [{ sql: string; args: unknown[] }] | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireAuth.mockResolvedValue({ sub: ADMIN });
  hoisted.isAdminAddress.mockReturnValue(true);
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n });
  hoisted.getProposalById.mockResolvedValue(makeProposal("PASSED"));
});

describe("POST /api/v1/proposals/[id]/record-outcome — auth", () => {
  it("returns 401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError());
    const { status } = await recordOutcome({ note: "Done." });
    expect(status).toBe(401);
  });

  it("returns 403 for non-admins", async () => {
    hoisted.requireAuth.mockResolvedValue({ sub: ADDR_WHALE });
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status } = await recordOutcome({ note: "Done." });
    expect(status).toBe(403);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/record-outcome — state gate", () => {
  it("returns 404 for an unknown proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(null);
    const { status, body } = await recordOutcome({ note: "Done." });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("returns 409 for an ACTIVE proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(makeProposal("ACTIVE"));
    const { status, body } = await recordOutcome({ note: "Done." });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 409 for a FAILED proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(makeProposal("FAILED"));
    const { status, body } = await recordOutcome({ note: "Done." });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/record-outcome — body validation", () => {
  it("returns 400 when the note exceeds 500 chars", async () => {
    const { status } = await recordOutcome({ note: "x".repeat(501) });
    expect(status).toBe(400);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/record-outcome — happy path", () => {
  it("transitions PASSED → EXECUTED, merges metadata, and writes the audit row", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal("PASSED"))
      .mockResolvedValue({
        ...makeProposal("EXECUTED"),
        metadata: {
          type: "base",
          links: ["https://example.com"],
          tags: ["treasury"],
          executionNote: "Funds dispatched on-chain.",
          executedBy: ADMIN,
          executedAt: "2026-09-17T00:00:00.000Z",
        },
      });

    const { status, body } = await recordOutcome({ note: "Funds dispatched on-chain." });

    expect(status).toBe(200);
    const data = body.data as { proposal: { status: string } };
    expect(data.proposal.status).toBe("EXECUTED");

    const update = findCall("UPDATE proposals");
    expect(update).toBeDefined();
    expect(update![0].sql).toContain("status = ?");
    expect(update![0].args[0]).toBe("EXECUTED");
    const meta = JSON.parse(update![0].args[1] as string);
    // Pre-existing metadata keys survive the merge.
    expect(meta.type).toBe("base");
    expect(meta.links).toEqual(["https://example.com"]);
    expect(meta.tags).toEqual(["treasury"]);
    expect(meta.executionNote).toBe("Funds dispatched on-chain.");
    expect(meta.executedBy).toBe(ADMIN);
    expect(typeof meta.executedAt).toBe("string");

    // The real audit-log lib recorded the outcome against the mocked client.
    const audit = findCall("INSERT INTO audit_log");
    expect(audit).toBeDefined();
    expect(audit![0].args[0]).toBe(ADMIN);
    expect(audit![0].args[1]).toBe("PROPOSAL_OUTCOME_RECORDED");
    expect(audit![0].args[2]).toBe("proposal");
    expect(audit![0].args[3]).toBe(PROPOSAL_ID);
    expect(JSON.parse(audit![0].args[4] as string)).toEqual({
      note: "Funds dispatched on-chain.",
    });
  });

  it("records the outcome without a note when none is given", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal("PASSED"))
      .mockResolvedValue({
        ...makeProposal("EXECUTED"),
        metadata: {
          type: "base",
          links: ["https://example.com"],
          tags: ["treasury"],
          executedBy: ADMIN,
          executedAt: "2026-09-17T00:00:00.000Z",
        },
      });

    const { status } = await recordOutcome({});

    expect(status).toBe(200);
    const update = findCall("UPDATE proposals");
    expect(update).toBeDefined();
    const meta = JSON.parse(update![0].args[1] as string);
    expect(meta.executionNote).toBeUndefined();
    expect(meta.executedBy).toBe(ADMIN);
    expect(typeof meta.executedAt).toBe("string");
    // The audit row is still written (details omit the absent note).
    expect(findCall("INSERT INTO audit_log")).toBeDefined();
  });
});
