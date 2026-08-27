import { type NextRequest } from "next/server";

import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { listProposals } from "@/lib/proposal-service";
import {
  canCreateProposalType,
  RATE_WINDOWS,
  requireAuth,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { sanitizeContent } from "@/lib/sanitize";
import { createProposalSchema, getProposalsSchema } from "@/lib/validators";
import { RATE_LIMITS } from "@/lib/constants";
import { notifyProposalCreated } from "@/lib/notifications";
import { lookupHolder } from "@/lib/snapshot";
import {
  ErrorCode,
  ProposalStatus,
  type Proposal,
} from "@/types";

/**
 * Proposals collection.
 *
 * GET  /api/v1/proposals  — list proposals (public, paginated).
 * POST /api/v1/proposals  — create proposal (auth + holder + tier gate).
 */

const DEFAULT_DURATION_BY_TYPE: Record<string, number> = {
  CHAIN_SELECTION: 336,
  TOKENOMICS_CHANGE: 336,
  TREASURY: 168,
  GUIDELINE: 168,
  TECHNICAL: 168,
  GENERAL: 168,
};

const MIN_DURATION_BY_TYPE: Record<string, number> = {
  CHAIN_SELECTION: 168,
  TOKENOMICS_CHANGE: 168,
  TREASURY: 72,
  GUIDELINE: 72,
  TECHNICAL: 72,
  GENERAL: 72,
};

const DEFAULT_QUORUM_BY_TYPE: Record<string, number> = {
  CHAIN_SELECTION: 15.0,
  TOKENOMICS_CHANGE: 15.0,
  TREASURY: 10.0,
  GUIDELINE: 10.0,
  TECHNICAL: 10.0,
  GENERAL: 10.0,
};

/** GET /api/v1/proposals — public, paginated, filterable list. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = getProposalsSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? url.searchParams.get("limit") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    sortBy: url.searchParams.get("sort") ?? url.searchParams.get("sortBy") ?? undefined,
    sortOrder: url.searchParams.get("sortOrder") ?? undefined,
  });
  if (!params.success) {
    return apiError(ErrorCode.MISSING_FIELDS, params.error.issues[0]?.message, 400);
  }

  const page = params.data.page;
  const limit = params.data.pageSize;
  const offset = (page - 1) * limit;

  try {
    const { proposals, total } = await listProposals({
      status: params.data.status,
      type: params.data.type,
      sortBy: params.data.sortBy,
      sortOrder: params.data.sortOrder,
      limit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return apiSuccess<{ proposals: Proposal[] }>(
      { proposals },
      { page, pageSize: limit, totalItems: total, totalPages },
    );
  } catch (error) {
    // BUG-2: surface a clean error envelope (e.g. when the DB is unavailable)
    // instead of throwing an unhandled error that leaves the client stuck.
    console.error("[api/proposals] GET error:", error);
    return apiInternalError("Unable to fetch proposals.");
  }
}

/** POST /api/v1/proposals — create a proposal (auth required). */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const address = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const parsed = createProposalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }
  const input = parsed.data;

  // Tier gate: high-impact types require Shark+.
  if (!canCreateProposalType(session.holderClass, input.type)) {
    return apiError(
      ErrorCode.NOT_VERIFIED,
      "Your holder class is not permitted to create this proposal type.",
      403,
    );
  }

  // Duration validation against per-type minimums.
  const minDuration = MIN_DURATION_BY_TYPE[input.type] ?? 72;
  const requestedDuration = input.durationHours ?? DEFAULT_DURATION_BY_TYPE[input.type] ?? 168;
  if (requestedDuration < minDuration) {
    return apiError(
      ErrorCode.MISSING_FIELDS,
      `Voting duration must be at least ${minDuration}h for this proposal type.`,
      400,
    );
  }

  // Anti-spam: 24h since last proposal.
  const lastProposalRes = await db.execute({
    sql: "SELECT created_at FROM proposals WHERE author_address = ? ORDER BY created_at DESC LIMIT 1",
    args: [address],
  });
  if (lastProposalRes.rows.length > 0) {
    const lastCreatedAt = Date.parse(lastProposalRes.rows[0]!.created_at as string);
    if (!Number.isNaN(lastCreatedAt)) {
      const elapsed = Date.now() - lastCreatedAt;
      if (elapsed < RATE_LIMITS.proposalMinIntervalMs) {
        return apiError(
          ErrorCode.RATE_LIMITED,
          "You must wait 24 hours between proposals.",
          429,
        );
      }
    }
  }

  // Anti-spam: max 3 proposals per rolling 7-day window.
  const rl = await checkRateLimit(
    userActionBucket("proposals", address),
    RATE_WINDOWS.proposalPerUser.limit,
    RATE_WINDOWS.proposalPerUser.windowSeconds,
    true, // failClosed: protect governance integrity
  );
  if (!rl.allowed) {
    return apiError(
      ErrorCode.RATE_LIMITED,
      "You have reached the limit of 3 proposals per week.",
      429,
    );
  }

  const saveAsDraft = Boolean(
    typeof body === "object" && body !== null && (body as { saveAsDraft?: boolean }).saveAsDraft,
  );
  const status = saveAsDraft ? ProposalStatus.DRAFT : ProposalStatus.PENDING_REVIEW;

  const quorum = input.quorumRequired ?? DEFAULT_QUORUM_BY_TYPE[input.type] ?? 10.0;
  // CRITICAL: Sanitize both title and description to prevent XSS payload storage
  const sanitizedTitle = sanitizeContent(input.title);
  const sanitizedBody = sanitizeContent(input.description);
  const metadata = input.metadata ?? { type: "base", links: [], tags: [] };

  const insertRes = await db.execute({
    sql:
      "INSERT INTO proposals (title, description, type, status, author_address, quorum_required, metadata) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [sanitizedTitle, sanitizedBody, input.type, status, address, quorum, JSON.stringify(metadata)],
  });
  const proposalId = insertRes.rows[0]!.id as string;

  // Fire-and-forget: notify verified holders of the new proposal. Only fan out
  // for non-draft submissions (drafts are private until the author submits).
  // The notification service swallows all errors so this can never break the
  // proposal creation.
  if (status !== ProposalStatus.DRAFT) {
    void notifyProposalCreated(proposalId, address).catch((err) =>
      console.error("[notifications] notifyProposalCreated error:", err),
    );
  }

  // Fetch the full row for a consistent response.
  const fetchRes = await db.execute({
    sql: "SELECT id, title, description, type, status, author_address, created_at, updated_at, voting_starts_at, voting_ends_at, quorum_required, quorum_achieved, votes_for, votes_against, votes_abstain, metadata FROM proposals WHERE id = ?",
    args: [proposalId],
  });
  const row = fetchRes.rows[0]!;
  const authorHolder = await lookupHolder(address);
  const proposal: Proposal = {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    type: row.type as Proposal["type"],
    status: row.status as ProposalStatus,
    authorAddress: row.author_address as string,
    authorHolderClass: authorHolder?.holderClass ?? null,
    createdAt: row.created_at as string,
    votingStartsAt: (row.voting_starts_at as string | null) ?? null,
    votingEndsAt: (row.voting_ends_at as string | null) ?? null,
    quorumRequired: row.quorum_required as number,
    quorumAchieved: (row.quorum_achieved as number | null) ?? null,
    votesFor: row.votes_for as number,
    votesAgainst: row.votes_against as number,
    votesAbstain: row.votes_abstain as number,
    metadata: safeMeta(row.metadata as string),
  };

  return apiSuccess<{ proposal: Proposal }>({ proposal }, undefined, 201);
}

function safeMeta(raw: string): Proposal["metadata"] {
  try {
    return JSON.parse(raw) as Proposal["metadata"];
  } catch {
    return { type: "base", links: [], tags: [] };
  }
}
