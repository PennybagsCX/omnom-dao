import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { ErrorCode } from "@/types";

/**
 * DELETE /api/v1/elections/[electionKey]/comments/[commentId]
 *
 * Soft-delete an election comment. Allowed for the comment author or an
 * admin/moderator. Mirrors the proposal-comments delete route.
 */
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ electionKey: string; commentId: string }>;
  },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { electionKey, commentId } = await params;

  const res = await db.execute({
    sql:
      "SELECT id, author_address, deleted_at FROM election_comments " +
      "WHERE id = ? AND election_key = ?",
    args: [commentId, electionKey],
  });
  if (res.rows.length === 0) {
    return apiError(ErrorCode.NOT_FOUND, "Comment not found.", 404);
  }
  const comment = res.rows[0]!;
  const isAuthor =
    (comment.author_address as string).toLowerCase() ===
    session.sub.toLowerCase();
  const isAdmin = isAdminAddress(session.sub);
  if (!isAuthor && !isAdmin) {
    return apiError(
      ErrorCode.NOT_VERIFIED,
      "You may only delete your own comments.",
      403,
    );
  }

  await db.execute({
    sql: "UPDATE election_comments SET deleted_at = datetime('now') WHERE id = ?",
    args: [commentId],
  });

  return apiSuccess<{ deleted: boolean }>({ deleted: true });
}
