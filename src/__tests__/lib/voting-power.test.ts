import { describe, expect, it } from "vitest";

/**
 * Quadratic voting power (v2) — unit tests.
 *
 * The worked examples are the EXACT values shown to voters on the election
 * ballot (election-explanations.ts); they are the contract the community
 * voted on.
 */
import { quadraticPower } from "@/lib/voting-power";

const E18 = 10n ** 18n;

function wei(tokens: bigint | number): string {
  return (BigInt(tokens) * E18).toString();
}

describe("quadraticPower", () => {
  it("matches the worked examples shown on the election ballot", () => {
    // 100 → 10 · 10,000 → 100 · 1,000,000 → 1,000 · 100,000,000 → 10,000
    expect(quadraticPower(wei(100))).toBe(10);
    expect(quadraticPower(wei(10_000))).toBe(100);
    expect(quadraticPower(wei(1_000_000))).toBe(1_000);
    expect(quadraticPower(wei(100_000_000))).toBe(10_000);
  });

  it("floors fractional roots", () => {
    // √42 ≈ 6.48 -> 6 (the value pinned by the vote-route integration test)
    expect(quadraticPower(wei(42))).toBe(6);
    // √2 ≈ 1.41 -> 1
    expect(quadraticPower(wei(2))).toBe(1);
  });

  it("gives sub-token balances zero power", () => {
    expect(quadraticPower((1n * E18 - 1n).toString())).toBe(0); // 0.999… tokens
    expect(quadraticPower("0")).toBe(0);
  });

  it("accepts bigint input as well as wei strings", () => {
    expect(quadraticPower(BigInt(wei(10_000)))).toBe(100);
  });

  it("compresses the whale-to-fish ratio (the point of quadratic voting)", () => {
    // A holder with 10,000× the tokens gets 100× the power, not 10,000×.
    const big = quadraticPower(wei(1_000_000)); // √ = 1,000
    const small = quadraticPower(wei(100)); // √ = 10
    expect(big / small).toBe(100);
  });
});
