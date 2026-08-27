import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import {
  createDelegation,
  countIncomingDelegations,
  revokeDelegation,
  MAX_INCOMING_DELEGATIONS,
  type CreateDelegationResult,
} from "@/lib/delegation";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { lookupHolder } from "@/lib/snapshot";
import { createDelegationSchema } from "@/lib/validators";
import {
  ErrorCode,
  type Delegation,
} from "@/types";

/**
 * Delegation endpoints.
 *
 * POST   /api/v1/delegation        — create delegation (auth, 24h time-lock).
 * DELETE /api/v1/delegation        — revoke delegation (auth, instant).
 *
 * Per GOVERNANCE_MECHANICS.md §11: 100% delegation only, one active
 * delegation per delegator, max 500 incoming per delegatee.
 */

/** POST /api/v1/delegation — create a new delegation (pending for 24h). */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const delegatorAddress = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const parsed = createDelegationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.INVALID_ADDRESS, parsed.error.issues[0]?.message, 400);
  }
  const delegateeAddress = parsed.data.delegateeAddress;

  // Cannot delegate to self.
  if (delegatorAddress === delegateeAddress) {
    return apiError(ErrorCode.INVALID_DELEGATION, "You cannot delegate to yourself.", 400);
  }

  // Both addresses must be verified snapshot holders.
  const [delegatorHolder, delegateeHolder] = await Promise.all([
    lookupHolder(delegatorAddress),
    lookupHolder(delegateeAddress),
  ]);
  if (!delegatorHolder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 403);
  }
  if (!delegateeHolder) {
    return apiError(
      ErrorCode.NOT_IN_SNAPSHOT,
      "The delegatee address is not a verified holder.",
      404,
    );
  }

  // Enforce the 500-incoming-delegations cap on the delegatee.
  const incomingCount = await countIncomingDelegations(delegateeAddress);
  if (incomingCount >= MAX_INCOMING_DELEGATIONS) {
    return apiError(
      ErrorCode.DELEGATION_LIMIT,
      `This delegatee has reached the maximum of ${MAX_INCOMING_DELEGATIONS} incoming delegations.`,
      409,
    );
  }

  // The service layer revokes any existing active delegation first.
  let result: CreateDelegationResult;
  try {
    result = await createDelegation(delegatorAddress, delegateeAddress);
  } catch {
    // UNIQUE(delegator_address) race — another delegation landed first.
    return apiError(
      ErrorCode.DELEGATION_EXISTS,
      "You already have an active delegation. Try again.",
      409,
    );
  }

  // Both holders were resolved above for gating — reuse for inline badges.
  result.delegation.delegatorClass = delegatorHolder.holderClass;
  result.delegation.delegateeClass = delegateeHolder.holderClass;

  return apiSuccess<CreateDelegationResult>(result, undefined, 201);
}

/** DELETE /api/v1/delegation — revoke the caller's delegation instantly. */
export async function DELETE() {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(err.code, undefined, err.statusCode);
    throw err;
  }
  const delegatorAddress = session.sub.toLowerCase();

  const revoked = await revokeDelegation(delegatorAddress);
  if (!revoked) {
    return apiError(ErrorCode.DELEGATION_NOT_FOUND, undefined, 404);
  }

  return apiSuccess<{ delegation: Delegation }>({ delegation: revoked });
}
