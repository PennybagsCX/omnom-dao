import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError, RATE_WINDOWS } from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { EMOJI_KEYS, isEmojiKey } from "@/lib/emoji-reactions";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/proposals/[id]/reactions
 *
 * Toggle an emoji reaction on a proposal. Each (proposal, voter, emoji) triple
 * is unique; clicking the same emoji again removes it. Voting power and
 * `votesFor/Against/Abstain` are never touched — this lives entirely in the
 * `proposal_emoji_reactions` table.
 *
 * Body: { emoji: EmojiKey }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      return apiError(err.code, undefined, err.statusCode);
    throw err;
  }

  const { id } = await params;
  const voter = session.sub.toLowerCase();

  // Rate limit — separate bucket from comment reactions so high-volume emoji
  // clicking on proposals doesn't burn the comment quota.
  const rl = await checkRateLimit(
    userActionBucket("proposal-emoji-reactions", voter),
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

  // Verify the proposal exists.
  const proposalRes = await db.execute({
    sql: "SELECT id FROM proposals WHERE id = ?",
    args: [id],
  });
  if (proposalRes.rows.length === 0) {
    return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Proposal not found.", 404);
  }

  // Check existing reaction for this (proposal, voter, emoji).
  const existing = await db.execute({
    sql: "SELECT id FROM proposal_emoji_reactions WHERE proposal_id = ? AND user_address = ? AND emoji = ?",
    args: [id, voter, emoji],
  });

  if (existing.rows.length > 0) {
    // Same emoji → remove (toggle off).
    await db.execute({
      sql: "DELETE FROM proposal_emoji_reactions WHERE id = ?",
      args: [existing.rows[0]!.id as string],
    });
    return apiSuccess({ reaction: null });
  }

  // No existing reaction for this emoji → insert.
  await db.execute({
    sql: "INSERT INTO proposal_emoji_reactions (proposal_id, user_address, emoji) VALUES (?, ?, ?)",
    args: [id, voter, emoji],
  });
  return apiSuccess({ reaction: { emoji } }, undefined, 201);
}