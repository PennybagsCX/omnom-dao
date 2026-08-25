import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { markRead } from "@/lib/notifications";
import { ErrorCode } from "@/types";

/**
 * PATCH /api/v1/notifications/[id]/read
 *
 * Mark a single notification as read. The notification must belong to the
 * authenticated user (ownership check via user_id match).
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { id } = await params;
  const userRes = await db.execute({
    sql: "SELECT id FROM users WHERE wallet_address = ?",
    args: [session.sub.toLowerCase()],
  });
  if (userRes.rows.length === 0) return apiError(ErrorCode.USER_NOT_FOUND, undefined, 404);
  const userId = userRes.rows[0]!.id as string;

  // Verify ownership before mutating.
  const ownerRes = await db.execute({
    sql: "SELECT user_id FROM notifications WHERE id = ?",
    args: [id],
  });
  if (ownerRes.rows.length === 0) {
    return apiError(ErrorCode.NOTIFICATION_NOT_FOUND, undefined, 404);
  }
  if ((ownerRes.rows[0]!.user_id as string) !== userId) {
    return apiError(ErrorCode.NOTIFICATION_NOT_FOUND, undefined, 404);
  }

  await markRead(id, userId);
  return apiSuccess<{ read: true }>({ read: true });
}
