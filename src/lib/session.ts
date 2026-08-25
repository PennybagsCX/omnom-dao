import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import {
  JWT_ABSOLUTE_MAX_SECONDS,
  JWT_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from "@/lib/constants";
import { HolderClass } from "@/types";

/**
 * Edge-safe JWT session primitives.
 *
 * This module is deliberately dependency-light: it imports only `jose` (which
 * works in both Node and Edge runtimes) and pure constants/types. It must NOT
 * import anything that touches `node:fs`, the database, or Vercel KV — those
 * belong in `auth.ts`, which is Node-only. Keeping the split lets the Next.js
 * edge middleware verify JWTs without bundling the Node-only snapshot/db code.
 *
 * Canonical session lifetime = 7 days (per DESIGN.md + WALLET-FLOW.md).
 */

const TOKEN_ISSUER = "omnom-dao";
const TOKEN_AUDIENCE = "omnom-dao-user";

/** Claims encoded into the SIWE-issued JWT. */
export interface SessionClaims extends JWTPayload {
  sub: string;
  holderClass: HolderClass;
  votingPower: number;
  /** When this session's absolute max lifetime elapses. */
  absMax: number;
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and be at least 32 characters long.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session JWT for a verified holder. Lifetime is 7 days. */
export async function signSession(payload: {
  walletAddress: string;
  holderClass: HolderClass;
  votingPower: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: payload.walletAddress,
    holderClass: payload.holderClass,
    votingPower: payload.votingPower,
    absMax: now + JWT_ABSOLUTE_MAX_SECONDS,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_MAX_AGE_SECONDS)
    .sign(getJwtSecret());
}

/** Verify a session JWT. Returns the decoded claims, or null if invalid/expired. */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

/** Cookie attributes for the session token. */
export const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: JWT_MAX_AGE_SECONDS,
};

/** Cookie name (re-exported so callers can import everything from one place). */
export { SESSION_COOKIE };
