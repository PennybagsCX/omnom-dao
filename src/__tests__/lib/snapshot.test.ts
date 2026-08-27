import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolderClass } from "@/types";
import type {
  EnrichedSnapshotHolder,
  SerializedHolder,
  SerializedSnapshotMetadata,
} from "@/lib/snapshot";

/**
 * Snapshot lookup tests isolate the in-memory binary-search logic by mocking
 * `node:fs/promises.readFile` with a small, deterministic, pre-sorted artifact.
 * The real implementation caches the artifact at module scope, so each test
 * resets modules to start from a clean (un-loaded) state.
 */

// Controlled fixture addresses (all lowercase, lexicographically sorted).
const A_WHALE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const A_DOLPHIN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const A_SEAHORSE = "0xcccccccccccccccccccccccccccccccccccccccc";
const A_ABSENT = "0x000000000000000000000000000000000000dead";

function buildArtifact() {
  const holderList: EnrichedSnapshotHolder[] = [
    {
      address: A_WHALE,
      rank: 1,
      balanceRaw: "3000000000000000000000000",
      balanceFormatted: "3,000,000.0",
      percentageOfSupply: 5.0,
      holderClass: HolderClass.WHALE,
      bestRank: 1,
      snapshotCount: 5,
      snapshots: ["weekly-2026-07-28", "weekly-2026-08-08"],
      firstSeen: "2026-06-07",
      latestBalanceRaw: "2500000000000000000000000",
      latestBalanceFormatted: "2,500,000.0",
      latestPercentageOfSupply: 4.16,
      latestRank: 1,
      currentlyHolds: true,
    },
    {
      address: A_DOLPHIN,
      rank: 2,
      balanceRaw: "3000000000000000000000",
      balanceFormatted: "3,000.0",
      percentageOfSupply: 0.05,
      holderClass: HolderClass.DOLPHIN,
      bestRank: 2,
      snapshotCount: 3,
      snapshots: ["weekly-2026-07-14"],
      firstSeen: "2026-06-07",
      // Dropped wallet: absent from the latest snapshot, explicit zero balance.
      latestBalanceRaw: "0",
      latestBalanceFormatted: "0",
      latestPercentageOfSupply: 0,
      latestRank: null,
      currentlyHolds: false,
    },
    {
      address: A_SEAHORSE,
      rank: 3,
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1.0",
      percentageOfSupply: 0.00001,
      holderClass: HolderClass.SEAHORSE,
      bestRank: 3,
      snapshotCount: 2,
      snapshots: ["weekly-2026-08-08"],
      firstSeen: "2026-07-01",
      latestBalanceRaw: "1000000000000000000",
      latestBalanceFormatted: "1.0",
      latestPercentageOfSupply: 0.00001,
      latestRank: 2,
      currentlyHolds: true,
    },
  ];
  const holders = Object.fromEntries(holderList.map((h) => [h.address, h]));
  return {
    sortedAddresses: holderList.map((h) => h.address),
    holders,
    metadata: {
      blockNumber: 59_922_100,
      timestamp: "2026-06-07T23:59:58.000Z",
      totalHolders: holderList.length,
      totalSupply: "60000000000000000000000000",
      burnedSupply: "0",
      contractAddress: "0xe3fcA919883950c5cD468156392a6477Ff5d18de",
      csvHash: "abc123",
      distribution: { krakens: 0, whales: 1, dolphins: 1, sharks: 0, octopuses: 0, crabs: 0, seahorses: 1 },
    } satisfies SerializedSnapshotMetadata,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.doMock("node:fs/promises", () => ({
    readFile: vi.fn(async () => JSON.stringify(buildArtifact())),
  }));
});

describe("lookupHolder (binary search)", () => {
  it("finds an existing address and returns its record", async () => {
    const { lookupHolder } = await import("@/lib/snapshot");
    const h = await lookupHolder(A_WHALE);
    expect(h).not.toBeNull();
    expect(h!.address).toBe(A_WHALE);
    expect(h!.percentageOfSupply).toBe(5.0);
    expect(h!.holderClass).toBe(HolderClass.WHALE);
  });

  it("returns null for a non-existent address", async () => {
    const { lookupHolder } = await import("@/lib/snapshot");
    expect(await lookupHolder(A_ABSENT)).toBeNull();
  });

  it("matches case-insensitively (uppercase input)", async () => {
    const { lookupHolder } = await import("@/lib/snapshot");
    const upper = A_DOLPHIN.toUpperCase();
    const h = await lookupHolder(upper);
    expect(h).not.toBeNull();
    expect(h!.address).toBe(A_DOLPHIN);
  });

  it("returns the correct record for the middle element", async () => {
    const { lookupHolder } = await import("@/lib/snapshot");
    const h = await lookupHolder(A_SEAHORSE);
    expect(h?.holderClass).toBe(HolderClass.SEAHORSE);
  });

  it("completes a lookup in under 1ms after warm-up", async () => {
    const { lookupHolder } = await import("@/lib/snapshot");
    // Warm-up (first lookup triggers the artifact load).
    await lookupHolder(A_WHALE);
    const start = performance.now();
    await lookupHolder(A_WHALE);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1);
  });
});

describe("enrichHolder / lookupEnrichedHolder", () => {
  it("attaches class config and isWhale flag", async () => {
    const { lookupEnrichedHolder, enrichHolder } = await import("@/lib/snapshot");
    const enriched = await lookupEnrichedHolder(A_WHALE);
    expect(enriched).not.toBeNull();
    expect(enriched!.isWhale).toBe(true);
    expect(enriched!.classConfig.label).toBe("Whale");

    // enrichHolder directly
    const base: SerializedHolder = {
      address: A_DOLPHIN,
      rank: 2,
      balanceRaw: "1",
      balanceFormatted: "1",
      percentageOfSupply: 0.05,
      holderClass: HolderClass.DOLPHIN,
    };
    expect(enrichHolder(base).classConfig.emoji).toBe("🐬");
  });
});

describe("classifyHolder thresholds", () => {
  it("classifies >= 10% as KRAKEN", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(10.0)).toBe(HolderClass.KRAKEN);
    expect(classifyHolder(13.78)).toBe(HolderClass.KRAKEN);
    // Just below KRAKEN threshold should be WHALE
    expect(classifyHolder(9.999)).toBe(HolderClass.WHALE);
  });

  it("classifies >= 1% and < 10% as WHALE", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(1.0)).toBe(HolderClass.WHALE);
    expect(classifyHolder(5.0)).toBe(HolderClass.WHALE);
    // Just below WHALE threshold should be DOLPHIN
    expect(classifyHolder(0.999)).toBe(HolderClass.DOLPHIN);
  });

  it("classifies >= 0.1% and < 1% as DOLPHIN", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.1)).toBe(HolderClass.DOLPHIN);
    expect(classifyHolder(0.5)).toBe(HolderClass.DOLPHIN);
    // Just below DOLPHIN threshold should be SHARK
    expect(classifyHolder(0.0999)).toBe(HolderClass.SHARK);
  });

  it("classifies >= 0.01% and < 0.1% as SHARK", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.01)).toBe(HolderClass.SHARK);
    expect(classifyHolder(0.05)).toBe(HolderClass.SHARK);
    // Just below SHARK threshold should be OCTOPUS
    expect(classifyHolder(0.00999)).toBe(HolderClass.OCTOPUS);
  });

  it("classifies >= 0.001% and < 0.01% as OCTOPUS", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.001)).toBe(HolderClass.OCTOPUS);
    expect(classifyHolder(0.009)).toBe(HolderClass.OCTOPUS);
    // Just below OCTOPUS threshold should be CRAB
    expect(classifyHolder(0.000999)).toBe(HolderClass.CRAB);
  });

  it("classifies >= 0.0001% and < 0.001% as CRAB", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.0001)).toBe(HolderClass.CRAB);
    expect(classifyHolder(0.0005)).toBe(HolderClass.CRAB);
    // Just below CRAB threshold should be SEAHORSE
    expect(classifyHolder(0.0000999)).toBe(HolderClass.SEAHORSE);
  });

  it("classifies < 0.0001% as SEAHORSE", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0)).toBe(HolderClass.SEAHORSE);
    expect(classifyHolder(0.00001)).toBe(HolderClass.SEAHORSE);
  });
});

describe("holder sorting (listHoldersByRank)", () => {
  it("defaults to rank ascending when no sort options are given", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank();
    expect(holders.map((h) => h.rank)).toEqual([1, 2, 3]);
  });

  it("sorts by wei balance via BigInt — desc lists the largest holder first", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank({ sort: "balance", direction: "desc" });
    // 3M > 3k > 1 token — magnitudes a numeric compare could never corrupt.
    expect(holders.map((h) => h.address)).toEqual([A_WHALE, A_DOLPHIN, A_SEAHORSE]);
  });

  it("sorts by address alphabetically", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank({ sort: "address", direction: "asc" });
    expect(holders.map((h) => h.address)).toEqual([A_WHALE, A_DOLPHIN, A_SEAHORSE]);
    const reversed = await listHoldersByRank({ sort: "address", direction: "desc" });
    expect(reversed.map((h) => h.address)).toEqual([A_SEAHORSE, A_DOLPHIN, A_WHALE]);
  });

  it("sorts by class tier — ascending lists the highest tiers first", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank({ sort: "class", direction: "asc" });
    expect(holders.map((h) => h.holderClass)).toEqual([
      HolderClass.WHALE,
      HolderClass.DOLPHIN,
      HolderClass.SEAHORSE,
    ]);
  });

  it("sorts by latest balance, sinking dropped wallets (explicit zero) to the end", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank({ sort: "latestBalance", direction: "desc" });
    expect(holders.map((h) => h.address)).toEqual([A_WHALE, A_SEAHORSE, A_DOLPHIN]);
  });

  it("sorts by holds with a deterministic rank tie-break for equal flags", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const desc = await listHoldersByRank({ sort: "holds", direction: "desc" });
    // WHALE + SEAHORSE both hold (tie broken by rank 1 < 3), DOLPHIN dropped.
    expect(desc.map((h) => h.address)).toEqual([A_WHALE, A_SEAHORSE, A_DOLPHIN]);
    const asc = await listHoldersByRank({ sort: "holds", direction: "asc" });
    expect(asc.map((h) => h.address)).toEqual([A_DOLPHIN, A_WHALE, A_SEAHORSE]);
  });

  it("reverses rank order under desc and paginates the sorted corpus", async () => {
    const { listHoldersByRank } = await import("@/lib/snapshot");
    const holders = await listHoldersByRank({ sort: "rank", direction: "desc", limit: 2 });
    expect(holders.map((h) => h.rank)).toEqual([3, 2]);
    const page2 = await listHoldersByRank({ sort: "rank", direction: "desc", offset: 2, limit: 2 });
    expect(page2.map((h) => h.rank)).toEqual([1]);
  });

  it("applies sorting to prefix matches while the legacy default stays address-ordered", async () => {
    const { searchHoldersByAddressPrefix } = await import("@/lib/snapshot");
    const legacy = await searchHoldersByAddressPrefix("0x");
    expect(legacy.map((h) => h.address)).toEqual([A_WHALE, A_DOLPHIN, A_SEAHORSE]);
    const sorted = await searchHoldersByAddressPrefix("0x", 10, "balance", "desc");
    expect(sorted.map((h) => h.address)).toEqual([A_WHALE, A_DOLPHIN, A_SEAHORSE]);
    const holdsSorted = await searchHoldersByAddressPrefix("0x", 10, "holds", "asc");
    expect(holdsSorted.map((h) => h.address)).toEqual([A_DOLPHIN, A_WHALE, A_SEAHORSE]);
  });
});

describe("enrichment fields survive lookups", () => {
  it("lookupEnrichedSnapshotHolder exposes latest-balance and holds data", async () => {
    const { lookupEnrichedSnapshotHolder } = await import("@/lib/snapshot");
    const holder = await lookupEnrichedSnapshotHolder(A_DOLPHIN);
    expect(holder?.currentlyHolds).toBe(false);
    expect(holder?.latestBalanceRaw).toBe("0");
    expect(holder?.latestRank).toBeNull();
    expect(holder?.snapshotCount).toBe(3);
    expect(holder?.firstSeen).toBe("2026-06-07");
  });
});

describe("snapshot metadata accessors", () => {
  it("getSnapshotMetadata returns serialized metadata", async () => {
    const { getSnapshotMetadata } = await import("@/lib/snapshot");
    const m = await getSnapshotMetadata();
    expect(m.totalHolders).toBe(3);
    expect(m.distribution).toEqual({ krakens: 0, whales: 1, dolphins: 1, sharks: 0, octopuses: 0, crabs: 0, seahorses: 1 });
  });

  it("getSnapshotMetadataTyped converts supplies to bigint", async () => {
    const { getSnapshotMetadataTyped } = await import("@/lib/snapshot");
    const m = await getSnapshotMetadataTyped();
    expect(typeof m.totalSupply).toBe("bigint");
    expect(m.totalSupply).toBe(60_000_000n * 10n ** 18n);
  });

  it("toHolderSnapshot converts balanceRaw to bigint", async () => {
    const { toHolderSnapshot } = await import("@/lib/snapshot");
    const snap = toHolderSnapshot({
      address: A_SEAHORSE,
      rank: 3,
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1.0",
      percentageOfSupply: 0.00001,
      holderClass: HolderClass.SEAHORSE,
    });
    expect(typeof snap.balanceRaw).toBe("bigint");
    expect(snap.balanceRaw).toBe(10n ** 18n);
  });
});
