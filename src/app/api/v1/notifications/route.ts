import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { listNotifications } from "@/lib/notifications";
import { listNotificationsSchema } from "@/lib/validators";
import { ErrorCode, type NotificationListResponse } from "@/types";

/**
 * Notification list + unread-count endpoints.
 *
 * GET /api/v1/notifications            — paginated list for the authed user.
 * GET /api/v1/notifications/unread-count — unread badge count (authed).
 */

/** Resolve the internal user id for the authed session address. */
async function resolveUserId(sessionSub: string): Promise<string | null> {
  const res = await db.execute({
    sql: "SELECT id FROM users WHERE wallet_address = ?",
    args: [sessionSub.toLowerCase()],
  });
  return res.rows.length > 0 ? (res.rows[0]!.id as string) : null;
}

/** GET /api/v1/notifications — paginated list with unread count. */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const userId = await resolveUserId(session.sub);
  if (!userId) return apiError(ErrorCode.USER_NOT_FOUND, undefined, 404);

  const url = request.nextUrl;
  const parsed = listNotificationsSchema.safeParse({
    unreadOnly: url.searchParams.get("unreadOnly") ?? "false",
    page: url.searchParams.get("page") ?? "1",
    limit: url.searchParams.get("limit") ?? "20",
  });
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }

  const { notifications, unreadCount, total } = await listNotifications(userId, parsed.data);

  const data: NotificationListResponse = { notifications, unreadCount };
  const totalPages = Math.max(1, Math.ceil(total / parsed.data.limit));
  return apiSuccess<NotificationListResponse>(data, {
    page: parsed.data.page,
    pageSize: parsed.data.limit,
    totalItems: total,
    totalPages,
  });
}
