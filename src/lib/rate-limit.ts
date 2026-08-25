import { kv } from "@vercel/kv";

/**
 * Vercel KV-backed rate limiting.
 *
 * Implements a fixed-window counter per "bucket" key. When KV is unavailable
 * (e.g. local development without KV credentials), behavior depends on the
 * `failClosed` parameter:
 *
 *   - failClosed = false (default, legacy): degrade to "allow" — keeps dev usable.
 *   - failClosed = true (P0 hardening): degrade to "DENY" — protects critical
 *     governance routes (vote, proposal creation, delegation) from abuse when
 *     KV goes down in production.
 *
 * Windows are tracked by the bucket's TTL: each bucket is created with an
 * expiry equal to the window length, so counters auto-expire.
 */

/** Result of a rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Unix seconds when the window resets. */
  resetAt: number;
  /** Current count in the window. */
  count: number;
}

let kvAvailable: boolean | null = null;

function isKvAvailable(): boolean {
  if (kvAvailable !== null) return kvAvailable;
  const url = process.env.KV_REST_API_URL ?? process.env.KV_URL;
  kvAvailable = Boolean(url);
  if (!kvAvailable) {
    console.warn(
      "[rate-limit] Vercel KV is not configured (KV_REST_API_URL / KV_URL missing). " +
        "Rate limits are disabled — set up KV before production.",
    );
  }
  return kvAvailable;
}

/**
 * Check a fixed-window counter. Returns whether the caller is allowed to
 * proceed, and increments the counter if so.
 *
 * @param bucket  - logical bucket key (e.g. `api:ip:1.2.3.4`)
 * @param limit   - max requests allowed in the window
 * @param windowSeconds - window length in seconds
 * @param failClosed - when true and KV is unavailable, DENY instead of allowing.
 *                     Use for critical governance routes (vote, proposal, delegation).
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
  failClosed = false,
): Promise<RateLimitResult> {
  const resetAt = Math.floor(Date.now() / 1000) + windowSeconds;

  if (!isKvAvailable()) {
    // P0 HARDENING: fail-closed for critical routes.
    if (failClosed && process.env.NODE_ENV === "production") {
      console.error(
        `[rate-limit] FAIL-CLOSED: KV unavailable, denying request to bucket "${bucket}" ` +
        `(failClosed=true, production). This protects governance integrity during outages.`,
      );
      return { allowed: false, remaining: 0, resetAt, count: 0 };
    }
    // Dev/legacy: fail open.
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt, count: 0 };
  }

  try {
    const count = await kv.incr(bucket);
    if (count === 1) {
      // First request in the window — set the TTL so the counter expires.
      await kv.expire(bucket, windowSeconds);
    }
    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt, count };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), resetAt, count };
  } catch {
    // KV failure during operation.
    if (failClosed && process.env.NODE_ENV === "production") {
      console.error(
        `[rate-limit] FAIL-CLOSED: KV error for bucket "${bucket}", denying request.`,
      );
      return { allowed: false, remaining: 0, resetAt, count: 0 };
    }
    // Legacy: fail open.
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt, count: 0 };
  }
}

/** Convenience: build a per-IP general API bucket key. */
export function ipBucket(ip: string): string {
  return `rl:api:ip:${ip}`;
}

/** Per-user action bucket (e.g. proposal creation, comments). */
export function userActionBucket(action: string, address: string): string {
  return `rl:${action}:${address.toLowerCase()}`;
}
