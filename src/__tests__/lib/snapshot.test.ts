import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolderClass } from "@/types";
import type { SerializedHolder, SerializedSnapshotMetadata } from "@/lib/snapshot";

/**
 * Snapshot lookup tests isolate the in-memory binary-search logic by mocking
 * `node:fs/promises.readFile` with a small, deterministic, pre-sorted artifact.
 * The real implementation caches the artifact at module scope, so each test
 * resets modules to start from a clean (un-loaded) state.
 */

// Controlled fixture addresses (all lowercase, lexicographically sorted).
const A_WHALE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const A_DOLPHIN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const A_FISH = "0xcccccccccccccccccccccccccccccccccccccccc";
const A_ABSENT = "0x000000000000000000000000000000000000dead";

function buildArtifact() {
  const holderList: SerializedHolder[] = [
    {
      address: A_WHALE,
      rank: 1,
      balanceRaw: "3000000000000000000000000",
      balanceFormatted: "3,000,000.0",
      percentageOfSupply: 5.0,
      holderClass: HolderClass.WHALE,
    },
    {
      address: A_DOLPHIN,
      rank: 2,
      balanceRaw: "3000000000000000000000",
      balanceFormatted: "3,000.0",
      percentageOfSupply: 0.05,
      holderClass: HolderClass.DOLPHIN,
    },
    {
      address: A_FISH,
      rank: 3,
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1.0",
      percentageOfSupply: 0.001,
      holderClass: HolderClass.FISH,
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
      distribution: { whales: 1, dolphins: 1, fish: 1 },
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
    const h = await lookupHolder(A_FISH);
    expect(h?.holderClass).toBe(HolderClass.FISH);
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
  it("classifies >= 1.0% as WHALE", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(1.0)).toBe(HolderClass.WHALE);
    expect(classifyHolder(13.78)).toBe(HolderClass.WHALE);
  });

  it("classifies >= 0.01% and < 1.0% as DOLPHIN", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.01)).toBe(HolderClass.DOLPHIN);
    expect(classifyHolder(0.5)).toBe(HolderClass.DOLPHIN);
  });

  it("classifies < 0.01% as FISH", async () => {
    const { classifyHolder } = await import("@/lib/snapshot");
    expect(classifyHolder(0.009)).toBe(HolderClass.FISH);
    expect(classifyHolder(0)).toBe(HolderClass.FISH);
  });
});

describe("snapshot metadata accessors", () => {
  it("getSnapshotMetadata returns serialized metadata", async () => {
    const { getSnapshotMetadata } = await import("@/lib/snapshot");
    const m = await getSnapshotMetadata();
    expect(m.totalHolders).toBe(3);
    expect(m.distribution).toEqual({ whales: 1, dolphins: 1, fish: 1 });
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
      address: A_FISH,
      rank: 3,
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1.0",
      percentageOfSupply: 0.001,
      holderClass: HolderClass.FISH,
    });
    expect(typeof snap.balanceRaw).toBe("bigint");
    expect(snap.balanceRaw).toBe(10n ** 18n);
  });
});
