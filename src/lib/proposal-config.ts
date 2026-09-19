/**
 * Canonical per-type proposal defaults shared by the create and approve
 * routes, so the windows advertised in the create wizard are the windows
 * actually applied at approval. Mirrors the seeded per-type defaults in
 * GOVERNANCE_MECHANICS.md §8.3: default voting window 7 days — 14 days for
 * Chain Selection and Tokenomics Change.
 */

/** Fallback duration (7d) for proposal types missing from the map. */
export const FALLBACK_DURATION_HOURS = 168;

export const DEFAULT_DURATION_BY_TYPE: Record<string, number> = {
  CHAIN_SELECTION: 336,
  TOKENOMICS_CHANGE: 336,
  TREASURY: 168,
  GUIDELINE: 168,
  TECHNICAL: 168,
  GENERAL: 168,
};
