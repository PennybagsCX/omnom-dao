import { apiSuccess } from "@/lib/api-response";
import { getDelegationLeaderboard } from "@/lib/delegation";
import type { DelegationLeaderboardEntry } from "@/types";

/**
 * GET /api/v1/delegations/leaderboard
 *
 * Public. Returns the top delegates ranked by total incoming delegated
 * voting power (informational — does not affect recorded vote weight).
 * Defaults to the top 20.
 */
export async function GET() {
  const leaderboard = await getDelegationLeaderboard(20);
  return apiSuccess<{ leaderboard: DelegationLeaderboardEntry[] }>({ leaderboard });
}
