/**
 * Quadratic voting power (v2) — the model the community selected in the
 * Foundational Governance Election (foundational-2026, QUADRATIC 65.7%,
 * closed 2026-09-12).
 *
 * Spec as promised on the ballot (election-explanations.ts /
 * GOVERNANCE_MECHANICS.md §3.2):
 *
 *   voting_power = floor(sqrt(raw_token_balance / 10^18)) × multiplier
 *
 * with the multiplier fixed at 1.0. Worked examples shown to voters:
 * 100 → 10 · 10,000 → 100 · 1,000,000 → 1,000 · 100,000,000 → 10,000.
 *
 * Power is ALWAYS computed from the immutable snapshot balance at cast time —
 * never from the JWT session claim (which may be stale from login).
 */
import { loadArtifact } from "@/lib/snapshot";

const WEI_PER_TOKEN = 10n ** 18n;

/**
 * Quadratic voting power for a raw (wei) snapshot balance:
 * floor(sqrt(tokens)). Balances are frozen snapshot values; token counts fit
 * comfortably in a double (< 2^53), so Math.sqrt is exact to the unit.
 */
export function quadraticPower(balanceRaw: string | bigint): number {
  const tokens = BigInt(balanceRaw) / WEI_PER_TOKEN;
  return Math.floor(Math.sqrt(Number(tokens)));
}

let totalPowerCache: Promise<number> | null = null;

/**
 * Total quadratic voting power in the snapshot: the sum of every holder's
 * quadratic power. This is the QUORUM DENOMINATOR under quadratic voting —
 * quorum is the share of total quadratic power that voted, keeping the
 * configured quorum thresholds meaningful (under a raw-supply denominator
 * the sqrt-compressed numerator would make any quorum unreachable).
 *
 * Cached per process (the artifact is immutable).
 */
export function totalQuadraticPower(): Promise<number> {
  totalPowerCache ??= loadArtifact()
    .then((artifact) =>
      Object.values(artifact.holders).reduce(
        (sum, holder) => sum + quadraticPower(holder.balanceRaw),
        0,
      ),
    )
    .catch((err) => {
      // Do not cache failures — the next caller retries the artifact load.
      totalPowerCache = null;
      throw err;
    });
  return totalPowerCache;
}
