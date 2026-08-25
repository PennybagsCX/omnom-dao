import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { ErrorCode } from "@/types";

/**
 * DELETE /api/v1/proposals/[id]/comments/[commentId]
 *
 * Soft-delete a comment. Allowed for the comment author or an admin/moderator.
 */
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; commentId: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { id, commentId } = await params;

  const res = await db.execute({
    sql: "SELECT id, author_address, deleted_at FROM comments WHERE id = ? AND proposal_id = ?",
    args: [commentId, id],
  });
  if (res.rows.length === 0) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Comment not found.", 404);
  }
  const comment = res.rows[0]!;
  const isAuthor = (comment.author_address as string).toLowerCase() === session.sub.toLowerCase();
  const isAdmin = isAdminAddress(session.sub);
  if (!isAuthor && !isAdmin) {
    return apiError(ErrorCode.NOT_VERIFIED, "You may only delete your own comments.", 403);
  }

  await db.execute({
    sql: "UPDATE comments SET deleted_at = datetime('now') WHERE id = ?",
    args: [commentId],
  });

  return apiSuccess<{ deleted: boolean }>({ deleted: true });
}
