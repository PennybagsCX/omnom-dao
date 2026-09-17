import { type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

import { apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { finalizeExpiredProposals, type FinalizeResult } from "@/lib/proposal-finalize";
import { notifyEndingSoon } from "@/lib/notifications";

/**
 * POST|GET /api/v1/cron/finalize
 *
 * Sweep all ACTIVE proposals whose voting window has elapsed and finalize
 * them (transition to PASSED / FAILED / EXPIRED with computed tallies), and
 * fan out VOTING_ENDING_SOON notifications for proposals closing within 24h.
 *
 * Cadence: driven primarily by the GitHub Actions 30-minute pinger
 * (.github/workflows/cron-finalize.yml); the Vercel cron in vercel.json
 * (Hobby plan caps it at daily) remains as a fallback floor.
 *
 * Authentication: the caller must provide the CRON_SECRET env var as a
 * Bearer token. This prevents public abuse of the sweep endpoint.
 *
 * The endpoint is also safe to call manually — it is idempotent (proposals
 * already in a terminal state are skipped).
 */

/**
 * Constant-time string comparison to prevent timing attacks on the cron secret.
 * Compares two strings by length first (fast-fail on obviously wrong inputs),
 * then uses `timingSafeEqual` on equal-length buffers.
 */
function safeSecretCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  // Authenticate via shared secret using constant-time comparison.
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !safeSecretCompare(authHeader, `Bearer ${cronSecret}`)) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret." } },
      { status: 401 },
    );
  }

  // Sweep before finalize: a proposal expiring in this same tick must still
  // be ACTIVE to receive its ending-soon wave.
  const endingSoon = await sweepEndingSoon();

  const results = await finalizeExpiredProposals();

  return apiSuccess<{ finalized: FinalizeResult[]; count: number; endingSoon: string[] }>({
    finalized: results,
    count: results.length,
    endingSoon,
  });
}

/**
 * Find ACTIVE proposals whose voting window ends within the next 24h and
 * dispatch the (idempotent) ending-soon notification for each. Returns the
 * ids that entered the notification path.
 */
async function sweepEndingSoon(): Promise<string[]> {
  const res = await db.execute({
    sql: "SELECT id, voting_ends_at FROM proposals WHERE status = 'ACTIVE' AND voting_ends_at IS NOT NULL",
    args: [],
  });
  const now = Date.now();
  const due: string[] = [];
  for (const row of res.rows) {
    const endsMs = Date.parse(row.voting_ends_at as string);
    if (Number.isNaN(endsMs)) continue;
    const remainingH = (endsMs - now) / (60 * 60 * 1000);
    if (remainingH >= 0 && remainingH <= 24) {
      due.push(row.id as string);
    }
  }
  for (const id of due) {
    await notifyEndingSoon(id).catch((err) =>
      console.error("[cron/finalize] ending-soon dispatch failed:", err),
    );
  }
  return due;
}

/** GET alias for cron services that prefer GET. */
export { POST as GET };
