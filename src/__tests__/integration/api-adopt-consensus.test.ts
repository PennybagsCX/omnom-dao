import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN, ADDR_WHALE } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for POST /api/v1/proposals/[id]/adopt-consensus — the
 * admin gate applying the Wave 1 consensus fallback (REFERENDUM-WAVE1.md §3):
 * an EXPIRED (quorum-missed) proposal's most-voted outcome is adopted as the
 * community's working consensus, recorded transparently as quorum-missed.
 *
 * Guardrails (2026-10-01): a 24h intent cooling-off ({ declareIntent: true }),
 * a strength floor (≥60% of FOR+AGAINST AND ≥100 unique voters), and an
 * audited { force: true, note } override for votes whose published terms
 * predate the guardrails. DB, auth layers are mocked; the real audit-log lib
 * runs against the mocked db client so the audit INSERT itself is asserted.
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
/** Long before `now` — any intent declared this far back passes the 24h gate. */
const OLD_INTENT = "2026-09-01T00:00:00.000Z";

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

/** Proposal whose intent was declared > 24h ago (time-lock satisfied). */
function withOldIntent(overrides: Record<string, unknown> = {}) {
  const base = makeProposal(overrides);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      fallbackIntentDeclaredAt: OLD_INTENT,
      fallbackIntentDeclaredBy: ADMIN,
    },
  };
}

/**
 * DB mock that dispatches on the statement prefix: the unique-voter COUNT
 * returns a healthy electorate by default, the guarded UPDATE succeeds, and
 * everything else (audit INSERT, probe SELECTs) returns an empty-rows shape.
 */
function mockDb({ voters = 150, rowsAffected = 1 }: { voters?: number; rowsAffected?: number } = {}) {
  hoisted.execute.mockImplementation(async ({ sql }: { sql: string }) => {
    if (sql.startsWith("SELECT COUNT(DISTINCT")) {
      return { rows: [{ n: voters }], columns: [], rowsAffected: 0, lastInsertRowid: 0n };
    }
    if (sql.startsWith("UPDATE proposals")) {
      return { rows: [], columns: [], rowsAffected, lastInsertRowid: 1n };
    }
    return { rows: [], columns: [], rowsAffected: 1, lastInsertRowid: 1n };
  });
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
  mockDb();
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
    const { status, body } = await adoptConsensus({ force: true, note: "x" });
    expect(status).toBe(404);
    expect((body.error as { code: string }).code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("returns 409 for an ACTIVE proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(withOldIntent({ status: "ACTIVE" }));
    const { status, body } = await adoptConsensus({ force: true, note: "x" });
    expect(status).toBe(409);
    expect((body.error as { code: string }).code).toBe("VOTING_CLOSED");
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 409 for a PASSED proposal", async () => {
    hoisted.getProposalById.mockResolvedValue(withOldIntent({ status: "PASSED" }));
    const { status } = await adoptConsensus({ force: true, note: "x" });
    expect(status).toBe(409);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 409 when the guarded update loses the race", async () => {
    hoisted.getProposalById.mockResolvedValue(withOldIntent());
    mockDb({ voters: 150, rowsAffected: 0 });
    const { status } = await adoptConsensus({ force: true, note: "x" });
    expect(status).toBe(409);
  });
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — body validation", () => {
  it("returns 400 when the note exceeds 500 chars", async () => {
    const { status } = await adoptConsensus({ note: "x".repeat(501) });
    expect(status).toBe(400);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("returns 400 when force is used without a note", async () => {
    const { status } = await adoptConsensus({ force: true });
    expect(status).toBe(400);
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });
});

describe("POST /api/v1/proposals/[id]/adopt-consensus — guardrails", () => {
  it("declareIntent stamps the 24h cooling-off and audits it", async () => {
    const { status, body } = await adoptConsensus({ declareIntent: true });
    expect(status).toBe(200);
    const data = body.data as { coolingOffEndsAt: string };
    expect(Date.parse(data.coolingOffEndsAt)).toBeGreaterThan(Date.now());

    const metaUpdate = findCall("UPDATE proposals");
    expect(metaUpdate).toBeDefined();
    // The intent UPDATE is (metadata, id, status): metadata sits at args[0].
    const meta = JSON.parse(metaUpdate![0].args[0] as string);
    expect(typeof meta.fallbackIntentDeclaredAt).toBe("string");
    expect(meta.fallbackIntentDeclaredBy).toBe(ADMIN);

    const audit = findCall("INSERT INTO audit_log");
    expect(audit![0].args[1]).toBe("FALLBACK_INTENT_DECLARED");
  });

  it("refuses adoption before any intent is declared", async () => {
    const { status, body } = await adoptConsensus({});
    expect(status).toBe(409);
    expect((body.error as { message: string }).message).toContain(
      "Declare the fallback intent first",
    );
    expect(findCall("UPDATE proposals")).toBeUndefined();
  });

  it("refuses adoption while the 24h cooling-off is running", async () => {
    // Fresh intent (1h old) — built directly, NOT via withOldIntent, whose
    // OLD_INTENT stamp would satisfy the time-lock.
    hoisted.getProposalById.mockResolvedValue(
      makeProposal({
        metadata: {
          type: "base",
          links: [],
          tags: [],
          fallbackIntentDeclaredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          fallbackIntentDeclaredBy: ADMIN,
        },
      }),
    );
    const { status, body } = await adoptConsensus({});
    expect(status).toBe(409);
    expect((body.error as { message: string }).message).toContain("Cooling-off in effect");
  });

  it("refuses a sub-60% plurality below the 100-voter floor without force", async () => {
    // Default proposal: 27 FOR / 9 AGAINST = 75% share BUT the voter COUNT
    // mock returns 20 (< 100) — the floor blocks despite the strong share.
    hoisted.getProposalById.mockResolvedValue(withOldIntent());
    mockDb({ voters: 20 });
    const { status, body } = await adoptConsensus({});
    expect(status).toBe(409);
    expect((body.error as { message: string }).message).toContain("Guardrails not met");
    expect((body.error as { message: string }).message).toContain("force");
  });

  it("adopts cleanly once intent has aged and the strength floor is met", async () => {
    // 150 FOR / 50 AGAINST = 75% share, 150 unique voters — both guardrails pass.
    hoisted.getProposalById
      .mockResolvedValueOnce(
        withOldIntent({ votesFor: 150, votesAgainst: 50, votesAbstain: 10 }),
      )
      .mockResolvedValue(withOldIntent({ status: "EXECUTED", votesFor: 150, votesAgainst: 50 }));

    const { status, body } = await adoptConsensus({ note: "Working consensus." });
    expect(status).toBe(200);
    expect((body.data as { proposal: { status: string } }).proposal.status).toBe("EXECUTED");

    const update = findCall("UPDATE proposals");
    const meta = JSON.parse(update![0].args[1] as string);
    expect(meta.adoptedAs).toBe("consensus-fallback");
    expect(meta.adoptedOutcome).toBe("FOR");
    expect(meta.fallbackGuardrails.winShare).toBeCloseTo(0.75, 3);
    expect(meta.fallbackGuardrails.uniqueVoters).toBe(150);
    expect(meta.fallbackGuardrails.forced).toBe(false);

    const audit = findCall("INSERT INTO audit_log");
    expect(audit![0].args[1]).toBe("PROPOSAL_ADOPTED_AS_CONSENSUS");
    const details = JSON.parse(audit![0].args[4] as string);
    expect(details.forced).toBeUndefined();
  });

  it("lets force bypass the guardrails and marks it in metadata + audit", async () => {
    // Default 27/9 = 75% share but 0-count voters mock → floor unmet; force overrides.
    hoisted.getProposalById
      .mockResolvedValueOnce(withOldIntent())
      .mockResolvedValue(withOldIntent({ status: "EXECUTED" }));
    mockDb({ voters: 20 });

    const { status, body } = await adoptConsensus({
      force: true,
      note: "Published terms promised a plain most-voted adoption.",
    });
    expect(status).toBe(200);
    expect((body.data as { proposal: { status: string } }).proposal.status).toBe("EXECUTED");

    const meta = JSON.parse(findCall("UPDATE proposals")![0].args[1] as string);
    expect(meta.fallbackGuardrails.forced).toBe(true);
    expect(meta.adoptionNote).toContain("Published terms");

    const details = JSON.parse(findCall("INSERT INTO audit_log")![0].args[4] as string);
    expect(details.forced).toBe(true);
    expect(details.adoptionNote).toContain("Published terms");
  });

  it("adopts AGAINST on a tie (AGAINST >= FOR) under force", async () => {
    hoisted.getProposalById
      .mockResolvedValueOnce(withOldIntent({ votesFor: 5, votesAgainst: 5 }))
      .mockResolvedValue(withOldIntent({ status: "EXECUTED" }));
    mockDb({ voters: 20 });

    const { status } = await adoptConsensus({ force: true, note: "tie" });
    expect(status).toBe(200);
    const meta = JSON.parse(findCall("UPDATE proposals")![0].args[1] as string);
    expect(meta.adoptedOutcome).toBe("AGAINST");
  });
});
