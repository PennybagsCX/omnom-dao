import { db } from "@/lib/db";

/**
 * User settings data-access (Phase 3).
 *
 * Reads / writes the `user_settings` table, which persists notification
 * preferences (per GOVERNANCE_MECHANICS.md §14) and the Telegram / email
 * delivery channels (per TECHNICAL_ARCHITECTURE.md §4 — notification layer).
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
  telegram: {
    enabled: boolean;
    chatId: string | null;
    username: string | null;
  };
  email: {
    enabled: boolean;
    address: string | null;
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
                 telegram_enabled, telegram_chat_id, telegram_username,
                 email_enabled, email_address, preferred_wallet, display_format
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
    telegram: {
      enabled: asBool(r.telegram_enabled),
      chatId: (r.telegram_chat_id as string | null) ?? null,
      username: (r.telegram_username as string | null) ?? null,
    },
    email: {
      enabled: asBool(r.email_enabled),
      address: (r.email_address as string | null) ?? null,
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
    telegram: { enabled: false, chatId: null, username: null },
    email: { enabled: false, address: null },
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
