import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAllRead } from "@/lib/notifications";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/notifications/read-all
 *
 * Mark every unread notification for the authenticated user as read.
 * Returns the number of rows updated.
 */
export async function POST() {
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

  const updated = await markAllRead(userId);
  return apiSuccess<{ updated: number }>({ updated });
}
