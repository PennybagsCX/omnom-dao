import { beforeEach, describe, expect, it } from "vitest";

import { generateId, getMockStore, MOCK_HOLDERS, resetMockStore } from "@/lib/mock-data";

/**
 * The mock store is a globalThis singleton shared with mock-db; every test
 * starts from the seeded baseline.
 */

const ALL_TABLES = [
  "users",
  "proposals",
  "votes",
  "comments",
  "comment_reactions",
  "notifications",
  "delegations",
  "proposal_templates",
  "user_settings",
  "audit_log",
  "governance_votes",
  "governance_election",
  "governance_election_ballots",
  "governance_election_ballot_events",
] as const;

beforeEach(() => {
  resetMockStore();
});

describe("getMockStore", () => {
  it("returns the same process-wide singleton", () => {
    expect(getMockStore()).toBe(getMockStore());
  });

  it("exposes every table as an array", () => {
    const store = getMockStore() as unknown as Record<string, unknown>;
    for (const table of ALL_TABLES) {
      expect(Array.isArray(store[table])).toBe(true);
    }
  });

  it("seeds the core demo data", () => {
    const store = getMockStore();
    for (const table of [
      "users",
      "proposals",
      "votes",
      "comments",
      "notifications",
      "delegations",
      "proposal_templates",
      "user_settings",
    ] as const) {
      expect(store[table].length).toBeGreaterThan(0);
    }
  });

  it("starts the activity tables empty", () => {
    const store = getMockStore();
    expect(store.audit_log).toEqual([]);
    expect(store.comment_reactions).toEqual([]);
    expect(store.governance_votes).toEqual([]);
  });

  it("seeds deterministic row counts", () => {
    const store = getMockStore();
    expect(store.comments).toHaveLength(9);
    expect(store.notifications).toHaveLength(5);
    expect(store.delegations).toHaveLength(3);
    expect(store.proposal_templates).toHaveLength(6);
    expect(store.user_settings).toHaveLength(1);
  });

  it("covers all six proposal types with a template", () => {
    const types = getMockStore()
      .proposal_templates.map((t) => t.type)
      .sort();
    expect(types).toEqual([
      "CHAIN_SELECTION",
      "GENERAL",
      "GUIDELINE",
      "TECHNICAL",
      "TOKENOMICS_CHANGE",
      "TREASURY",
    ]);
  });

  it("seeds delegations in both active and pending states", () => {
    const statuses = new Set(getMockStore().delegations.map((d) => d.status));
    expect(statuses.has("active")).toBe(true);
    expect(statuses.has("pending")).toBe(true);
  });
});

describe("resetMockStore", () => {
  it("rebuilds a fresh store object with the seed intact", () => {
    const mutated = getMockStore();
    mutated.comments.length = 0;
    mutated.notifications.pop();
    expect(mutated.comments).toHaveLength(0);

    resetMockStore();

    const fresh = getMockStore();
    expect(fresh).not.toBe(mutated);
    expect(fresh.comments).toHaveLength(9);
    expect(fresh.notifications).toHaveLength(5);
  });
});

describe("generateId", () => {
  it("mirrors the lower(hex(randomblob(16))) schema default", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateId()).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("does not repeat across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

describe("MOCK_HOLDERS", () => {
  it("exposes the snapshot holder cohort with positive voting power", () => {
    const holders = Object.values(MOCK_HOLDERS);
    expect(holders.length).toBeGreaterThanOrEqual(8);
    for (const holder of holders) {
      expect(holder.address).toMatch(/^0x[0-9a-f]{40}$/);
      expect(holder.votingPower).toBeGreaterThan(0);
    }
  });

  it("includes the dev wallet used for local testing", () => {
    expect(Object.keys(MOCK_HOLDERS)).toEqual(
      expect.arrayContaining(["whale1", "dolphin1", "fish1", "devWallet"]),
    );
  });

  it("ranks whales above dolphins above fish", () => {
    const power = (key: keyof typeof MOCK_HOLDERS) => MOCK_HOLDERS[key].votingPower;
    expect(power("whale1")).toBeGreaterThan(power("dolphin1"));
    expect(power("dolphin1")).toBeGreaterThan(power("fish1"));
  });
});
