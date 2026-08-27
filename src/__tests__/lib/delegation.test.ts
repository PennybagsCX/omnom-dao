import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countIncomingDelegations,
  createDelegation,
  DELEGATION_TIMELOCK_MS,
  effectiveStatus,
  getDelegationInfo,
  getDelegationLeaderboard,
  getOutgoingDelegation,
  listIncomingDelegations,
  revokeDelegation,
} from "@/lib/delegation";
import { executeMock } from "@/lib/mock-db";
import { MOCK_HOLDERS, resetMockStore } from "@/lib/mock-data";
import { DelegationStatus, type Delegation } from "@/types";

/**
 * Delegation tests run against the real in-memory mock store (no mocks for
 * the data layer). Only `lookupHolder` is mocked — it resolves holders from
 * the external snapshot artifact, which is not available under vitest.
 * (vi.mock is hoisted above the imports by Vitest's transform.)
 */
const lookupHolderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/snapshot", () => ({
  lookupHolder: lookupHolderMock,
  // Mirrors the real helper's contract: lowercase keys, null for non-holders.
  lookupHolderClasses: async (addresses: string[]) => {
    const unique = [...new Set(addresses.map((a: string) => a.trim().toLowerCase()))];
    const map = new Map<string, unknown>();
    for (const a of unique) {
      const holder = await lookupHolderMock(a);
      map.set(a, holder?.holderClass ?? null);
    }
    return map;
  },
}));

// Deterministic seed rows (mock-data.ts):
//   dlg-1 active  fish2    → whale1
//   dlg-2 pending fish3    → dolphin1 (effective ~22h from seed time)
//   dlg-3 active  dolphin2 → whale2
const FISH2 = MOCK_HOLDERS.fish2.address;
const FISH3 = MOCK_HOLDERS.fish3.address;
const WHALE1 = MOCK_HOLDERS.whale1.address;
const WHALE2 = MOCK_HOLDERS.whale2.address;
const DOLPHIN1 = MOCK_HOLDERS.dolphin1.address;
const DOLPHIN2 = MOCK_HOLDERS.dolphin2.address;

/** Stub lookupHolder with address → raw wei balance entries. */
function stubHolders(balances: Record<string, string>): void {
  lookupHolderMock.mockImplementation(async (address: string) =>
    address in balances ? { balanceRaw: balances[address]! } : null,
  );
}

beforeEach(() => {
  resetMockStore();
  lookupHolderMock.mockReset();
  lookupHolderMock.mockResolvedValue(null);
});

describe("getOutgoingDelegation", () => {
  it("returns null when the address has no delegation", async () => {
    expect(await getOutgoingDelegation(MOCK_HOLDERS.devWallet.address)).toBeNull();
  });

  it("returns the active outgoing delegation mapped to camelCase", async () => {
    const d = await getOutgoingDelegation(FISH2);
    expect(d).toMatchObject({
      id: "dlg-1",
      delegatorAddress: FISH2,
      delegateeAddress: WHALE1,
      status: DelegationStatus.ACTIVE,
      revokedAt: null,
    });
    expect(d!.createdAt).toBe("2026-06-12T10:00:00.000Z");
    expect(d!.effectiveAt).toBe("2026-06-13T10:00:00.000Z");
  });

  it("includes pending delegations", async () => {
    const d = await getOutgoingDelegation(FISH3);
    expect(d).toMatchObject({
      id: "dlg-2",
      status: DelegationStatus.PENDING,
      delegateeAddress: DOLPHIN1,
    });
  });

  it("normalizes the address to lowercase", async () => {
    expect(await getOutgoingDelegation(FISH2.toUpperCase())).not.toBeNull();
  });

  it("stops returning the delegation once it is revoked", async () => {
    await revokeDelegation(FISH2);
    expect(await getOutgoingDelegation(FISH2)).toBeNull();
  });
});

describe("countIncomingDelegations", () => {
  it("counts active and pending incoming delegations", async () => {
    expect(await countIncomingDelegations(WHALE1)).toBe(1); // dlg-1 active
    expect(await countIncomingDelegations(DOLPHIN1)).toBe(1); // dlg-2 pending counts
    expect(await countIncomingDelegations(MOCK_HOLDERS.devWallet.address)).toBe(0);
  });
});

describe("listIncomingDelegations", () => {
  it("lists incoming delegations for a delegatee", async () => {
    const list = await listIncomingDelegations(WHALE1);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "dlg-1", delegatorAddress: FISH2 });
  });

  it("orders by created_at descending and honors the limit", async () => {
    await executeMock({
      sql: "INSERT INTO delegations (id, delegator_address, delegatee_address, status, created_at, effective_at) VALUES ('dlg-4', ?, ?, 'active', '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z')",
      args: [MOCK_HOLDERS.fish1.address, WHALE1],
    });
    expect(await listIncomingDelegations(WHALE1)).toHaveLength(2);
    expect((await listIncomingDelegations(WHALE1))[0]!.id).toBe("dlg-4");
    expect(await listIncomingDelegations(WHALE1, 1)).toHaveLength(1);
  });
});

describe("getDelegationInfo", () => {
  it("combines outgoing, incoming count, and incoming list", async () => {
    const info = await getDelegationInfo(WHALE1);
    expect(info.outgoing).toBeNull(); // whale1 delegates to nobody
    expect(info.incomingCount).toBe(1);
    expect(info.incomingList[0]).toMatchObject({ id: "dlg-1" });
  });

  it("reports an outgoing delegation with no incoming", async () => {
    const info = await getDelegationInfo(FISH2);
    expect(info.outgoing).toMatchObject({ id: "dlg-1" });
    expect(info.incomingCount).toBe(0);
    expect(info.incomingList).toEqual([]);
  });
});

describe("getDelegationLeaderboard", () => {
  it("sums delegator snapshot power per delegatee and ranks by power", async () => {
    stubHolders({
      [FISH2]: "2000000000000000000000", // 2,000 tokens
      [DOLPHIN2]: "5000000000000000000000", // 5,000 tokens
    });
    const board = await getDelegationLeaderboard();
    expect(board.map((e) => e.delegateeAddress)).toEqual([WHALE2, WHALE1]);
    expect(board[0]).toMatchObject({ delegateeAddress: WHALE2, incomingCount: 1, totalDelegatedPower: 5000 });
    expect(board[1]).toMatchObject({ delegateeAddress: WHALE1, incomingCount: 1, totalDelegatedPower: 2000 });
  });

  it("treats delegators missing from the snapshot as zero power", async () => {
    stubHolders({ [DOLPHIN2]: "1000000000000000000000" });
    const board = await getDelegationLeaderboard();
    const whale1 = board.find((e) => e.delegateeAddress === WHALE1)!;
    expect(whale1.incomingCount).toBe(1);
    expect(whale1.totalDelegatedPower).toBe(0);
  });

  it("ignores pending delegations", async () => {
    stubHolders({ [FISH3]: "990000000000000000000000" }); // would top the board
    const board = await getDelegationLeaderboard();
    expect(board.find((e) => e.delegateeAddress === DOLPHIN1)).toBeUndefined();
  });

  it("trims to the requested limit after re-ranking", async () => {
    stubHolders({ [FISH2]: "1000000000000000000", [DOLPHIN2]: "2000000000000000000" });
    expect(await getDelegationLeaderboard(1)).toHaveLength(1);
    expect((await getDelegationLeaderboard(1))[0]!.delegateeAddress).toBe(WHALE2);
  });
});

describe("createDelegation", () => {
  it("creates a pending delegation effective after the 24h time-lock", async () => {
    const before = Date.now();
    const { delegation, replaced } = await createDelegation(
      MOCK_HOLDERS.fish1.address,
      WHALE2,
    );
    expect(replaced).toBe(false);
    expect(delegation.status).toBe(DelegationStatus.PENDING);
    expect(delegation.delegatorAddress).toBe(MOCK_HOLDERS.fish1.address);
    expect(delegation.delegateeAddress).toBe(WHALE2);
    expect(delegation.revokedAt).toBeNull();
    expect(delegation.id).toMatch(/^[0-9a-f]{32}$/);

    const effDelta = Date.parse(delegation.effectiveAt) - (before + DELEGATION_TIMELOCK_MS);
    expect(Math.abs(effDelta)).toBeLessThan(60_000);

    // Persisted and visible via the outgoing lookup.
    expect(await getOutgoingDelegation(MOCK_HOLDERS.fish1.address)).toMatchObject({
      id: delegation.id,
      status: DelegationStatus.PENDING,
    });
  });

  it("revokes a superseded delegation and reports replaced=true", async () => {
    const { delegation, replaced } = await createDelegation(FISH2, DOLPHIN2);
    expect(replaced).toBe(true);

    // The old row is revoked with a timestamp...
    const oldRow = (await executeMock({
      sql: "SELECT status, revoked_at FROM delegations WHERE id = ?",
      args: ["dlg-1"],
    })).rows[0]!;
    expect(oldRow.status).toBe("revoked");
    expect(oldRow.revoked_at).toBeTruthy();

    // ...and the new pending delegation replaced it as the outgoing one.
    expect(await getOutgoingDelegation(FISH2)).toMatchObject({
      id: delegation.id,
      delegateeAddress: DOLPHIN2,
      status: DelegationStatus.PENDING,
    });
  });
});

describe("revokeDelegation", () => {
  it("returns null when there is nothing to revoke", async () => {
    expect(await revokeDelegation(MOCK_HOLDERS.devWallet.address)).toBeNull();
  });

  it("revokes an active delegation instantly and stamps revoked_at", async () => {
    const before = Date.now();
    const revoked = await revokeDelegation(FISH2);
    expect(revoked).toMatchObject({ id: "dlg-1", status: DelegationStatus.REVOKED });
    expect(Date.parse(revoked!.revokedAt!)).toBeGreaterThanOrEqual(before - 1_000);

    const row = (await executeMock({
      sql: "SELECT status, revoked_at FROM delegations WHERE id = 'dlg-1'",
    })).rows[0]!;
    expect(row.status).toBe("revoked");
    expect(row.revoked_at).toBeTruthy();
    expect(await getOutgoingDelegation(FISH2)).toBeNull();
  });

  it("revokes a pending delegation too", async () => {
    const revoked = await revokeDelegation(FISH3);
    expect(revoked).toMatchObject({ id: "dlg-2", status: DelegationStatus.REVOKED });
  });
});

describe("effectiveStatus", () => {
  const pendingRow: Delegation = {
    id: "x",
    delegatorAddress: FISH2,
    delegateeAddress: WHALE1,
    status: DelegationStatus.PENDING,
    createdAt: "2026-01-01T00:00:00.000Z",
    effectiveAt: "2026-01-02T00:00:00.000Z",
    revokedAt: null,
  };

  it("keeps REVOKED terminal regardless of elapsed time", () => {
    const row = { ...pendingRow, status: DelegationStatus.REVOKED, revokedAt: "2026-01-01T00:00:00.000Z" };
    expect(effectiveStatus(row, Date.parse("2027-01-01T00:00:00.000Z"))).toBe(
      DelegationStatus.REVOKED,
    );
  });

  it("stays PENDING before effective_at", () => {
    expect(effectiveStatus(pendingRow, Date.parse("2026-01-01T12:00:00.000Z"))).toBe(
      DelegationStatus.PENDING,
    );
  });

  it("flips to ACTIVE at/after effective_at", () => {
    expect(effectiveStatus(pendingRow, Date.parse("2026-01-02T00:00:00.000Z"))).toBe(
      DelegationStatus.ACTIVE,
    );
    expect(effectiveStatus(pendingRow, Date.parse("2026-06-01T00:00:00.000Z"))).toBe(
      DelegationStatus.ACTIVE,
    );
  });

  it("treats an unparseable effective_at as still pending", () => {
    expect(effectiveStatus({ ...pendingRow, effectiveAt: "not-a-date" })).toBe(
      DelegationStatus.PENDING,
    );
  });
});
