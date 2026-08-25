import { type NextRequest } from "next/server";

import { generateNonce, RATE_WINDOWS } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit, userActionBucket } from "@/lib/rate-limit";
import { nonceRequestSchema } from "@/lib/validators";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/nonce
 *
 * Generate a cryptographically random 16-byte hex nonce for the given wallet
 * address and store it in Vercel KV with a 5-minute TTL. Public (no auth).
 *
 * Body: { address: string }
 * Response: { nonce: string, issuedAt: string }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const parsed = nonceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.INVALID_ADDRESS, parsed.error.issues[0]?.message, 400);
  }

  const address = parsed.data.address;

  // Rate limit: max 5 nonce requests per address per 5 minutes (anti-exhaustion).
  const rl = await checkRateLimit(
    userActionBucket("nonce", address),
    RATE_WINDOWS.noncePerAddress.limit,
    RATE_WINDOWS.noncePerAddress.windowSeconds,
  );
  if (!rl.allowed) {
    return apiError(
      ErrorCode.RATE_LIMITED,
      "Too many nonce requests. Please slow down.",
      429,
    );
  }

  const { nonce, issuedAt } = await generateNonce(address);

  return apiSuccess<{ nonce: string; issuedAt: string }>({ nonce, issuedAt });
}
