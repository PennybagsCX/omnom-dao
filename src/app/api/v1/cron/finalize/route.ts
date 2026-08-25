import { type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

import { apiSuccess } from "@/lib/api-response";
import { finalizeExpiredProposals, type FinalizeResult } from "@/lib/proposal-finalize";

/**
 * POST /api/v1/cron/finalize
 *
 * Sweep all ACTIVE proposals whose voting window has elapsed and finalize
 * them (transition to PASSED / FAILED / EXPIRED with computed tallies).
 *
 * This endpoint is intended to be called by an external cron scheduler
 * (e.g. Vercel Cron, GitHub Actions, or a simple cron-job.org trigger)
 * at a regular interval (recommended: every 15–30 minutes).
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

  const results = await finalizeExpiredProposals();

  return apiSuccess<{ finalized: FinalizeResult[]; count: number }>({
    finalized: results,
    count: results.length,
  });
}

/** GET alias for cron services that prefer GET. */
export { POST as GET };
