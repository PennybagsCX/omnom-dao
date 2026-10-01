import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for POST /api/v1/proposals/[id]/adopt-consensus — the
 * admin gate applying the Wave 1 consensus fallback (REFERENDUM-WAVE1.md §3):
 * an EXPIRED (quorum-missed) proposal's most-voted outcome is adopted as the
 * community's working consensus, recorded transparently as quorum-missed.
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
const PROPOSAL_ID = "prop-ac1";

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    title: "Wave 1 Referendum · Question 1: Global default quorum",
    description: "A description that is long enough.",
    type: "GENERAL",
    status: "EXPIRED",
    authorAddress: ADDR_DOLPHIN,
    createdAt: "2026-09-01T00:00:00.000Z",
    votingStartsAt: "2026-09-02T00:00:00.000Z",
    votingEndsAt: "2026-10-01T00:00:00.000Z",
    quorumRequired: 5,
    quorumAchieved: 1.735,
    votesFor: 27,
    votesAgainst: 9,
    votesAbstain: 2,
    metadata: { type: "base", links: ["https://example.com"], tags: ["referendum"] },
    ...overrides,
  };
}

function buildReq(body: unknown) {
  return {
    method: "POST",
    url: `http://localhost/api/v1/proposals/${PROPOSAL_ID}/adopt-consensus`,
    nextUrl: new URL(`http://localhost/api/v1/proposals/${PROPOSAL_ID}/adopt-consensus`),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<
    typeof import("@/app/api/v1/proposals/[id]/adopt-consensus/route").POST
  >[0];
}

async function adoptConsensus(body: unknown) {
  const { POST } = await import("@/app/api/v1/proposals/[id]/adopt-consensus/route");
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
  hoisted.getProposalById.mockResolvedValue(makeProposal());
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — auth", () => {
  it("returns 401 when not authenticated", async () => {
    hoisted.requireAuth.mockRejectedValue(new hoisted.UnauthorizedError());
    const { status } = await adoptConsensus({});
    expect(status).toBe(401);
  });

  it("returns 403 for non-admins", async () => {
    hoisted.requireAuth.mockResolvedValue({ sub: ADDR_WHALE });
    hoisted.isAdminAddress.mockReturnValue(false);
    const { status } = await adoptConsensus({});
    expect(status).toBe(403);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — state gate", () => {
  it("returns 404 for an unknown proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(null);
    const { status, body } = await adoptConsensus({});
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("returns 409 for an ACTIVE proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(makeProposal({ status: "ACTIVE" }));
    const { status, body } = await adoptConsensus({});
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 409 for a PASSED proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(makeProposal({ status: "PASSED" }));
    const { status } = await adoptConsensus({});
    expect(status).toBe(409);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 409 when the guarded update loses the race", async () => {
    hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 0, lastInsertRowid: 0n });
    const { status } = await adoptConsensus({});
    expect(status).toBe(409);
  });
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — body validation", () => {
  it("returns 400 when the note exceeds 500 chars", async () => {
    const { status } = await adoptConsensus({ note: "x".repeat(501) });
    expect(status).toBe(400);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — happy path", () => {
  it("adopts FOR when it leads, merges metadata, and writes the audit row", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal())
      .mockResolvedValue(
        makeProposal({
          status: "EXECUTED",
          metadata: {
            type: "base",
            links: ["https://example.com"],
            tags: ["referendum"],
            adoptedAs: "consensus-fallback",
            adoptedOutcome: "FOR",
            adoptedBy: ADMIN,
            adoptedAt: "2026-10-01T12:00:00.000Z",
          },
        }),
      );

    const { status, body } = await adoptConsensus({
      note: "Working consensus pending re-confirmation.",
    });

    expect(status).toBe(200);
    const data = body.data as { proposal: { status: string } };
    expect(data.proposal.status).toBe("EXECUTED");

    // The status predicate must guard against concurrent adoptions.
    const update = findCall("UPDATE proposals");
    expect(update).toBeDefined();
    expect(update![0].sql).toContain("AND status = ?");
    expect(update![0].args[0]).toBe("EXECUTED");
    expect(update![0].args[3]).toBe("EXPIRED");

    const meta = JSON.parse(update![0].args[1] as string);
    // Pre-existing metadata keys survive the merge.
    expect(meta.type).toBe("base");
    expect(meta.links).toEqual(["https://example.com"]);
    expect(meta.tags).toEqual(["referendum"]);
    // Full quorum-missed disclosure.
    expect(meta.adoptedAs).toBe("consensus-fallback");
    expect(meta.adoptedOutcome).toBe("FOR");
    expect(meta.quorumAchieved).toBe(1.735);
    expect(meta.quorumRequired).toBe(5);
    expect(meta.adoptedBy).toBe(ADMIN);
    expect(typeof meta.adoptedAt).toBe("string");
    expect(meta.adoptionNote).toBe("Working consensus pending re-confirmation.");

    // The real audit-log lib recorded the fallback against the mocked client.
    const audit = findCall("INSERT INTO audit_log");
    expect(audit).toBeDefined();
    expect(audit![0].args[0]).toBe(ADMIN);
    expect(audit![0].args[1]).toBe("PROPOSAL_ADOPTED_AS_CONSENSUS");
    expect(audit![0].args[2]).toBe("proposal");
    expect(audit![0].args[3]).toBe(PROPOSAL_ID);
    const details = JSON.parse(audit![0].args[4] as string);
    expect(details.adoptedAs).toBe("consensus-fallback");
    expect(details.adoptedOutcome).toBe("FOR");
    expect(details.quorumAchieved).toBe(1.735);
    expect(details.quorumRequired).toBe(5);
  });

  it("adopts AGAINST on a tie (AGAINST >= FOR)", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal({ votesFor: 5, votesAgainst: 5 }))
      .mockResolvedValue(makeProposal({ status: "EXECUTED" }));

    const { status } = await adoptConsensus({});

    expect(status).toBe(200);
    const meta = JSON.parse(findCall("UPDATE proposals")![0].args[1] as string);
    expect(meta.adoptedOutcome).toBe("AGAINST");
  });

  it("adopts AGAINST when it leads", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal({ votesFor: 3, votesAgainst: 11 }))
      .mockResolvedValue(makeProposal({ status: "EXECUTED" }));

    const { status } = await adoptConsensus({});
    expect(status).toBe(200);
    const meta = JSON.parse(findCall("UPDATE proposals")![0].args[1] as string);
    expect(meta.adoptedOutcome).toBe("AGAINST");
  });

  it("omits adoptionNote when no note is given", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(makeProposal())
      .mockResolvedValue(makeProposal({ status: "EXECUTED" }));

    const { status } = await adoptConsensus({});
    expect(status).toBe(200);
    const meta = JSON.parse(findCall("UPDATE proposals")![0].args[1] as string);
    expect(meta.adoptionNote).toBeUndefined();
    expect(findCall("INSERT INTO audit_log")).toBeDefined();
  });
});
