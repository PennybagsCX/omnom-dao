import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { getDelegationInfo } from "@/lib/delegation";
import { addressSchema } from "@/lib/validators";
import { ErrorCode, type DelegationInfo } from "@/types";

/**
 * GET /api/v1/delegation/[address]
 *
 * Public. Returns the delegation state for a given address:
 * outgoing delegation (if any), incoming count, and the list of delegators
 * who delegate to this address. Addresses are lowercased on read.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const parsed = addressSchema.safeParse(address);
  if (!parsed.success) {
    return apiError(ErrorCode.INVALID_ADDRESS, "Invalid wallet address.", 400);
  }

  const info = await getDelegationInfo(parsed.data);
  return apiSuccess<DelegationInfo>(info);
}
