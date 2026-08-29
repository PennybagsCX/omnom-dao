import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError, RATE_WINDOWS } from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { lookupHolder } from "@/lib/snapshot";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/elections/[electionKey]/comments/[commentId]/reactions
 *
 * Toggle an upvote or downvote on an election comment. Each user may have
 * exactly one reaction per comment; toggling the same type removes it.
 *
 * Body: { type: "up" | "down" }
 *
 * Snapshot eligibility is enforced here too — only ever-held wallets can
 * react. This keeps the reaction counts meaningful (they reflect the same
 * constituency that can comment and vote).
 */
export async function POST(
  request: NextRequest,
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
    if (err instanceof UnauthorizedError)
      return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { electionKey, commentId } = await params;
  const voter = session.sub.toLowerCase();

  // Snapshot gate — same constituency rule as POST comment.
  const holder = await lookupHolder(voter);
  if (!holder) {
    return apiError(
      ErrorCode.NOT_IN_SNAPSHOT,
      "Only wallets in the ever-held snapshot can react to comments.",
      404,
    );
  }

  // Rate limit (per user, shared bucket with proposal reactions).
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

  // Verify the comment exists on this election.
  const commentRes = await db.execute({
    sql:
      "SELECT id FROM election_comments WHERE id = ? AND election_key = ?",
    args: [commentId, electionKey],
  });
  if (commentRes.rows.length === 0) {
    return apiError(ErrorCode.NOT_FOUND, "Comment not found.", 404);
  }

  // Check existing reaction.
  const existing = await db.execute({
    sql:
      "SELECT id, type FROM election_comment_reactions " +
      "WHERE comment_id = ? AND user_address = ?",
    args: [commentId, voter],
  });

  if (existing.rows.length > 0) {
    const existingType = existing.rows[0]!.type as string;
    if (existingType === rawType) {
      // Same reaction → remove (toggle off).
      await db.execute({
        sql: "DELETE FROM election_comment_reactions WHERE id = ?",
        args: [existing.rows[0]!.id as string],
      });
      return apiSuccess({ reaction: null });
    }
    // Different reaction → update.
    await db.execute({
      sql: "UPDATE election_comment_reactions SET type = ? WHERE id = ?",
      args: [rawType, existing.rows[0]!.id as string],
    });
    return apiSuccess({ reaction: { type: rawType } });
  }

  // No existing reaction → insert.
  await db.execute({
    sql:
      "INSERT INTO election_comment_reactions (comment_id, user_address, type) " +
      "VALUES (?, ?, ?)",
    args: [commentId, voter, rawType],
  });
  return apiSuccess({ reaction: { type: rawType } }, undefined, 201);
}
