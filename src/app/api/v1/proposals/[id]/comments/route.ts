import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import {
  RATE_WINDOWS,
  requireAuth,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { sanitizeContent } from "@/lib/sanitize";
import { lookupHolder, lookupHolderClasses } from "@/lib/snapshot";
import { levenshtein, normalizeForCompare } from "@/lib/text";
import { RATE_LIMITS } from "@/lib/constants";
import { notifyMentionsFromContent } from "@/lib/notifications";
import { createCommentSchema } from "@/lib/validators";
import { ErrorCode, type ProposalComment } from "@/types";

/**
 * Comments for a proposal.
 *
 * GET  /api/v1/proposals/[id]/comments         — list (public, paginated).
 * POST /api/v1/proposals/[id]/comments         — create (auth + rate limits).
 */

/** GET /api/v1/proposals/[id]/comments — public, paginated, threaded via parent_id. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50),
  );
  const offset = (page - 1) * limit;

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);

  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM comments WHERE proposal_id = ?",
    args: [id],
  });
  const total = Number(countRes.rows[0]?.cnt ?? 0);

  const res = await db.execute({
    sql:
      "SELECT id, proposal_id, author_address, content, created_at, parent_id, deleted_at " +
      "FROM comments WHERE proposal_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    args: [id, limit, offset],
  });

  // Batch-fetch reaction counts for all comments on this page.
  const commentIds = res.rows.map((r) => r.id as string);
  const reactionMap = new Map<string, { up: number; down: number }>();

  if (commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(",");
    const upRes = await db.execute({
      sql: `SELECT comment_id, COUNT(*) as cnt FROM comment_reactions WHERE comment_id IN (${placeholders}) AND type = 'up' GROUP BY comment_id`,
      args: commentIds,
    });
    const downRes = await db.execute({
      sql: `SELECT comment_id, COUNT(*) as cnt FROM comment_reactions WHERE comment_id IN (${placeholders}) AND type = 'down' GROUP BY comment_id`,
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

  // Get the current user's reactions (if authenticated).
  const myReactions = new Map<string, string>();
  try {
    const session = await requireAuth();
    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => "?").join(",");
      const myRes = await db.execute({
        sql: `SELECT comment_id, type FROM comment_reactions WHERE comment_id IN (${placeholders}) AND user_address = ?`,
        args: [...commentIds, session.sub.toLowerCase()],
      });
      for (const r of myRes.rows) {
        myReactions.set(r.comment_id as string, r.type as string);
      }
    }
  } catch {
    // Not authenticated — skip.
  }

  // Batch-resolve commenters' holder classes for inline badges.
  const authorClasses = await lookupHolderClasses(
    res.rows.map((r) => r.author_address as string),
  );

  const comments: ProposalComment[] = res.rows.map((r) => {
    const cid = r.id as string;
    const reactions = reactionMap.get(cid) ?? { up: 0, down: 0 };
    return {
      id: cid,
      proposalId: r.proposal_id as string,
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
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return apiSuccess<{ comments: ProposalComment[] }>(
    { comments },
    { page, pageSize: limit, totalItems: total, totalPages },
  );
}

/** POST /api/v1/proposals/[id]/comments — create (auth + rate limits + dup check). */
export async function POST(
  request: NextRequest,
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
  const authorAddress = session.sub.toLowerCase();

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = createCommentSchema.safeParse({
    ...(body as Record<string, unknown>),
    proposalId: id,
  });
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }
  const { content, parentId } = parsed.data;
  const sanitized = sanitizeContent(content);
  if (sanitized.length > RATE_LIMITS.commentMaxLength) {
    return apiError(ErrorCode.MISSING_FIELDS, "Comment exceeds 2000 characters.", 400);
  }

  // 30s between comments by the same user.
  const lastCommentRes = await db.execute({
    sql: "SELECT created_at FROM comments WHERE author_address = ? ORDER BY created_at DESC LIMIT 1",
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
    userActionBucket("comments", authorAddress),
    RATE_WINDOWS.commentPerUser.limit,
    RATE_WINDOWS.commentPerUser.windowSeconds,
  );
  if (!rl.allowed) {
    return apiError(ErrorCode.RATE_LIMITED, "Daily comment limit reached.", 429);
  }

  // Fuzzy duplicate detection: Levenshtein ≤ 3 against the user's recent
  // comments on this proposal.
  if (sanitized.trim().length > 0) {
    const recentRes = await db.execute({
      sql:
        "SELECT content FROM comments WHERE author_address = ? AND created_at > datetime('now', ?) ORDER BY created_at DESC LIMIT 25",
      args: [authorAddress, `-${RATE_LIMITS.duplicateWindowMs / 1000} seconds`],
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

  const insert = await db.execute({
    sql:
      "INSERT INTO comments (proposal_id, author_address, content, parent_id) " +
      "VALUES (?, ?, ?, ?) RETURNING id, created_at",
    args: [id, authorAddress, sanitized, parentId ?? null],
  });
  const row = insert.rows[0]!;
  const authorHolder = await lookupHolder(authorAddress);

  const comment: ProposalComment = {
    id: row.id as string,
    proposalId: id,
    authorAddress,
    authorHolderClass: authorHolder?.holderClass ?? null,
    content: sanitized,
    createdAt: row.created_at as string,
    parentId: parentId ?? null,
    deletedAt: null,
    upvotes: 0,
    downvotes: 0,
    myReaction: null,
  };

  // Fire-and-forget: notify any @0x… addresses mentioned in the comment.
  // The notification service swallows errors so this never blocks the post.
  void notifyMentionsFromContent(id, comment.id, sanitized).catch((err) =>
    console.error("[notifications] mention dispatch error:", err),
  );

  return apiSuccess<{ comment: ProposalComment }>({ comment }, undefined, 201);
}
