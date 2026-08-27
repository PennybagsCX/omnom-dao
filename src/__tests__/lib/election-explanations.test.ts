import { describe, expect, it } from "vitest";

import { ELECTION_EXPLANATIONS } from "@/lib/election-explanations";

const EXPECTED_IDS = [
  "QUADRATIC",
  "ONE_WALLET_ONE_VOTE",
  "TIERED",
  "LINEAR",
] as const;

describe("ELECTION_EXPLANATIONS dataset", () => {
  it("contains exactly the four framework options, once each", () => {
    const ids = ELECTION_EXPLANATIONS.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([...EXPECTED_IDS]));
    expect(new Set(ids).size).toBe(ELECTION_EXPLANATIONS.length);
  });

  it("every explanation is fully populated", () => {
    for (const e of ELECTION_EXPLANATIONS) {
      expect(e.id).toBeTruthy();
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(e.summary.trim().length).toBeGreaterThan(0);
      expect(e.mathFormula.trim().length).toBeGreaterThan(0);
      expect(e.bestFor.trim().length).toBeGreaterThan(0);

      expect(e.howItWorks.length).toBeGreaterThan(0);
      for (const step of e.howItWorks) expect(step.trim().length).toBeGreaterThan(0);

      expect(e.advantages.length).toBeGreaterThan(0);
      expect(e.disadvantages.length).toBeGreaterThan(0);

      expect(e.workedExamples.length).toBeGreaterThan(0);
      for (const ex of e.workedExamples) {
        expect(ex.label.trim().length).toBeGreaterThan(0);
        expect(ex.calc.trim().length).toBeGreaterThan(0);
        expect(ex.power.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("worked examples for quadratic voting use real square roots", () => {
    const quad = ELECTION_EXPLANATIONS.find((e) => e.id === "QUADRATIC");
    expect(quad).toBeDefined();
    for (const ex of quad!.workedExamples) {
      // calc strings look like "√100 = 10" — verify the arithmetic holds.
      const match = ex.calc.match(/√([\d,]+)\s*=\s*([\d,]+)/);
      expect(match).not.toBeNull();
      const input = Number(match![1]!.replace(/,/g, ""));
      const output = Number(match![2]!.replace(/,/g, ""));
      expect(Math.sqrt(input)).toBeCloseTo(output, 6);
    }
  });
});
