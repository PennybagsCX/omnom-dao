import { NextResponse } from "next/server";

import { getSnapshotMetadata } from "@/lib/snapshot";
import type { ApiResponse } from "@/types";

/**
 * Health check / liveness probe.
 * GET /api/v1/health → { success: true, data: { status, snapshot } }
 */
export async function GET() {
  let snapshot: { totalHolders: number | null } = { totalHolders: null };
  try {
    const metadata = await getSnapshotMetadata();
    snapshot = { totalHolders: metadata.totalHolders };
  } catch {
    // Snapshot artifact may not be built yet — report null rather than fail.
    snapshot = { totalHolders: null };
  }

  const body: ApiResponse<{ status: string; snapshot: typeof snapshot }> = {
    success: true,
    data: { status: "ok", snapshot },
  };
  return NextResponse.json(body);
}
