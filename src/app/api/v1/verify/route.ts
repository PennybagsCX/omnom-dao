import { type NextRequest } from "next/server";

import {
  consumeNonce,
  parseSiweMessage,
  RATE_WINDOWS,
  registerVerifiedHolder,
  signSession,
  verifySiweSignature,
} from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit, ipBucket } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { lookupHolder } from "@/lib/snapshot";
import { SESSION_COOKIE } from "@/lib/constants";
import { SESSION_COOKIE_ATTRIBUTES } from "@/lib/auth";
import { verifyWalletSchema } from "@/lib/validators";
import { ErrorCode, type HolderClass } from "@/types";

interface VerifyResponseData {
  address: string;
  class: HolderClass;
  balanceRaw: string;
  balanceFormatted: string;
  rank: number;
  votingPower: number;
}

/**
 * POST /api/v1/verify
 *
 * Verify a SIWE signature, validate the nonce, look up the snapshot, register
 * the user (lazy), and issue a JWT in an httpOnly cookie.
 *
 * Body: { message: string, signature: string }
 */
export async function POST(request: NextRequest) {
  // IP rate limit: 10 verifies per IP per 5 minutes.
  const ip = getClientIp(request);
  const rl = await checkRateLimit(
    ipBucket(ip),
    RATE_WINDOWS.verifyPerIp.limit,
    RATE_WINDOWS.verifyPerIp.windowSeconds,
  );
  if (!rl.allowed) {
    return apiError(ErrorCode.RATE_LIMITED, "Too many verify attempts. Slow down.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const parsed = verifyWalletSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.MISSING_FIELDS, parsed.error.issues[0]?.message, 400);
  }

  const { message, signature } = parsed.data;

  // Parse first to obtain the claimed address + nonce for lookup.
  let claimed;
  try {
    claimed = parseSiweMessage(message);
  } catch {
    return apiError(ErrorCode.INVALID_SIGNATURE, "Malformed SIWE message.", 401);
  }

  // Verify the signature FIRST. This is important: consuming the nonce before a
  // valid signature is proven would let an attacker burn a victim's nonce by
  // sending a garbage signature for that address (a targeted login-DoS).
  // After recovery succeeds we consume the nonce (single-use) — concurrent
  // replays of a captured signature race on the single-use delete and only one
  // wins.
  const result = await verifySiweSignature(message, signature);
  if (!result.ok || !result.address) {
    return apiError(result.error ?? ErrorCode.INVALID_SIGNATURE, undefined, 401);
  }

  // Consume + validate the nonce (single-use), keyed by the *recovered* address.
  const nonceOk = await consumeNonce(result.address, claimed.nonce);
  if (!nonceOk) {
    return apiError(ErrorCode.NONCE_EXPIRED, undefined, 401);
  }

  // Snapshot lookup — only snapshot holders may sign in.
  const holder = await lookupHolder(result.address);
  if (!holder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 404);
  }

  // Register / refresh the user row.
  const { user } = await registerVerifiedHolder(result.address);

  // FIX: Handle BigInt balanceRaw properly for voting power calculation
  let votingPower: number;
  if (typeof holder.balanceRaw === 'bigint') {
    // Convert BigInt to number by dividing first, then converting
    votingPower = Number(holder.balanceRaw / BigInt(1e18));
  } else {
    // Fallback for string balanceRaw
    votingPower = Number(holder.balanceRaw) / 1e18;
  }

  // Issue JWT.
  const token = await signSession({
    walletAddress: user.walletAddress,
    holderClass: holder.holderClass,
    votingPower,
  });

  // The JWT is delivered ONLY via the httpOnly cookie below. It must never be
  // echoed in the response body — doing so would expose it to client-side JS
  // and defeat the httpOnly / XSS-session-theft mitigation (WALLET-FLOW §6.2).
  const responseData: VerifyResponseData = {
    address: user.walletAddress,
    class: holder.holderClass,
    balanceRaw: holder.balanceRaw.toString(),
    balanceFormatted: holder.balanceFormatted,
    rank: holder.rank,
    votingPower,
  };

  const response = apiSuccess<VerifyResponseData>(responseData);
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_ATTRIBUTES);
  return response;
}
