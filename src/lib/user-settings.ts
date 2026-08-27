import { db } from "@/lib/db";

/**
 * User settings data-access (Phase 3).
 *
 * Reads / writes the `user_settings` table, which persists notification
 * preferences (per GOVERNANCE_MECHANICS.md §14). Push delivery channels
 * (Telegram, Email) have been removed — only in-app notifications remain.
 *
 * All access is keyed by the internal `users.id`. Callers resolve the user id
 * from the wallet address (already done by the auth layer).
 */

export interface UserSettingsRow {
  userId: string;
  notifications: {
    proposalCreated: boolean;
    votingStarted: boolean;
    votingEndingSoon: boolean;
    proposalResult: boolean;
    mention: boolean;
  };
  preferredWallet: string | null;
  displayFormat: "full" | "abbreviated" | "raw";
}

function asBool(v: unknown): boolean {
  // CRITICAL: NULL means default-on for notifications (user hasn't explicitly disabled)
  // Only return false when explicitly set to 0
  return v === null ? true : Number(v) === 1;
}

/** Get settings for a user id, creating a default row on first access. */
export async function getUserSettings(userId: string): Promise<UserSettingsRow> {
  const res = await db.execute({
    sql: `SELECT user_id, notif_proposal_created, notif_voting_started,
                 notif_voting_ending_soon, notif_proposal_result, notif_mention,
                 preferred_wallet, display_format
          FROM user_settings WHERE user_id = ?`,
    args: [userId],
  });

  if (res.rows.length === 0) {
    // Lazy-create the default row.
    await db.execute({
      sql: "INSERT INTO user_settings (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING",
      args: [userId],
    });
    return defaultSettings(userId);
  }

  const r = res.rows[0] as unknown as Record<string, unknown>;
  return {
    userId,
    notifications: {
      proposalCreated: asBool(r.notif_proposal_created),
      votingStarted: asBool(r.notif_voting_started),
      votingEndingSoon: asBool(r.notif_voting_ending_soon),
      proposalResult: asBool(r.notif_proposal_result),
      mention: asBool(r.notif_mention),
    },
    preferredWallet: (r.preferred_wallet as string | null) ?? null,
    displayFormat: (r.display_format as "full" | "abbreviated" | "raw") ?? "abbreviated",
  };
}

function defaultSettings(userId: string): UserSettingsRow {
  return {
    userId,
    notifications: {
      proposalCreated: true,
      votingStarted: true,
      votingEndingSoon: true,
      proposalResult: true,
      mention: true,
    },
    preferredWallet: null,
    displayFormat: "abbreviated",
  };
}

/** Resolve the internal user id for a wallet address, or null. */
export async function getUserIdByAddress(address: string): Promise<string | null> {
  const res = await db.execute({
    sql: "SELECT id FROM users WHERE wallet_address = ?",
    args: [address.toLowerCase()],
  });
  if (res.rows.length === 0) return null;
  return res.rows[0]!.id as string;
}
