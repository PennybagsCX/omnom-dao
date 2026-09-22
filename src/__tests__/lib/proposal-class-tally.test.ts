import { describe, expect, it } from "vitest";

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
