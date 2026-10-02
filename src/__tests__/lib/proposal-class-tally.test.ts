import { describe, expect, it, vi } from "vitest";

import {
  bucketProposalVotesByClass,
} from "@/lib/proposal-service";
import { HolderClass, VoteChoice } from "@/types";

const CLASSES = new Map<string, HolderClass | null>([
  ["0xwhale", HolderClass.WHALE],
  ["0xdolphin", HolderClass.DOLPHIN],
  ["0xunknown", null],
  ["0xfish", HolderClass.FISH], // legacy alias — must collapse to SEAHORSE
]);

const VOTES = [
  { voterAddress: "0xWHALE", choice: VoteChoice.FOR },
  { voterAddress: "0xdolphin", choice: VoteChoice.AGAINST },
  { voterAddress: "0xunknown", choice: VoteChoice.FOR },
  { voterAddress: "0xfish", choice: VoteChoice.ABSTAIN },
];

describe("bucketProposalVotesByClass", () => {
  it("buckets votes per class and collapses FISH/unknown into SEAHORSE", () => {
    const buckets = bucketProposalVotesByClass(VOTES, CLASSES);

    // WHALE: 1 FOR ballot.
    expect(buckets.get(HolderClass.WHALE)!.get(VoteChoice.FOR)).toBe(1);
    // DOLPHIN: 1 AGAINST ballot.
    expect(buckets.get(HolderClass.DOLPHIN)!.get(VoteChoice.AGAINST)).toBe(1);
    // Unknown + legacy FISH addresses land in SEAHORSE, not dropped.
    const seahorse = buckets.get(HolderClass.SEAHORSE)!;
    expect(seahorse.get(VoteChoice.FOR)).toBe(1);
    expect(seahorse.get(VoteChoice.ABSTAIN)).toBe(1);
    // Every class has a full zeroed byChoice map (no missing rows).
    for (const [, perChoice] of buckets) {
      expect([...perChoice.keys()].sort()).toEqual(
        [VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN].sort(),
      );
    }
  });

  it("sums every bucket back to the total vote count (no lost votes)", () => {
    const buckets = bucketProposalVotesByClass(VOTES, CLASSES);
    const total = [...buckets.values()].reduce(
      (sum, perChoice) => sum + [...perChoice.values()].reduce((s, n) => s + n, 0),
      0,
    );
    expect(total).toBe(VOTES.length);
  });

  it("handles an empty vote set without throwing", () => {
    const buckets = bucketProposalVotesByClass([], CLASSES);
    const total = [...buckets.values()].reduce(
      (sum, perChoice) => sum + [...perChoice.values()].reduce((s, n) => s + n, 0),
      0,
    );
    expect(total).toBe(0);
  });
});

/* ── tallyProposalByHolderClass — eligibility + turnout mapping ────────
   The DB (votes SELECT) and the snapshot lookup are mocked; the real
   SNAPSHOT.expectedDistribution constants drive eligibleCount, so this
   pins the turnout math end-to-end without a live database. */

const tallyHoisted = vi.hoisted(() => ({
  execute: vi.fn(),
  lookupHolderClasses: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { execute: tallyHoisted.execute } }));
vi.mock("@/lib/snapshot", () => ({
  lookupHolderClasses: tallyHoisted.lookupHolderClasses,
}));

describe("tallyProposalByHolderClass", () => {
  it("returns 7 classes with real eligibleCounts, turnout math, and per-choice shares", async () => {
    const { tallyProposalByHolderClass } = await import("@/lib/proposal-service");
    const { SNAPSHOT } = await import("@/lib/constants");

    tallyHoisted.execute.mockResolvedValue({
      rows: [
        { voter_address: "0xwhale", choice: "FOR" },
        { voter_address: "0xdolphin", choice: "FOR" },
        { voter_address: "0xdolphin", choice: "FOR" }, // vote rows per ballot change; dedup is the caller's concern — this asserts raw row bucketing
      ],
      columns: [],
      rowsAffected: 0,
      lastInsertRowid: 0n,
    });
    tallyHoisted.lookupHolderClasses.mockResolvedValue(
      new Map([
        ["0xwhale", HolderClass.WHALE],
        ["0xdolphin", HolderClass.DOLPHIN],
      ]),
    );

    const tallies = await tallyProposalByHolderClass("prop-1");

    // All 7 holder classes are always present, in canonical order.
    expect(tallies).toHaveLength(7);
    expect(tallies.map((t) => t.holderClass)).toEqual([
      HolderClass.KRAKEN,
      HolderClass.WHALE,
      HolderClass.DOLPHIN,
      HolderClass.SHARK,
      HolderClass.OCTOPUS,
      HolderClass.CRAB,
      HolderClass.SEAHORSE,
    ]);

    // eligibleCount comes straight from the snapshot distribution.
    for (const t of tallies) {
      const key = ({ KRAKEN: "krakens", WHALE: "whales", DOLPHIN: "dolphins", SHARK: "sharks", OCTOPUS: "octopuses", CRAB: "crabs", SEAHORSE: "seahorses" } as Record<string, string>)[t.holderClass] as keyof typeof SNAPSHOT.expectedDistribution;
      expect(t.eligibleCount).toBe(SNAPSHOT.expectedDistribution[key]);
    }

    // WHALE: 1 of 3 whales voted, all FOR → turnout 33.3%, FOR share 100%.
    const whale = tallies.find((t) => t.holderClass === HolderClass.WHALE)!;
    expect(whale.count).toBe(1);
    expect(whale.turnoutPercentage).toBeCloseTo((1 / whale.eligibleCount) * 100, 6);
    expect(whale.byChoice.find((b) => b.choice === VoteChoice.FOR)!.percentage).toBe(100);

    // DOLPHIN: 2 raw rows for 1 wallet — the count reflects the rows the
    // function receives (the votes table's UNIQUE constraint is what keeps
    // this at 1 ballot per wallet in production).
    const dolphin = tallies.find((t) => t.holderClass === HolderClass.DOLPHIN)!;
    expect(dolphin.count).toBe(2);
    expect(dolphin.byChoice.find((b) => b.choice === VoteChoice.FOR)!.count).toBe(2);
  });

  it("zeroes every class when the proposal has no votes", async () => {
    const { tallyProposalByHolderClass } = await import("@/lib/proposal-service");
    tallyHoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 0, lastInsertRowid: 0n });
    tallyHoisted.lookupHolderClasses.mockResolvedValue(new Map());

    const tallies = await tallyProposalByHolderClass("prop-empty");
    expect(tallies).toHaveLength(7);
    for (const t of tallies) {
      expect(t.count).toBe(0);
      expect(t.turnoutPercentage).toBe(0);
      expect(t.byChoice.every((b) => b.count === 0)).toBe(true);
    }
  });
});
