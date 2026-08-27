import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { recoverMessageAddress } from "viem";
import { kv } from "@vercel/kv";

import {
  ERROR_CODE_MAP,
  HOLDER_CLASS_RANK,
  JWT_MAX_AGE_SECONDS,
  NONCE_TTL_SECONDS,
  PROPOSAL_TYPE_CONFIG,
} from "@/lib/constants";
import { lookupEnrichedSnapshotHolder } from "@/lib/snapshot";
import { db } from "@/lib/db";
// Re-export edge-safe session primitives so existing imports keep working.
export {
  SESSION_COOKIE,
  SESSION_COOKIE_ATTRIBUTES,
  signSession,
  verifySession,
  type SessionClaims,
} from "@/lib/session";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_ATTRIBUTES,
  verifySession,
  type SessionClaims,
} from "@/lib/session";
import { ErrorCode, HolderClass, type User } from "@/types";

/**
 * SIWE + JWT helpers (Node runtime only — API routes / server components).
 *
 * Identity is proven via an off-chain SIWE (EIP-4361) `personal_sign`, verified
 * server-side with viem's `recoverMessageAddress` (EIP-191 + keccak256 + ECDSA).
 * On success a JWT is issued (HS256 via jose) and stored in an httpOnly +
 * Secure + SameSite=Strict cookie.
 *
 * The pure JWT sign/verify logic lives in `@/lib/session` so the edge
 * middleware can verify tokens without bundling Node-only deps.
 *
 * Canonical session lifetime = 7 days (per DESIGN.md + WALLET-FLOW.md).
 */

/** Maximum skew allowed between the SIWE `Issued At` and server time. */
const SIWE_TIME_SKEW_SECONDS = 5 * 60;

/** Error thrown when a protected route is hit without a valid session. */
export class UnauthorizedError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  constructor(code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    super(ERROR_CODE_MAP[code].message);
    this.name = "UnauthorizedError";
    this.code = code;
    this.statusCode = ERROR_CODE_MAP[code].status;
  }
}

// ─────────────────────────────────────────────────────────────
// Rate-limit windows (per GOVERNANCE_MECHANICS.md §10.3 + §11.4)
// ─────────────────────────────────────────────────────────────

export const RATE_WINDOWS = {
  /** General API: 60 req/min per IP. */
  apiPerIp: { limit: 60, windowSeconds: 60 },
  /** Nonce endpoint: 5 per address per 5 minutes. */
  noncePerAddress: { limit: 5, windowSeconds: 5 * 60 },
  /** Verify endpoint: 10 per IP per 5 minutes. */
  verifyPerIp: { limit: 10, windowSeconds: 5 * 60 },
  /** Proposals: max 3 per 7-day window per user. */
  proposalPerUser: { limit: 3, windowSeconds: 7 * 24 * 60 * 60 },
  /** Comments: 30 per day per user. */
  commentPerUser: { limit: 30, windowSeconds: 24 * 60 * 60 },
} as const;

export { JWT_MAX_AGE_SECONDS };

// ─────────────────────────────────────────────────────────────
// Cookie + session reading (via next/headers)
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the canonical site hostname for SIWE domain validation.
 * Falls back to localhost in development.
 */
function getSiteHostname(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

/** Read + verify the session cookie via next/headers (server components + routes). */
export async function getSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Convenience: the authenticated wallet address, or null. Returns lowercase for DB consistency. */
export async function getSessionAddress(): Promise<string | null> {
  const session = await getSession();
  return session?.sub?.toLowerCase() ?? null;
}

/**
 * Server-component / route-handler session accessor.
 * Returns the full claims, or null when unauthenticated.
 */
export async function getServerSession(): Promise<SessionClaims | null> {
  return getSession();
}

/**
 * Require an authenticated session. Returns the verified claims.
 * @throws {@link UnauthorizedError} when no valid session exists.
 */
export async function requireAuth(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError(ErrorCode.UNAUTHORIZED);
  return session;
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(): string {
  const attrs = SESSION_COOKIE_ATTRIBUTES;
  return `${SESSION_COOKIE}=; Path=${attrs.path}; Max-Age=0; HttpOnly; SameSite=${attrs.sameSite}${attrs.secure ? "; Secure" : ""}`;
}

// ─────────────────────────────────────────────────────────────
// Nonce store (Vercel KV, 5-min TTL, single-use)
// ─────────────────────────────────────────────────────────────

function nonceKey(address: string): string {
  return `nonce:${address.toLowerCase()}`;
}

/**
 * Generate a cryptographically random 16-byte hex nonce and store it in KV
 * keyed by the wallet address with a 5-minute TTL. Overwrites any prior nonce
 * for the address.
 */
export async function generateNonce(address: string): Promise<{
  nonce: string;
  issuedAt: string;
}> {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();

  try {
    await kv.set(nonceKey(address), nonce, { ex: NONCE_TTL_SECONDS });
  } catch {
    // KV unavailable — nonce validation will be skipped in dev. We still
    // return the nonce so the SIWE round-trip works locally.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] KV unavailable — nonce not persisted (dev only).");
    }
  }

  return { nonce, issuedAt };
}

/**
 * Validate + consume the nonce for an address. Single-use: the nonce is
 * deleted immediately regardless of whether it matched (defeats brute force).
 *
 * Returns true when a matching, unexpired nonce existed.
 */
export async function consumeNonce(address: string, nonce: string): Promise<boolean> {
  try {
    const stored = await kv.get<string>(nonceKey(address));
    await kv.del(nonceKey(address));
    return stored === nonce;
  } catch (err) {
    // In development (no KV configured), accept any nonce so the SIWE
    // round-trip works locally.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] KV unavailable — nonce not validated (dev only).");
      return true;
    }
    // In production, KV failures are treated as a security-critical event.
    // Fail-closed: if we can't verify the nonce, we reject the login attempt.
    console.error("[auth] KV unavailable in production — rejecting nonce (fail-closed).", err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// SIWE message parsing + signature verification
// ─────────────────────────────────────────────────────────────

/** Parsed fields from the OMNOM-flavored SIWE message (EIP-4361 subset). */
export interface ParsedSiweMessage {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
  /** Optional expiration-time field if present in the message. */
  expirationTime: string | null;
}

/**
 * Parse an OMNOM-flavored SIWE message.
 *
 * Expected layout (per WALLET-FLOW.md §4):
 *   <domain> wants you to sign in with your Ethereum account:
 *   <address>
 *
 *   <statement>
 *
 *   Nonce: <nonce>
 *   [Chain ID: ...]   ← optional / intentionally omitted
 *   Issued At: <iso>
 *   [Expiration Time: <iso>]   ← optional
 */
export function parseSiweMessage(message: string): ParsedSiweMessage {
  const lines = message.split("\n");
  const headerLine = lines[0] ?? "";
  const domainMatch = headerLine.match(/^(.+?) wants you to sign in with your Ethereum account:/);
  if (!domainMatch) {
    throw new UnauthorizedError(ErrorCode.INVALID_SIGNATURE);
  }
  const domain = domainMatch[1]!.trim();
  const address = (lines[1] ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new UnauthorizedError(ErrorCode.INVALID_ADDRESS);
  }

  const nonce = extractField(message, "Nonce");
  const issuedAt = extractField(message, "Issued At");
  const expirationTime = extractField(message, "Expiration Time");

  if (!nonce || !issuedAt) {
    throw new UnauthorizedError(ErrorCode.INVALID_SIGNATURE);
  }

  return { domain, address, nonce, issuedAt, expirationTime };
}

function extractField(message: string, field: string): string | null {
  const re = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const m = message.match(re);
  return m ? m[1]!.trim() : null;
}

/** Outcome of a SIWE verification attempt. */
export interface SiweVerifyResult {
  ok: boolean;
  address: string | null;
  error?: ErrorCode;
}

/**
 * Verify a SIWE signature end-to-end:
 *  1. Parse the message.
 *  2. Validate the domain matches the canonical site hostname.
 *  3. Validate the `Issued At` is within ±5 minutes of server time.
 *  4. Recover the signer address via viem (EIP-191 personal_sign recovery).
 *  5. Compare recovered address with the claimed address (case-insensitive).
 */
export async function verifySiweSignature(
  message: string,
  signature: string,
): Promise<SiweVerifyResult> {
  let parsed: ParsedSiweMessage;
  try {
    parsed = parseSiweMessage(message);
  } catch (err) {
    return {
      ok: false,
      address: null,
      error: err instanceof UnauthorizedError ? err.code : ErrorCode.INVALID_SIGNATURE,
    };
  }

  // Domain check (anti cross-site replay). The SIWE message `domain` MUST match
  // the canonical site hostname. `localhost` is accepted only outside
  // production so a production deployment cannot be spoofed with a
  // `localhost`-bound message.
  const expectedHost = getSiteHostname();
  const allowLocalhost = process.env.NODE_ENV !== "production";
  const domainOk =
    parsed.domain === expectedHost ||
    (allowLocalhost && parsed.domain === "localhost");
  if (!domainOk) {
    return { ok: false, address: null, error: ErrorCode.INVALID_SIGNATURE };
  }

  // Timestamp skew check.
  const issuedAtMs = Date.parse(parsed.issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    return { ok: false, address: null, error: ErrorCode.INVALID_SIGNATURE };
  }
  const skewSec = Math.abs(Date.now() - issuedAtMs) / 1000;
  if (skewSec > SIWE_TIME_SKEW_SECONDS) {
    return { ok: false, address: null, error: ErrorCode.NONCE_EXPIRED };
  }

  // Optional explicit expiration.
  if (parsed.expirationTime) {
    const expMs = Date.parse(parsed.expirationTime);
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      return { ok: false, address: null, error: ErrorCode.NONCE_EXPIRED };
    }
  }

  // ECDSA recovery (EIP-191 personal_sign).
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
      return { ok: false, address: null, error: ErrorCode.INVALID_SIGNATURE };
    }
    return { ok: true, address: recovered };
  } catch {
    return { ok: false, address: null, error: ErrorCode.INVALID_SIGNATURE };
  }
}

// ─────────────────────────────────────────────────────────────
// User registration (lazy, snapshot-gated)
// ─────────────────────────────────────────────────────────────

/** Result of registering / refreshing a user from a verified address. */
export interface RegisteredUser {
  user: User;
  isNew: boolean;
}

/**
 * Look up the verified address in the snapshot. If found, upsert the `users`
 * row (creating it on first auth, refreshing `last_login_at` otherwise).
 *
 * @throws UnauthorizedError(NOT_IN_SNAPSHOT) when the address is not a holder.
 */
export async function registerVerifiedHolder(address: string): Promise<RegisteredUser> {
  const holder = await lookupEnrichedSnapshotHolder(address);
  if (!holder) {
    throw new UnauthorizedError(ErrorCode.NOT_IN_SNAPSHOT);
  }

  const normalized = address.toLowerCase();
  const existing = await db.execute({
    sql: "SELECT id, wallet_address, display_name, created_at, last_login_at FROM users WHERE wallet_address = ?",
    args: [normalized],
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0]!;
    await db.execute({
      sql: "UPDATE users SET last_login_at = datetime('now') WHERE id = ?",
      args: [row.id as string],
    });
    return {
      isNew: false,
      user: {
        id: row.id as string,
        walletAddress: row.wallet_address as string,
        displayName: (row.display_name as string) || defaultDisplayName(normalized),
        createdAt: row.created_at as string,
        lastLoginAt: new Date().toISOString(),
      },
    };
  }

  // First-time user — default display name to a truncated address.
  const displayName = defaultDisplayName(normalized);
  const insert = await db.execute({
    sql:
      "INSERT INTO users (wallet_address, display_name) VALUES (?, ?) " +
      "RETURNING id, wallet_address, display_name, created_at, last_login_at",
    args: [normalized, displayName],
  });
  const row = insert.rows[0]!;
  return {
    isNew: true,
    user: {
      id: row.id as string,
      walletAddress: row.wallet_address as string,
      displayName: (row.display_name as string) || displayName,
      createdAt: row.created_at as string,
      lastLoginAt: row.last_login_at as string,
    },
  };
}

/** Default display name: truncated lowercase address (0x1234…abcd). */
export function defaultDisplayName(address: string): string {
  const a = address.toLowerCase();
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Determine whether a holder class may create a proposal of the given type.
 * Per GOVERNANCE_MECHANICS.md §5: Chain Selection / Tokenomics / Technical
 * require Dolphin+; everything else is open to any verified holder.
 */
export function canCreateProposalType(holderClass: HolderClass, type: string): boolean {
  const config = PROPOSAL_TYPE_CONFIG[type as keyof typeof PROPOSAL_TYPE_CONFIG];
  if (!config) return false;
  return meetsClassRequirement(holderClass, config.minHolderClass);
}

/** Returns true when `actual` is at least `required` on the class hierarchy. */
export function meetsClassRequirement(actual: HolderClass, required: HolderClass): boolean {
  const actualRank = HOLDER_CLASS_RANK[actual] ?? 0;
  const requiredRank = HOLDER_CLASS_RANK[required] ?? 0;
  return actualRank >= requiredRank;
}
