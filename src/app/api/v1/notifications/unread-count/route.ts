import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { countUnread } from "@/lib/notifications";
import { ErrorCode, type UnreadCountResponse } from "@/types";

/**
 * GET /api/v1/notifications/unread-count
 *
 * Lightweight endpoint for the header bell badge. Returns just the unread
 * count for the authenticated user.
 */
export async function GET() {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const res = await db.execute({
    sql: "SELECT id FROM users WHERE wallet_address = ?",
    args: [session.sub.toLowerCase()],
  });
  if (res.rows.length === 0) return apiError(ErrorCode.USER_NOT_FOUND, undefined, 404);
  const userId = res.rows[0]!.id as string;

  const unreadCount = await countUnread(userId);
  const data: UnreadCountResponse = { unreadCount };
  return apiSuccess<UnreadCountResponse>(data);
}
