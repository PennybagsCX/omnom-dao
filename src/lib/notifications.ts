import { db } from "@/lib/db";
import { getProposalById } from "@/lib/proposal-service";
import { getUserSettings, getUserIdByAddress } from "@/lib/user-settings";
import { notifyUserTelegram } from "@/lib/telegram";
import { sendNotificationEmail } from "@/lib/email";
import { NOTIFICATION_TYPE_CONFIG } from "@/lib/constants";
import {
  NotificationType,
  ProposalStatus,
  type Notification,
} from "@/types";

/**
 * Notification service (GOVERNANCE_MECHANICS.md §14, TECHNICAL_ARCHITECTURE.md §4).
 *
 * Three channels:
 *   1. In-app  — a row in the `notifications` table (always written).
 *   2. Telegram — sent via @DBOT_DC_BOT when the user has Telegram enabled.
 *   3. Email    — sent via Resend when the user has email enabled.
 *
 * CRITICAL — graceful degradation: every public helper here swallows delivery
 * errors. Telegram / Email failures are logged but never re-thrown, so a
 * notification dispatch can never break a core governance operation (creating
 * a proposal, casting a vote, posting a comment). The in-app record is the
 * source of truth; the push channels are best-effort fan-out.
 */

// ─────────────────────────────────────────────────────────────
// Row mapping
// ─────────────────────────────────────────────────────────────

const NOTIFICATION_COLS =
  "id, user_id, type, title, body, read, proposal_id, created_at";

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    title: row.title as string,
    body: row.body as string,
    read: Number(row.read) === 1,
    proposalId: (row.proposal_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ─────────────────────────────────────────────────────────────
// Core create + dispatch
// ─────────────────────────────────────────────────────────────

interface CreateParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  proposalId?: string | null;
}

/**
 * Write an in-app notification row and fan out to the user's enabled push
 * channels (Telegram, Email). Honors per-type preferences.
 *
 * Never throws — all delivery failures are caught + logged.
 */
export async function createNotification(params: CreateParams): Promise<void> {
  const settings = await getUserSettings(params.userId).catch(() => null);
  if (!settings) return;

  // Per-type preference gate.
  if (!prefEnabled(settings.notifications, params.type)) return;

  // 1. Always persist the in-app record.
  try {
    await db.execute({
      sql: `INSERT INTO notifications (user_id, type, title, body, proposal_id)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        params.userId,
        params.type,
        truncate(params.title, 100),
        truncate(params.body, 500),
        params.proposalId ?? null,
      ],
    });
  } catch (err) {
    console.error("[notifications] failed to write in-app row:", err);
    return;
  }

  // 2. Telegram fan-out (best-effort).
  if (settings.telegram.enabled && settings.telegram.chatId) {
    await notifyUserTelegram(
      settings.telegram.chatId,
      params.title,
      params.body,
    ).catch((err) =>
      console.error("[notifications] telegram dispatch error:", err),
    );
  }

  // 3. Email fan-out (best-effort).
  if (settings.email.enabled && settings.email.address) {
    await sendNotificationEmail(
      settings.email.address,
      params.type,
      params.title,
      params.body,
    ).catch((err) =>
      console.error("[notifications] email dispatch error:", err),
    );
  }
}

/** Map a notification type to its user preference flag. */
function prefEnabled(
  prefs: {
    proposalCreated: boolean;
    votingStarted: boolean;
    votingEndingSoon: boolean;
    proposalResult: boolean;
    mention: boolean;
  },
  type: NotificationType,
): boolean {
  switch (type) {
    case NotificationType.PROPOSAL_CREATED:
      return prefs.proposalCreated;
    case NotificationType.VOTING_STARTED:
      return prefs.votingStarted;
    case NotificationType.VOTING_ENDING_SOON:
      return prefs.votingEndingSoon;
    case NotificationType.PROPOSAL_RESULT:
      return prefs.proposalResult;
    case NotificationType.MENTION:
      return prefs.mention;
    default:
      return true;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ─────────────────────────────────────────────────────────────
// Fan-out to a set of recipients (used by broadcast helpers)
// ─────────────────────────────────────────────────────────────

/** Create a notification for each recipient user id. */
async function broadcast(
  userIds: Iterable<string>,
  type: NotificationType,
  title: string,
  body: string,
  proposalId?: string | null,
): Promise<void> {
  const ids = Array.from(userIds);
  // Fan out concurrently instead of sequentially (C7.1). Batch in chunks to
  // bound concurrent DB writes / network calls for large recipient lists.
  const CONCURRENCY = 25;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map((userId) =>
        createNotification({ userId, type, title, body, proposalId }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Event helpers — wire these into proposal / vote / comment routes
// ─────────────────────────────────────────────────────────────

/**
 * Notify on a new proposal being created.
 *
 * v1 fan-out target: all verified holders (the snapshot). For scale this is
 * fanned out sequentially; if the snapshot grows large this should move to a
 * background job queue. Each user's per-type preference still applies.
 *
 * @param proposalId   the new proposal id
 * @param proposerAddress  the author (excluded from notifications)
 */
export async function notifyProposalCreated(
  proposalId: string,
  proposerAddress: string,
): Promise<void> {
  const proposal = await getProposalById(proposalId);
  if (!proposal) return;

  const title = `${NOTIFICATION_TYPE_CONFIG[NotificationType.PROPOSAL_CREATED].emoji} New proposal: ${proposal.title}`;
  const body = `A new ${proposal.type.toLowerCase().replace(/_/g, " ")} proposal was submitted by ${shortAddr(proposerAddress)}. Review and discuss before voting opens.`;

  // v1: notify all known users (excluding the proposer). Loaded from the DB so
  // we only target registered (verified) holders rather than the raw snapshot.
  const res = await db.execute({
    sql: "SELECT id FROM users WHERE wallet_address != ?",
    args: [proposerAddress.toLowerCase()],
  });
  const userIds = res.rows.map((r) => r.id as string);
  await broadcast(userIds, NotificationType.PROPOSAL_CREATED, title, body, proposalId);
}

/**
 * Notify that voting has started on a proposal.
 *
 * v1 fan-out target: all verified holders.
 */
export async function notifyVotingStarted(proposalId: string): Promise<void> {
  const proposal = await getProposalById(proposalId);
  if (!proposal || proposal.status !== ProposalStatus.ACTIVE) return;

  const title = `${NOTIFICATION_TYPE_CONFIG[NotificationType.VOTING_STARTED].emoji} Voting started: ${proposal.title}`;
  const body = `Voting is now open and closes ${proposal.votingEndsAt ?? "soon"}. Cast your vote — every token counts.`;

  const res = await db.execute({ sql: "SELECT id FROM users", args: [] });
  const userIds = res.rows.map((r) => r.id as string);
  await broadcast(userIds, NotificationType.VOTING_STARTED, title, body, proposalId);
}

/**
 * Notify that a proposal's voting window ends within 24h.
 *
 * Typically invoked by a cron job, or lazily on access. Idempotent-ish: it
 * will create duplicate notifications if called repeatedly, so callers should
 * guard invocation (e.g. once per proposal per cron tick).
 */
export async function notifyEndingSoon(proposalId: string): Promise<void> {
  const proposal = await getProposalById(proposalId);
  if (!proposal || proposal.status !== ProposalStatus.ACTIVE || !proposal.votingEndsAt) {
    return;
  }
  const endsMs = Date.parse(proposal.votingEndsAt);
  if (Number.isNaN(endsMs)) return;
  const remainingH = (endsMs - Date.now()) / (60 * 60 * 1000);
  if (remainingH < 0 || remainingH > 24) return;

  const title = `${NOTIFICATION_TYPE_CONFIG[NotificationType.VOTING_ENDING_SOON].emoji} Ending soon: ${proposal.title}`;
  const body = `Less than 24 hours remain to vote. The proposal closes at ${proposal.votingEndsAt}.`;

  const res = await db.execute({ sql: "SELECT id FROM users", args: [] });
  const userIds = res.rows.map((r) => r.id as string);
  await broadcast(userIds, NotificationType.VOTING_ENDING_SOON, title, body, proposalId);
}

/**
 * Notify the result of a proposal once voting closes.
 *
 * @param proposalId  the closed proposal
 */
export async function notifyVoteResult(proposalId: string): Promise<void> {
  const proposal = await getProposalById(proposalId);
  if (!proposal) return;

  const passed = proposal.status === ProposalStatus.PASSED;
  const emoji = NOTIFICATION_TYPE_CONFIG[NotificationType.PROPOSAL_RESULT].emoji;
  const outcome = passed ? "passed" : proposal.status === ProposalStatus.FAILED ? "failed" : "closed";
  const title = `${emoji} Result: ${proposal.title}`;
  const body = `The proposal has ${outcome}. For: ${proposal.votesFor.toLocaleString()} · Against: ${proposal.votesAgainst.toLocaleString()} · Abstain: ${proposal.votesAbstain.toLocaleString()}.`;

  const res = await db.execute({ sql: "SELECT id FROM users", args: [] });
  const userIds = res.rows.map((r) => r.id as string);
  await broadcast(userIds, NotificationType.PROPOSAL_RESULT, title, body, proposalId);
}

/**
 * Notify a user they were @mentioned in a comment.
 *
 * @param proposalId       the proposal the comment belongs to
 * @param commentId        the comment id (not persisted; informational)
 * @param mentionedAddress the wallet address that was mentioned
 */
export async function notifyMention(
  proposalId: string,
  commentId: string,
  mentionedAddress: string,
): Promise<void> {
  const userId = await getUserIdByAddress(mentionedAddress);
  if (!userId) return;

  const proposal = await getProposalById(proposalId);
  const proposalTitle = proposal?.title ?? "a proposal";
  const title = `${NOTIFICATION_TYPE_CONFIG[NotificationType.MENTION].emoji} You were mentioned`;
  const body = `You were mentioned in a comment on "${proposalTitle}" (comment ${commentId}).`;

  await createNotification({
    userId,
    type: NotificationType.MENTION,
    title,
    body,
    proposalId,
  });
}

/**
 * Extract @0x-prefixed wallet addresses from a comment body and emit a MENTION
 * notification for each (used by the comment route).
 */
export async function notifyMentionsFromContent(
  proposalId: string,
  commentId: string,
  content: string,
): Promise<void> {
  const matches = content.match(/@0x[a-fA-F0-9]{40}/g);
  if (!matches) return;
  const seen = new Set<string>();
  for (const match of matches) {
    const addr = match.slice(1); // strip the leading @
    if (seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());
    await notifyMention(proposalId, commentId, addr);
  }
}

// ─────────────────────────────────────────────────────────────
// Read-side helpers (used by the notification API routes)
// ─────────────────────────────────────────────────────────────

/** List notifications for a user, optionally filtered to unread. */
export async function listNotifications(
  userId: string,
  opts: { unreadOnly: boolean; page: number; limit: number },
): Promise<{ notifications: Notification[]; unreadCount: number; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const where = opts.unreadOnly ? "WHERE user_id = ? AND read = 0" : "WHERE user_id = ?";

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) AS cnt FROM notifications ${where}`,
    args: [userId],
  });
  const total = Number(countRes.rows[0]?.cnt ?? 0);

  const res = await db.execute({
    sql: `SELECT ${NOTIFICATION_COLS} FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    args: [userId, opts.limit, offset],
  });
  const notifications = res.rows.map((r) =>
    rowToNotification(r as unknown as Record<string, unknown>),
  );

  const unreadRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read = 0",
    args: [userId],
  });
  const unreadCount = Number(unreadRes.rows[0]?.cnt ?? 0);

  return { notifications, unreadCount, total };
}

/** Count unread notifications for a user. */
export async function countUnread(userId: string): Promise<number> {
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read = 0",
    args: [userId],
  });
  return Number(res.rows[0]?.cnt ?? 0);
}

/** Mark a single notification as read. Returns true if a row was updated. */
export async function markRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const res = await db.execute({
    sql: "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ? AND read = 0",
    args: [notificationId, userId],
  });
  return (res.rowsAffected ?? 0) > 0;
}

/** Mark all of a user's notifications as read. Returns the count updated. */
export async function markAllRead(userId: string): Promise<number> {
  const res = await db.execute({
    sql: "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0",
    args: [userId],
  });
  return res.rowsAffected ?? 0;
}

/** Short-form address for human-readable copy (0x1234…abcd). */
function shortAddr(address: string): string {
  const a = address.toLowerCase();
  return a.length < 10 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`;
}
