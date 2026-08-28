import { type NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, apiError } from "@/lib/api-response";
import { ErrorCode } from "@/types";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * DELETE /api/v1/proposals/drafts/[id]
 *
 * Delete one of the caller's drafts. Idempotent (deleting a non-existent
 * draft returns 204-equivalent success).
 *
 * Ownership: a draft can only be deleted by the wallet that created it.
 * Attempting to delete another wallet's draft returns 404 (not 403, to
 * avoid leaking the existence of other wallets' drafts).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IdSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) {
      return apiError(
        ErrorCode.UNAUTHORIZED,
        (err as { message?: string }).message,
        (err as { statusCode: number }).statusCode,
      );
    }
    throw err;
  }
  const wallet = session.sub.toLowerCase();
  const params = await context.params;
  const parsed = IdSchema.safeParse(params);
  if (!parsed.success) {
    return apiError(ErrorCode.VALIDATION_ERROR, "Invalid draft id.", 400);
  }
  const { id } = parsed.data;

  const db = getDb();
  const result = await db.execute({
    sql: "DELETE FROM proposal_drafts WHERE id = ? AND wallet_address = ?",
    args: [id, wallet],
  });

  // rowsAffected returns 0 if the row didn't exist OR belonged to another
  // wallet. Either way, the caller-visible outcome is the same (204).
  const rowsAffected =
    typeof result.rowsAffected === "number"
      ? result.rowsAffected
      : typeof result.rowsAffected === "bigint"
        ? Number(result.rowsAffected)
        : 0;

  return apiSuccess({
    id,
    deleted: rowsAffected > 0,
  });
}