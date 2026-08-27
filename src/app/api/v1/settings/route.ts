import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import {
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE_ATTRIBUTES,
  UnauthorizedError,
} from "@/lib/auth";
import { sanitizePlainText } from "@/lib/sanitize";
import { getUserIdByAddress, getUserSettings } from "@/lib/user-settings";
import { z } from "zod";
import { ErrorCode } from "@/types";

const settingsSchema = z.object({
  displayName: z.string().min(1).max(32).optional(),
  notifications: z
    .object({
      proposalCreated: z.boolean().optional(),
      votingStarted: z.boolean().optional(),
      votingEndingSoon: z.boolean().optional(),
      proposalResult: z.boolean().optional(),
      mention: z.boolean().optional(),
    })
    .optional(),
  preferredWallet: z.string().max(40).nullable().optional(),
  displayFormat: z.enum(["full", "abbreviated", "raw"]).optional(),
});

/**
 * PATCH /api/v1/settings
 *
 * Update the authenticated user's display name, notification preferences, and
 * delivery channels. Display names are validated (≤32 chars) and HTML-stripped.
 * Preferences persist to the `user_settings` table (C1.1).
 */
export async function PATCH(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const address = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }
  const input = parsed.data;

  if (input.displayName !== undefined) {
    const clean = sanitizePlainText(input.displayName);
    if (clean.length === 0 || clean.length > 32) {
      return apiError(ErrorCode.MISSING_FIELDS, "Display name must be 1–32 characters.", 400);
    }
    await db.execute({
      sql: "UPDATE users SET display_name = ? WHERE wallet_address = ?",
      args: [clean, address],
    });
  }

  // Persist notification preferences + delivery channels to user_settings (C1.1).
  const userId = await getUserIdByAddress(address);
  if (userId) {
    const sets: string[] = [];
    const args: (string | number | null)[] = [];

    const n = input.notifications;
    if (n) {
      if (n.proposalCreated !== undefined) {
        sets.push("notif_proposal_created = ?");
        args.push(n.proposalCreated ? 1 : 0);
      }
      if (n.votingStarted !== undefined) {
        sets.push("notif_voting_started = ?");
        args.push(n.votingStarted ? 1 : 0);
      }
      if (n.votingEndingSoon !== undefined) {
        sets.push("notif_voting_ending_soon = ?");
        args.push(n.votingEndingSoon ? 1 : 0);
      }
      if (n.proposalResult !== undefined) {
        sets.push("notif_proposal_result = ?");
        args.push(n.proposalResult ? 1 : 0);
      }
      if (n.mention !== undefined) {
        sets.push("notif_mention = ?");
        args.push(n.mention ? 1 : 0);
      }
    }

    if (input.preferredWallet !== undefined) {
      sets.push("preferred_wallet = ?");
      args.push(input.preferredWallet);
    }
    if (input.displayFormat !== undefined) {
      sets.push("display_format = ?");
      args.push(input.displayFormat);
    }

    if (sets.length > 0) {
      // Ensure a row exists, then update.
      await db.execute({
        sql: "INSERT INTO user_settings (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING",
        args: [userId],
      });
      args.push(userId);
      await db.execute({
        sql: `UPDATE user_settings SET ${sets.join(", ")} WHERE user_id = ?`,
        args,
      });
    }
  }

  // Echo back the full persisted settings so the client can sync.
  const persisted = userId ? await getUserSettings(userId) : null;

  const data = {
    updated: true,
    address,
    // Echo the sanitized form (never the raw input).
    displayName: input.displayName !== undefined ? sanitizePlainText(input.displayName) : null,
    notifications: persisted?.notifications ?? input.notifications ?? null,
    preferredWallet: persisted?.preferredWallet ?? input.preferredWallet ?? null,
    displayFormat: persisted?.displayFormat ?? input.displayFormat ?? null,
  };

  return apiSuccess<typeof data>(data);
}

/**
 * DELETE /api/v1/settings — account deletion (C1.3).
 *
 * Clears the user's display name and resets all notification/channel
 * preferences to defaults. Immutable records (votes, proposals) are preserved.
 * Also clears the session cookie so the client signs out.
 */
export async function DELETE() {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const address = session.sub.toLowerCase();

  await db.execute({
    sql: "UPDATE users SET display_name = NULL WHERE wallet_address = ?",
    args: [address],
  });

  const userId = await getUserIdByAddress(address);
  if (userId) {
    await db.execute({
      sql: "DELETE FROM user_settings WHERE user_id = ?",
      args: [userId],
    });
  }

  const response = apiSuccess<{ deleted: boolean }>({ deleted: true });
  response.cookies.set("omnom_token", "", {
    ...SESSION_COOKIE_ATTRIBUTES,
    maxAge: 0,
  });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
