import { type NextRequest } from "next/server";

import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { getSessionAddress, requireAuth, UnauthorizedError } from "@/lib/auth";
import { sanitizeContent } from "@/lib/sanitize";
import { lookupHolderClasses } from "@/lib/snapshot";
import { finalizeProposal } from "@/lib/proposal-finalize";
import { z } from "zod";
import {
  ErrorCode,
  ProposalStatus,
  VoteChoice,
  type Proposal,
  type ProposalComment,
} from "@/types";

/**
 * GET    /api/v1/proposals/[id]          — proposal detail + tallies + comments.
 * PATCH  /api/v1/proposals/[id]          — edit (draft/pending_review only, author only).
 */

interface VoteResultData {
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
}

interface MyVoteData {
  choice: VoteChoice;
  votingPower: number;
  votedAt: string;
}

interface ProposalDetailData {
  proposal: Proposal;
  votes: VoteResultData;
  voterCount: number;
  comments: ProposalComment[];
  myVote: MyVoteData | null;
}

/** GET /api/v1/proposals/[id] — public. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    let proposal = await getProposalById(id);
    if (!proposal) {
      return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
    }

    // P0-1: Lazy finalization — if voting window has ended, finalize before serving.
    if (proposal.status === ProposalStatus.ACTIVE && proposal.votingEndsAt) {
      const endMs = Date.parse(proposal.votingEndsAt);
      if (!Number.isNaN(endMs) && Date.now() > endMs) {
        await finalizeProposal(id);
        proposal = (await getProposalById(id)) ?? proposal;
      }
    }

    const voteRes = await db.execute({
      sql: "SELECT choice, SUM(voting_power) AS total FROM votes WHERE proposal_id = ? GROUP BY choice",
      args: [id],
    });
    let totalFor = 0;
    let totalAgainst = 0;
    let totalAbstain = 0;
    let voterCount = 0;
    for (const row of voteRes.rows) {
      const total = Number(row.total ?? 0);
      voterCount += 1; // each choice group represents >=1 vote; refined below
      if (row.choice === VoteChoice.FOR) totalFor = total;
      else if (row.choice === VoteChoice.AGAINST) totalAgainst = total;
      else if (row.choice === VoteChoice.ABSTAIN) totalAbstain = total;
    }

    const countRes = await db.execute({
      sql: "SELECT COUNT(*) AS cnt FROM votes WHERE proposal_id = ?",
      args: [id],
    });
    voterCount = Number(countRes.rows[0]?.cnt ?? 0);

    const commentsRes = await db.execute({
      sql:
        "SELECT id, author_address, content, created_at, parent_id, deleted_at " +
        "FROM comments WHERE proposal_id = ? ORDER BY created_at ASC",
      args: [id],
    });
    // Batch-resolve commenters' holder classes for inline badges.
    const commentClasses = await lookupHolderClasses(
      commentsRes.rows.map((r) => r.author_address as string),
    );

    // Batch-fetch reaction counts (upvotes / downvotes) for every comment on this
    // proposal. The pattern mirrors `/comments` so reaction toggles can update
    // counts in O(1) extra queries regardless of how many comments exist.
    const commentIds = commentsRes.rows.map((r) => r.id as string);
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

    // Hydrate the current user's reaction so the UI can render the active
    // arrow state without a follow-up request. Auth is optional here; on miss
    // the map stays empty and every comment reports `myReaction: null`.
    const myReactions = new Map<string, string>();
    const sessionAddrForReactions = await getSessionAddress();
    if (sessionAddrForReactions && commentIds.length > 0) {
      const placeholders = commentIds.map(() => "?").join(",");
      const myRes = await db.execute({
        sql: `SELECT comment_id, type FROM comment_reactions WHERE comment_id IN (${placeholders}) AND user_address = ?`,
        args: [...commentIds, sessionAddrForReactions.toLowerCase()],
      });
      for (const r of myRes.rows) {
        myReactions.set(r.comment_id as string, r.type as string);
      }
    }

    const comments: ProposalComment[] = commentsRes.rows.map((r) => {
      const cid = r.id as string;
      const reactions = reactionMap.get(cid) ?? { up: 0, down: 0 };
      return {
        id: cid,
        proposalId: id,
        authorAddress: r.author_address as string,
        authorHolderClass:
          commentClasses.get((r.author_address as string).toLowerCase()) ?? null,
        content: (r.deleted_at ? "[deleted]" : (r.content as string)) ?? "",
        createdAt: r.created_at as string,
        parentId: (r.parent_id as string | null) ?? null,
        deletedAt: (r.deleted_at as string | null) ?? null,
        upvotes: reactions.up,
        downvotes: reactions.down,
        myReaction: myReactions.get(cid) ?? null,
      };
    });

    // Resolve the current user's ballot so returning voters see their choice
    // immediately on page load (C2.1). May be null for unauthenticated users.
    let myVote: MyVoteData | null = null;
    const sessionAddress = await getSessionAddress();
    if (sessionAddress) {
      const mineRes = await db.execute({
        sql: "SELECT choice, voting_power, voted_at FROM votes WHERE proposal_id = ? AND voter_address = ? LIMIT 1",
        args: [id, sessionAddress],
      });
      const mine = mineRes.rows[0];
      if (mine) {
        myVote = {
          choice: mine.choice as VoteChoice,
          votingPower: Number(mine.voting_power ?? 0),
          votedAt: mine.voted_at as string,
        };
      }
    }

    const data: ProposalDetailData = {
      proposal,
      votes: { totalFor, totalAgainst, totalAbstain },
      voterCount,
      comments,
      myVote,
    };
    return apiSuccess<ProposalDetailData>(data);
  } catch (error) {
    // BUG-2: return a clean error envelope when the DB is unavailable instead
    // of throwing an unhandled error that hangs the detail page.
    console.error("[api/proposals/[id]] GET error:", error);
    return apiInternalError("Unable to fetch proposal details.");
  }
}

const editProposalSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  description: z.string().min(50).max(10_000).optional(),
  type: z.enum(["CHAIN_SELECTION", "TOKENOMICS_CHANGE", "TREASURY", "GUIDELINE", "TECHNICAL", "GENERAL"]).optional(),
  quorumRequired: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** PATCH /api/v1/proposals/[id] — author only, draft/pending_review only. */
export async function PATCH(
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

  const proposal = await getProposalById(id);
  if (!proposal) return apiError(ErrorCode.PROPOSAL_NOT_FOUND, undefined, 404);
  if (proposal.authorAddress.toLowerCase() !== session.sub.toLowerCase()) {
    return apiError(ErrorCode.NOT_VERIFIED, "Only the author may edit this proposal.", 403);
  }
  if (
    proposal.status !== ProposalStatus.DRAFT &&
    proposal.status !== ProposalStatus.PENDING_REVIEW
  ) {
    return apiError(
      ErrorCode.VOTING_CLOSED,
      "Proposal can only be edited while in Draft or Pending Review.",
      409,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }
  const parsed = editProposalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }
  const input = parsed.data;

  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (input.title !== undefined) {
    sets.push("title = ?");
    args.push(input.title);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    args.push(sanitizeContent(input.description));
  }
  if (input.type !== undefined) {
    sets.push("type = ?");
    args.push(input.type);
  }
  if (input.quorumRequired !== undefined) {
    sets.push("quorum_required = ?");
    args.push(input.quorumRequired);
  }
  if (input.metadata !== undefined) {
    sets.push("metadata = ?");
    args.push(JSON.stringify(input.metadata));
  }

  if (sets.length === 0) {
    return apiSuccess<{ proposal: Proposal }>({ proposal });
  }
  sets.push("updated_at = datetime('now')");
  args.push(id);

  await db.execute({
    sql: `UPDATE proposals SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  const updated = await getProposalById(id);
  return apiSuccess<{ proposal: Proposal }>({ proposal: updated ?? proposal });
}
