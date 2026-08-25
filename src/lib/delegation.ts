import { db } from "@/lib/db";
import { lookupHolder } from "@/lib/snapshot";
import {
  DelegationStatus,
  type Delegation,
  type DelegationInfo,
  type DelegationLeaderboardEntry,
} from "@/types";

/**
 * Delegation data-access + business-logic service.
 *
 * Implements GOVERNANCE_MECHANICS.md §11 — Delegation System:
 *  - Any verified holder may delegate 100% of their voting power to another
 *    verified holder. Partial delegation is NOT supported in v1.
 *  - Delegators may override delegation and vote directly per-proposal.
 *  - New delegations are "pending" for a 24h time-lock before "active".
 *  - Revocation is instant.
 *  - Max 500 incoming delegations per delegatee.
 *
 * IMPORTANT (v1): Delegation is informational / trackable. It does NOT
 * automatically boost the delegatee's recorded voting power. Each holder
 * still votes individually and their vote is weighted by their own frozen
 * snapshot balance (see votes route). The delegation records who represents
 * whom for transparency and future protocol upgrades.
 */

/** 24-hour time-lock (ms) before a new delegation becomes effective. */
export const DELEGATION_TIMELOCK_MS = 24 * 60 * 60 * 1000;

/** Maximum incoming delegations a single delegatee may hold. */
export const MAX_INCOMING_DELEGATIONS = 500;

// ─────────────────────────────────────────────────────────────
// Row mapping
// ─────────────────────────────────────────────────────────────

const DELEGATION_COLS =
  "id, delegator_address, delegatee_address, status, created_at, effective_at, revoked_at";

function rowToDelegation(row: Record<string, unknown>): Delegation {
  return {
    id: row.id as string,
    delegatorAddress: row.delegator_address as string,
    delegateeAddress: row.delegatee_address as string,
    status: row.status as DelegationStatus,
    createdAt: row.created_at as string,
    effectiveAt: row.effective_at as string,
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Public lookups
// ─────────────────────────────────────────────────────────────

/**
 * Get the current active-or-pending outgoing delegation for a delegator
 * address (one per delegator — enforced by UNIQUE(delegator_address)).
 */
export async function getOutgoingDelegation(
  delegatorAddress: string,
): Promise<Delegation | null> {
  const res = await db.execute({
    sql: `SELECT ${DELEGATION_COLS} FROM delegations
          WHERE delegator_address = ? AND status IN ('active', 'pending')
          LIMIT 1`,
    args: [delegatorAddress.toLowerCase()],
  });
  if (res.rows.length === 0) return null;
  return rowToDelegation(res.rows[0] as unknown as Record<string, unknown>);
}

/**
 * Count active + pending incoming delegations for a delegatee address.
 * Used to enforce the 500-delegation cap.
 */
export async function countIncomingDelegations(delegateeAddress: string): Promise<number> {
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM delegations WHERE delegatee_address = ? AND status IN ('active', 'pending')",
    args: [delegateeAddress.toLowerCase()],
  });
  return Number(res.rows[0]?.cnt ?? 0);
}

/**
 * List active + pending incoming delegations for a delegatee.
 * Returns the most recent entries (capped at a sane limit for the public API).
 */
export async function listIncomingDelegations(
  delegateeAddress: string,
  limit = 100,
): Promise<Delegation[]> {
  const res = await db.execute({
    sql: `SELECT ${DELEGATION_COLS} FROM delegations
          WHERE delegatee_address = ? AND status IN ('active', 'pending')
          ORDER BY created_at DESC LIMIT ?`,
    args: [delegateeAddress.toLowerCase(), limit],
  });
  return res.rows.map((r) => rowToDelegation(r as unknown as Record<string, unknown>));
}

/**
 * Full delegation snapshot for an address: outgoing (if any), incoming count,
 * and the list of delegators who delegate TO this address.
 */
export async function getDelegationInfo(address: string): Promise<DelegationInfo> {
  const normalized = address.toLowerCase();
  const [outgoing, incomingList] = await Promise.all([
    getOutgoingDelegation(normalized),
    listIncomingDelegations(normalized, 100),
  ]);
  return {
    outgoing,
    incomingCount: incomingList.length,
    incomingList,
  };
}

/**
 * Public leaderboard of top delegates by summed incoming voting power.
 * Joins delegations against the snapshot to sum the delegators' balances.
 *
 * NOTE: Voting power is informational — the sum reflects the delegators'
 * snapshot balances, not the delegatee's actual recorded vote weight.
 */
export async function getDelegationLeaderboard(
  limit = 20,
): Promise<DelegationLeaderboardEntry[]> {
  // Pull all active delegator → delegatee pairs, then resolve voting power
  // in-memory from the snapshot (the snapshot is the immutable source of
  // truth for balances; the delegations table only stores addresses).
  const res = await db.execute({
    sql: `SELECT delegatee_address, COUNT(*) AS cnt
          FROM delegations
          WHERE status = 'active'
          GROUP BY delegatee_address
          ORDER BY cnt DESC
          LIMIT ?`,
    args: [limit * 5], // over-fetch; power re-ranks after lookup
  });

  const entries: DelegationLeaderboardEntry[] = [];
  for (const row of res.rows) {
    const delegateeAddress = row.delegatee_address as string;
    // Fetch all active delegators to this delegatee to sum their power.
    const delegatorsRes = await db.execute({
      sql: "SELECT delegator_address FROM delegations WHERE delegatee_address = ? AND status = 'active'",
      args: [delegateeAddress],
    });
    let totalDelegatedPower = 0;
    for (const d of delegatorsRes.rows) {
      const holder = await lookupHolder(d.delegator_address as string);
      if (holder) {
        // Use the raw wei balance to avoid precision loss from the pre-rounded
        // balanceFormatted string (C3.2).
        totalDelegatedPower += Number(holder.balanceRaw) / 1e18;
      }
    }
    entries.push({
      delegateeAddress,
      incomingCount: Number(row.cnt),
      totalDelegatedPower,
    });
  }

  // Re-rank by summed voting power (the spec: "top delegates by incoming
  // voting power") and trim to the requested limit.
  entries.sort((a, b) => b.totalDelegatedPower - a.totalDelegatedPower);
  return entries.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

/** Outcome of a create-delegation attempt. */
export interface CreateDelegationResult {
  delegation: Delegation;
  /** Whether a prior active delegation was revoked to make room for this one. */
  replaced: boolean;
}

/**
 * Create a new delegation (status "pending", effective in 24h).
 *
 * If the delegator already has an active or pending delegation, it is revoked
 * first (superseded). The UNIQUE(delegator_address) constraint is the backstop.
 *
 * Pre-conditions (validated by the caller, typically the route handler):
 *  - delegator != delegatee
 *  - both addresses are verified snapshot holders
 *  - delegatee has < MAX_INCOMING_DELEGATIONS incoming
 */
export async function createDelegation(
  delegatorAddress: string,
  delegateeAddress: string,
): Promise<CreateDelegationResult> {
  const delegator = delegatorAddress.toLowerCase();
  const delegatee = delegateeAddress.toLowerCase();

  // Revoke any existing active/pending delegation from this delegator first.
  let replaced = false;
  const existing = await getOutgoingDelegation(delegator);
  if (existing) {
    replaced = true;
    await db.execute({
      sql: "UPDATE delegations SET status = 'revoked', revoked_at = datetime('now') WHERE id = ?",
      args: [existing.id],
    });
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const effectiveAt = new Date(now.getTime() + DELEGATION_TIMELOCK_MS).toISOString();

  const insert = await db.execute({
    sql: `INSERT INTO delegations
            (delegator_address, delegatee_address, status, created_at, effective_at)
          VALUES (?, ?, 'pending', ?, ?)
          RETURNING ${DELEGATION_COLS}`,
    args: [delegator, delegatee, createdAt, effectiveAt],
  });

  const delegation = rowToDelegation(
    insert.rows[0] as unknown as Record<string, unknown>,
  );
  return { delegation, replaced };
}

/**
 * Revoke the delegator's active or pending delegation instantly.
 * Returns the revoked delegation, or null if none existed.
 */
export async function revokeDelegation(
  delegatorAddress: string,
): Promise<Delegation | null> {
  const existing = await getOutgoingDelegation(delegatorAddress.toLowerCase());
  if (!existing) return null;

  await db.execute({
    sql: "UPDATE delegations SET status = 'revoked', revoked_at = datetime('now') WHERE id = ?",
    args: [existing.id],
  });

  return {
    ...existing,
    status: DelegationStatus.REVOKED,
    revokedAt: new Date().toISOString(),
  };
}

/**
 * Resolve the current "effective" status of a delegation row, transitioning
 * "pending" → "active" once effective_at has elapsed. Pure helper — does not
 * write to the DB (the vote route uses this to interpret delegation state).
 */
export function effectiveStatus(delegation: Delegation, nowMs = Date.now()): DelegationStatus {
  if (delegation.status === DelegationStatus.REVOKED) return DelegationStatus.REVOKED;
  const effMs = Date.parse(delegation.effectiveAt);
  if (!Number.isNaN(effMs) && nowMs >= effMs) return DelegationStatus.ACTIVE;
  return DelegationStatus.PENDING;
}
