import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError, RATE_WINDOWS } from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/proposals/[id]/comments/[commentId]/reactions
 *
 * Toggle an upvote or downvote on a comment. Each user may have exactly one
 * reaction per comment; toggling the same type removes it.
 *
 * Body: { type: "up" | "down" }
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; commentId: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { id, commentId } = await params;
  const voter = session.sub.toLowerCase();

  // Rate limit.
  const rl = await checkRateLimit(
    userActionBucket("reactions", voter),
    RATE_WINDOWS.commentPerUser.limit,
    RATE_WINDOWS.commentPerUser.windowSeconds,
  );
  if (!rl.allowed) {
    return apiError(ErrorCode.RATE_LIMITED, "Slow down.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON.", 400);
  }

  const rawType = (body as { type?: string })?.type;
  if (rawType !== "up" && rawType !== "down") {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid reaction type.", 400);
  }

  // Verify the comment exists.
  const commentRes = await db.execute({
    sql: "SELECT id FROM comments WHERE id = ? AND proposal_id = ?",
    args: [commentId, id],
  });
  if (commentRes.rows.length === 0) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Comment not found.", 404);
  }

  // Check existing reaction.
  const existing = await db.execute({
    sql: "SELECT id, type FROM comment_reactions WHERE comment_id = ? AND user_address = ?",
    args: [commentId, voter],
  });

  if (existing.rows.length > 0) {
    const existingType = existing.rows[0]!.type as string;
    if (existingType === rawType) {
      // Same reaction → remove (toggle off).
      await db.execute({
        sql: "DELETE FROM comment_reactions WHERE id = ?",
        args: [existing.rows[0]!.id as string],
      });
      return apiSuccess({ reaction: null });
    }
    // Different reaction → update.
    await db.execute({
      sql: "UPDATE comment_reactions SET type = ? WHERE id = ?",
      args: [rawType, existing.rows[0]!.id as string],
    });
    return apiSuccess({ reaction: { type: rawType } });
  }

  // No existing reaction → insert.
  await db.execute({
    sql: "INSERT INTO comment_reactions (comment_id, user_address, type) VALUES (?, ?, ?)",
    args: [commentId, voter, rawType],
  });
  return apiSuccess({ reaction: { type: rawType } }, undefined, 201);
}
