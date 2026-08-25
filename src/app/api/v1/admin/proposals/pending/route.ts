import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { rowToProposal } from "@/lib/proposal-service";
import { ErrorCode, type Proposal } from "@/types";

/**
 * GET /api/v1/admin/proposals/pending
 *
 * List proposals pending moderator review. Admin/moderator only.
 */
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  if (!isAdminAddress(session.sub)) {
    return apiError(ErrorCode.NOT_VERIFIED, "Admin or moderator access required.", 403);
  }

  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? "20") || 20),
  );
  const offset = (page - 1) * limit;

  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM proposals WHERE status = 'PENDING_REVIEW'",
    args: [],
  });
  const total = Number(countRes.rows[0]?.cnt ?? 0);

  const res = await db.execute({
    sql:
      "SELECT id, title, description, type, status, author_address, created_at, updated_at, " +
      "voting_starts_at, voting_ends_at, quorum_required, quorum_achieved, " +
      "votes_for, votes_against, votes_abstain, metadata FROM proposals " +
      "WHERE status = 'PENDING_REVIEW' ORDER BY created_at ASC LIMIT ? OFFSET ?",
    args: [limit, offset],
  });
  const proposals: Proposal[] = res.rows.map((r) =>
    rowToProposal(r as unknown as Record<string, unknown>),
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return apiSuccess<{ proposals: Proposal[] }>(
    { proposals },
    { page, pageSize: limit, totalItems: total, totalPages },
  );
}
