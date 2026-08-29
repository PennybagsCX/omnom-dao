import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError, RATE_WINDOWS } from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { EMOJI_KEYS, isEmojiKey } from "@/lib/emoji-reactions";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/proposals/[id]/comments/[commentId]/emoji-reactions
 *
 * Toggle an emoji reaction on a proposal comment. Coexists with the up/down
 * arrow reactions in `comment_reactions` — a user can hold one arrow + one
 * of each emoji independently. Voting power is never touched.
 *
 * Body: { emoji: EmojiKey }
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

  const rl = await checkRateLimit(
    userActionBucket("comment-emoji-reactions", voter),
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

  const rawEmoji = (body as { emoji?: string })?.emoji;
  if (!isEmojiKey(rawEmoji)) {
    return apiError(
      ErrorCode.MISSING_FIELDS,
      `Invalid emoji. Expected one of: ${EMOJI_KEYS.join(", ")}.`,
      400,
    );
  }
  const emoji = rawEmoji;

  // Verify the comment exists on this proposal.
  const commentRes = await db.execute({
    sql: "SELECT id FROM comments WHERE id = ? AND proposal_id = ?",
    args: [commentId, id],
  });
  if (commentRes.rows.length === 0) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Comment not found.", 404);
  }

  const existing = await db.execute({
    sql: "SELECT id FROM comment_emoji_reactions WHERE comment_id = ? AND user_address = ? AND emoji = ?",
    args: [commentId, voter, emoji],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: "DELETE FROM comment_emoji_reactions WHERE id = ?",
      args: [existing.rows[0]!.id as string],
    });
    return apiSuccess({ reaction: null });
  }

  await db.execute({
    sql: "INSERT INTO comment_emoji_reactions (comment_id, user_address, emoji) VALUES (?, ?, ?)",
    args: [commentId, voter, emoji],
  });
  return apiSuccess({ reaction: { emoji } }, undefined, 201);
}