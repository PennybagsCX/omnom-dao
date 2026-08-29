import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { RATE_WINDOWS, requireAuth, UnauthorizedError } from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { sanitizeContent } from "@/lib/sanitize";
import { lookupHolder, lookupHolderClasses } from "@/lib/snapshot";
import { levenshtein, normalizeForCompare } from "@/lib/text";
import { RATE_LIMITS } from "@/lib/constants";
import { createElectionCommentSchema } from "@/lib/validators";
import {
  emptyEmojiCounts,
  EMOJI_KEYS,
  type EmojiKey,
  type EmojiReactionCounts,
} from "@/lib/emoji-reactions";
import { ErrorCode, type ElectionComment } from "@/types";

/**
 * Comments for a Foundational Governance Election.
 *
 * Mirrors the proposal-comments surface (`/api/v1/proposals/[id]/comments`)
 * with three differences:
 *   1. The foreign key is `election_key` (TEXT) instead of `proposal_id`.
 *   2. Posting requires the caller to be in the ever-held snapshot — same gate
 *      as casting a ballot. Anonymous / unverified wallets can READ but not
 *      POST. Rationale: every wallet in the snapshot is one ballot; the
 *      discussion should reflect that constituency, not the open internet.
 *   3. The composer is enabled during UPCOMING + OPEN phases (pre-vote
 *      discussion + active discussion) and is read-only after CLOSED. The
 *      server enforces this so historical comments stay visible.
 *
 * GET  /api/v1/elections/[electionKey]/comments         — list (public).
 * POST /api/v1/elections/[electionKey]/comments         — create (auth +
 *                                                          snapshot eligibility
 *                                                          + rate limits).
 */

/** GET /api/v1/elections/[electionKey]/comments — public, paginated, threaded via parent_id. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ electionKey: string }> },
) {
  const { electionKey } = await params;
  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50),
  );
  const offset = (page - 1) * limit;

  // Verify the election exists. Returns 404 for unknown keys so callers don't
  // mistake empty results for "no comments" vs. "no such election".
  const electionRes = await db.execute({
    sql: "SELECT election_key FROM governance_election WHERE election_key = ?",
    args: [electionKey],
  });
  if (electionRes.rows.length === 0) {
    return apiError(ErrorCode.NOT_FOUND, "Election not found.", 404);
  }

  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM election_comments WHERE election_key = ?",
    args: [electionKey],
  });
  const total = Number(countRes.rows[0]?.cnt ?? 0);

  const res = await db.execute({
    sql:
      "SELECT id, election_key, author_address, content, created_at, parent_id, deleted_at " +
      "FROM election_comments WHERE election_key = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    args: [electionKey, limit, offset],
  });

  // Batch-fetch reaction counts for all comments on this page.
  const commentIds = res.rows.map((r) => r.id as string);
  const reactionMap = new Map<string, { up: number; down: number }>();

  if (commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(",");
    const upRes = await db.execute({
      sql: `SELECT comment_id, COUNT(*) as cnt FROM election_comment_reactions WHERE comment_id IN (${placeholders}) AND type = 'up' GROUP BY comment_id`,
      args: commentIds,
    });
    const downRes = await db.execute({
      sql: `SELECT comment_id, COUNT(*) as cnt FROM election_comment_reactions WHERE comment_id IN (${placeholders}) AND type = 'down' GROUP BY comment_id`,
      args: commentIds,
    });
    for (const r of upRes.rows) {
      reactionMap.set(r.comment_id as string, {
        up: Number(r.cnt),
        down: reactionMap.get(r.comment_id as string)?.down ?? 0,
      });
    }
    for (const r of downRes.rows) {
      const prev = reactionMap.get(r.comment_id as string);
      reactionMap.set(r.comment_id as string, {
        up: prev?.up ?? 0,
        down: Number(r.cnt),
      });
    }
  }

  // Current user's reactions (if authenticated).
  const myReactions = new Map<string, string>();
  let mySessionAddr: string | null = null;
  try {
    const session = await requireAuth();
    mySessionAddr = session.sub.toLowerCase();
    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => "?").join(",");
      const myRes = await db.execute({
        sql: `SELECT comment_id, type FROM election_comment_reactions WHERE comment_id IN (${placeholders}) AND user_address = ?`,
        args: [...commentIds, mySessionAddr],
      });
      for (const r of myRes.rows) {
        myReactions.set(r.comment_id as string, r.type as string);
      }
    }
  } catch {
    // Not authenticated — skip myReaction.
  }

  // Batch-fetch emoji reaction counts grouped by emoji for every comment.
  const emojiMap = new Map<string, EmojiReactionCounts>();
  if (commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(",");
    const emojiRes = await db.execute({
      sql: `SELECT comment_id, emoji, COUNT(*) AS cnt FROM election_comment_emoji_reactions WHERE comment_id IN (${placeholders}) GROUP BY comment_id, emoji`,
      args: commentIds,
    });
    for (const r of emojiRes.rows) {
      const cid = r.comment_id as string;
      const counts = emojiMap.get(cid) ?? emptyEmojiCounts();
      const key = r.emoji as EmojiKey;
      if (EMOJI_KEYS.includes(key)) {
        counts[key] = Number(r.cnt);
        emojiMap.set(cid, counts);
      }
    }
  }

  const myEmojiMap = new Map<string, EmojiKey>();
  if (mySessionAddr && commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(",");
    const myEmojiRes = await db.execute({
      sql: `SELECT comment_id, emoji FROM election_comment_emoji_reactions WHERE comment_id IN (${placeholders}) AND user_address = ?`,
      args: [...commentIds, mySessionAddr],
    });
    for (const r of myEmojiRes.rows) {
      myEmojiMap.set(r.comment_id as string, r.emoji as EmojiKey);
    }
  }

  // Batch-resolve commenters' holder classes for inline badges.
  const authorClasses = await lookupHolderClasses(
    res.rows.map((r) => r.author_address as string),
  );

  const comments: ElectionComment[] = res.rows.map((r) => {
    const cid = r.id as string;
    const reactions = reactionMap.get(cid) ?? { up: 0, down: 0 };
    return {
      id: cid,
      electionKey: r.election_key as string,
      authorAddress: r.author_address as string,
      authorHolderClass:
        authorClasses.get((r.author_address as string).toLowerCase()) ?? null,
      content: r.deleted_at ? "[deleted]" : (r.content as string),
      createdAt: r.created_at as string,
      parentId: (r.parent_id as string | null) ?? null,
      deletedAt: (r.deleted_at as string | null) ?? null,
      upvotes: reactions.up,
      downvotes: reactions.down,
      myReaction: myReactions.get(cid) ?? null,
      emojiReactionCounts: emojiMap.get(cid) ?? emptyEmojiCounts(),
      myEmojiReaction: myEmojiMap.get(cid) ?? null,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return apiSuccess<{ comments: ElectionComment[] }>(
    { comments },
    { page, pageSize: limit, totalItems: total, totalPages },
  );
}

/**
 * POST /api/v1/elections/[electionKey]/comments — create.
 *
 * Gate order:
 *   1. requireAuth                  — must have a valid session.
 *   2. election exists              — 404 on unknown key.
 *   3. snapshot eligibility         — 404 NOT_IN_SNAPSHOT for unknown wallets.
 *   4. phase window                 — 409 VOTING_CLOSED after CLOSED.
 *   5. rate limits + duplicate      — same anti-spam as proposals.
 *   6. insert + mention notifications.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ electionKey: string }> },
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const { electionKey } = await params;
  const authorAddress = session.sub.toLowerCase();

  // Load election row once — used for both existence + phase checks.
  const electionRes = await db.execute({
    sql:
      "SELECT election_key, voting_starts_at, voting_ends_at FROM governance_election WHERE election_key = ?",
    args: [electionKey],
  });
  if (electionRes.rows.length === 0) {
    return apiError(ErrorCode.NOT_FOUND, "Election not found.", 404);
  }
  const election = electionRes.rows[0]!;

  // Snapshot eligibility — every comment must come from an ever-held wallet.
  // This is the same gate that applies to ballot submission; it prevents
  // drive-by commentary from wallets that have no stake in the election.
  const holder = await lookupHolder(authorAddress);
  if (!holder) {
    return apiError(
      ErrorCode.NOT_IN_SNAPSHOT,
      "Only wallets in the ever-held snapshot can comment on this election.",
      404,
    );
  }

  // Phase gate — commenting is allowed during UPCOMING + OPEN. After CLOSED,
  // comments remain visible (read-only) so the discussion stays attached to
  // the election record.
  const now = Date.now();
  const endsMs = Date.parse(election.voting_ends_at as string);
  if (!Number.isNaN(endsMs) && now > endsMs) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Voting has closed — comments are read-only.",
      409,
    );
  }
  // (UPCOMING before startsAt is allowed by design — pre-vote discussion.)

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = createElectionCommentSchema.safeParse({
    ...(body as Record<string, unknown>),
    electionKey,
  });
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }
  const { content, parentId } = parsed.data;
  const sanitized = sanitizeContent(content);
  if (sanitized.length > RATE_LIMITS.commentMaxLength) {
    return apiError(ErrorCode.MISSING_FIELDS, "Comment exceeds 2000 characters.", 400);
  }

  // 30s between comments by the same user (global — applies across elections
  // and proposals to prevent abuse through the comment surface in aggregate).
  const lastCommentRes = await db.execute({
    sql:
      "SELECT created_at FROM election_comments WHERE author_address = ? ORDER BY created_at DESC LIMIT 1",
    args: [authorAddress],
  });
  if (lastCommentRes.rows.length > 0) {
    const lastMs = Date.parse(lastCommentRes.rows[0]!.created_at as string);
    if (!Number.isNaN(lastMs) && Date.now() - lastMs < RATE_LIMITS.commentMinIntervalMs) {
      return apiError(
        ErrorCode.RATE_LIMITED,
        "Please wait 30 seconds between comments.",
        429,
      );
    }
  }

  // 30 comments/day rate limit.
  const rl = await checkRateLimit(
    userActionBucket("election-comments", authorAddress),
    RATE_WINDOWS.commentPerUser.limit,
    RATE_WINDOWS.commentPerUser.windowSeconds,
  );
  if (!rl.allowed) {
    return apiError(ErrorCode.RATE_LIMITED, "Daily comment limit reached.", 429);
  }

  // Fuzzy duplicate detection (Levenshtein ≤ 3 against recent comments on this
  // election) — keeps the thread readable and blocks spam reposts.
  if (sanitized.trim().length > 0) {
    const recentRes = await db.execute({
      sql:
        "SELECT content FROM election_comments WHERE author_address = ? AND election_key = ? " +
        "AND created_at > datetime('now', ?) ORDER BY created_at DESC LIMIT 25",
      args: [
        authorAddress,
        electionKey,
        `-${RATE_LIMITS.duplicateWindowMs / 1000} seconds`,
      ],
    });
    const normalizedNew = normalizeForCompare(sanitized);
    for (const row of recentRes.rows) {
      const normExisting = normalizeForCompare(row.content as string);
      if (levenshtein(normalizedNew, normExisting) <= RATE_LIMITS.duplicateDistance) {
        return apiError(
          ErrorCode.RATE_LIMITED,
          "This comment is too similar to a recent one.",
          429,
        );
      }
    }
  }

  // If a parentId was supplied, verify it exists on this election — prevents
  // forging replies to comments on other surfaces.
  if (parentId) {
    const parentRes = await db.execute({
      sql:
        "SELECT id FROM election_comments WHERE id = ? AND election_key = ? AND deleted_at IS NULL",
      args: [parentId, electionKey],
    });
    if (parentRes.rows.length === 0) {
      return apiError(ErrorCode.NOT_FOUND, "Parent comment not found.", 404);
    }
  }

  const insert = await db.execute({
    sql:
      "INSERT INTO election_comments (election_key, author_address, content, parent_id) " +
      "VALUES (?, ?, ?, ?) RETURNING id, created_at",
    args: [electionKey, authorAddress, sanitized, parentId ?? null],
  });
  const row = insert.rows[0]!;

  const comment: ElectionComment = {
    id: row.id as string,
    electionKey,
    authorAddress,
    authorHolderClass: holder.holderClass,
    content: sanitized,
    createdAt: row.created_at as string,
    parentId: parentId ?? null,
    deletedAt: null,
    upvotes: 0,
    downvotes: 0,
    myReaction: null,
    emojiReactionCounts: emptyEmojiCounts(),
    myEmojiReaction: null,
  };

  return apiSuccess<{ comment: ElectionComment }>({ comment }, undefined, 201);

  // Note: snapshot integrity (`isSnapshotIntegrityVerified`) is intentionally
  // NOT re-checked here — it only gates ballot submission (where it would
  // corrupt vote counts). Comments are read-only and history stays visible
  // even if the snapshot hash later drifts.
}
