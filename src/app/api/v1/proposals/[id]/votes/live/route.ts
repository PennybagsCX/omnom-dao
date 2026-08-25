import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { ErrorCode } from "@/types";

/**
 * Live vote counting endpoint for real-time updates.
 * GET /api/v1/proposals/[id]/votes/live
 * 
 * Returns current vote totals with caching headers.
 * Part of Phase 1: Core Voting Infrastructure enhancement.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Fetch vote totals from database
    const result = await db.execute({
      sql: `
        SELECT 
          choice,
          SUM(voting_power) as total
        FROM votes 
        WHERE proposal_id = ? 
        GROUP BY choice
      `,
      args: [id],
    });

    // Initialize counts
    let votesFor = 0;
    let votesAgainst = 0;
    let votesAbstain = 0;

    // Aggregate results
    for (const row of result.rows) {
      const choice = row.choice as string;
      const total = Number(row.total ?? 0);
      
      if (choice === 'FOR') votesFor = total;
      else if (choice === 'AGAINST') votesAgainst = total;
      else if (choice === 'ABSTAIN') votesAbstain = total;
    }

    // Return with cache headers for polling
    const response = apiSuccess({
      proposalId: id,
      votesFor,
      votesAgainst,
      votesAbstain,
      timestamp: new Date().toISOString(),
    });

    // Add cache headers to prevent excessive polling
    response.headers.set('Cache-Control', 'private, max-age=2'); // 2 second cache
    response.headers.set('X-Refresh-Interval', '5'); // Suggested poll interval

    return response;
  } catch (error) {
    console.error('Error fetching live votes:', error);
    return apiError(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch live vote data',
      500,
    );
  }
}
