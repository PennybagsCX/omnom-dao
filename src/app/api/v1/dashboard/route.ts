import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import {
  getSession,
  requireAuth,
  UnauthorizedError,
} from "@/lib/auth";
import { lookupHolder } from "@/lib/snapshot";
import { ErrorCode, type HolderClass, type Proposal } from "@/types";
import { emptyEmojiCounts } from "@/lib/emoji-reactions";

/**
 * GET /api/v1/dashboard
 *
 * Authenticated user's dashboard: profile, recent votes, authored proposals,
 * and an unread notification summary.
 */

interface DashboardData {
  profile: {
    address: string;
    displayName: string;
    class: HolderClass;
    balanceFormatted: string;
    rank: number;
    votingPower: number;
    createdAt: string;
  };
  recentVotes: Array<{
    proposalId: string;
    choice: string;
    votingPower: number;
    createdAt: string;
  }>;
  authoredProposals: Proposal[];
  notifications: {
    unread: number;
    recent: Array<{
      id: string;
      type: string;
      title: string;
      read: boolean;
      createdAt: string;
    }>;
  };
}

export async function GET() {
  let session;
  try {
    session = await getSession();
    if (!session) throw new UnauthorizedError(ErrorCode.UNAUTHORIZED);
    // Touch requireAuth to keep the auth contract uniform.
    void (await requireAuth());
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    return apiError(ErrorCode.INTERNAL_ERROR, undefined, 500);
  }
  const address = session.sub.toLowerCase();

  try {
    const userRes = await db.execute({
    sql: "SELECT id, wallet_address, display_name, created_at FROM users WHERE wallet_address = ?",
    args: [address],
  });
  if (userRes.rows.length === 0) {
    return apiError(ErrorCode.USER_NOT_FOUND, undefined, 404);
  }
  const userRow = userRes.rows[0]!;
  const holder = await lookupHolder(address);
  if (!holder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 404);
  }

  const recentVotesRes = await db.execute({
    sql:
      "SELECT proposal_id, choice, voting_power, created_at FROM votes " +
      "WHERE voter_address = ? ORDER BY created_at DESC LIMIT 10",
    args: [address],
  });
  const recentVotes = recentVotesRes.rows.map((r) => ({
    proposalId: r.proposal_id as string,
    choice: r.choice as string,
    votingPower: Number(r.voting_power ?? 0),
    createdAt: r.created_at as string,
  }));

  const authoredRes = await db.execute({
    sql:
      "SELECT id, title, description, type, status, author_address, created_at, updated_at, " +
      "voting_starts_at, voting_ends_at, quorum_required, quorum_achieved, " +
      "votes_for, votes_against, votes_abstain, metadata FROM proposals " +
      "WHERE author_address = ? ORDER BY created_at DESC LIMIT 10",
    args: [address],
  });
  const authoredProposals: Proposal[] = authoredRes.rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    type: r.type as Proposal["type"],
    status: r.status as Proposal["status"],
    authorAddress: r.author_address as string,
    authorHolderClass: holder.holderClass,
    createdAt: r.created_at as string,
    votingStartsAt: (r.voting_starts_at as string | null) ?? null,
    votingEndsAt: (r.voting_ends_at as string | null) ?? null,
    quorumRequired: r.quorum_required as number,
    quorumAchieved: (r.quorum_achieved as number | null) ?? null,
    votesFor: r.votes_for as number,
    votesAgainst: r.votes_against as number,
    votesAbstain: r.votes_abstain as number,
    metadata: safeMeta(r.metadata as string),
    // Dashboard surfaces authored proposals with no emoji counts hydrated —
    // the list page (which fetches the user's authored set) doesn't render the
    // emoji bar, so zero defaults are correct.
    emojiReactionCounts: emptyEmojiCounts(),
    myEmojiReaction: null,
  }));

  const unreadRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read = 0",
    args: [userRow.id as string],
  });
  const unread = Number(unreadRes.rows[0]?.cnt ?? 0);

  const recentNotifRes = await db.execute({
    sql:
      "SELECT id, type, title, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
    args: [userRow.id as string],
  });
  const recentNotifications = recentNotifRes.rows.map((r) => ({
    id: r.id as string,
    type: r.type as string,
    title: r.title as string,
    read: Boolean(r.read),
    createdAt: r.created_at as string,
  }));

  const data: DashboardData = {
    profile: {
      address: userRow.wallet_address as string,
      displayName: (userRow.display_name as string) || (userRow.wallet_address as string),
      class: holder.holderClass,
      balanceFormatted: holder.balanceFormatted,
      rank: holder.rank,
      votingPower: session.votingPower,
      createdAt: userRow.created_at as string,
    },
    recentVotes,
    authoredProposals,
    notifications: { unread, recent: recentNotifications },
  };

    return apiSuccess<DashboardData>(data);
  } catch (error) {
    // BUG-2: surface a clean error envelope when the DB is unavailable instead
    // of throwing an unhandled error that leaves the dashboard stuck.
    console.error("[api/dashboard] GET error:", error);
    return apiInternalError("Unable to load dashboard.");
  }
}

function safeMeta(raw: string): Proposal["metadata"] {
  try {
    return JSON.parse(raw) as Proposal["metadata"];
  } catch {
    return { type: "base", links: [], tags: [] };
  }
}
