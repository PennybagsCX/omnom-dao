import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, decodeJwt } from "jose";

import {
  JWT_ABSOLUTE_MAX_SECONDS,
  JWT_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from "@/lib/constants";
import { HolderClass } from "@/types";

const SECRET = "test-jwt-secret-that-is-at-least-32-chars";
const SHORT_SECRET = "too-short";

async function freshSession() {
  vi.resetModules();
  return import("@/lib/session");
}

describe("session JWT primitives", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    // NODE_ENV is typed read-only; Object.assign sidesteps it in tests.
    Object.assign(process.env, { NODE_ENV: "test" });
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    vi.resetModules();
  });

  describe("getJwtSecret", () => {
    it("returns the encoded secret when valid", async () => {
      const { getJwtSecret } = await freshSession();
      const bytes = getJwtSecret();
      expect(new TextDecoder().decode(bytes)).toBe(SECRET);
    });

    it("throws when JWT_SECRET is unset", async () => {
      delete process.env.JWT_SECRET;
      const { getJwtSecret } = await freshSession();
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
    });

    it("throws when JWT_SECRET is shorter than 32 characters", async () => {
      process.env.JWT_SECRET = SHORT_SECRET;
      const { getJwtSecret } = await freshSession();
      expect(() => getJwtSecret()).toThrow(/at least 32 characters/);
    });
  });

  describe("signSession / verifySession roundtrip", () => {
    it("verifies a token it signed and returns all claims", async () => {
      const { signSession, verifySession } = await freshSession();
      const token = await signSession({
        walletAddress: "0xAbC0000000000000000000000000000000000123",
        holderClass: HolderClass.WHALE,
        votingPower: 12345,
      });

      const claims = await verifySession(token);
      expect(claims).not.toBeNull();
      expect(claims!.sub).toBe("0xAbC0000000000000000000000000000000000123");
      expect(claims!.holderClass).toBe(HolderClass.WHALE);
      expect(claims!.votingPower).toBe(12345);
      expect(claims!.iss).toBe("omnom-dao");
      expect(claims!.aud).toBe("omnom-dao-user");
    });

    it("sets expiry to 7 days and absolute max to 90 days", async () => {
      const { signSession } = await freshSession();
      const before = Math.floor(Date.now() / 1000);
      const token = await signSession({
        walletAddress: "0xAbC0000000000000000000000000000000000123",
        holderClass: HolderClass.SEAHORSE,
        votingPower: 1,
      });
      const after = Math.floor(Date.now() / 1000);

      const payload = decodeJwt(token);
      expect(payload.exp! - before).toBeLessThanOrEqual(JWT_MAX_AGE_SECONDS);
      expect(payload.exp! - after).toBeGreaterThanOrEqual(
        JWT_MAX_AGE_SECONDS - (after - before) - 1,
      );
      expect(payload.absMax).toBeGreaterThanOrEqual(before + JWT_ABSOLUTE_MAX_SECONDS);
      expect(payload.absMax).toBeLessThanOrEqual(after + JWT_ABSOLUTE_MAX_SECONDS);
    });

    it("rejects a token signed with a different secret", async () => {
      const { signSession, verifySession } = await freshSession();
      const token = await signSession({
        walletAddress: "0xAbC0000000000000000000000000000000000123",
        holderClass: HolderClass.SEAHORSE,
        votingPower: 1,
      });

      process.env.JWT_SECRET = "another-secret-that-is-at-least-32-chars";
      const { verifySession: verifyWithOther } = await freshSession();
      expect(await verifyWithOther(token)).toBeNull();

      process.env.JWT_SECRET = SECRET;
      expect(await verifySession(token)).not.toBeNull();
    });

    it("rejects a malformed token", async () => {
      const { verifySession } = await freshSession();
      expect(await verifySession("not-a-jwt")).toBeNull();
      expect(await verifySession("")).toBeNull();
      expect(await verifySession("a.b.c")).toBeNull();
    });

    it("rejects an expired token", async () => {
      const key = new TextEncoder().encode(SECRET);
      const expired = await new SignJWT({ sub: "0xdead" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("omnom-dao")
        .setAudience("omnom-dao-user")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(key);

      const { verifySession } = await freshSession();
      expect(await verifySession(expired)).toBeNull();
    });

    it("rejects a token with the wrong issuer or audience", async () => {
      const key = new TextEncoder().encode(SECRET);
      const base = {
        sub: "0xAbC0000000000000000000000000000000000123",
        holderClass: HolderClass.SEAHORSE,
        votingPower: 1,
      };
      const wrongIssuer = await new SignJWT(base)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("evil.example")
        .setAudience("omnom-dao-user")
        .setExpirationTime("1h")
        .sign(key);
      const wrongAudience = await new SignJWT(base)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("omnom-dao")
        .setAudience("someone-else")
        .setExpirationTime("1h")
        .sign(key);

      const { verifySession } = await freshSession();
      expect(await verifySession(wrongIssuer)).toBeNull();
      expect(await verifySession(wrongAudience)).toBeNull();
    });
  });

  describe("SESSION_COOKIE_ATTRIBUTES", () => {
    it("is not secure outside production", async () => {
      const { SESSION_COOKIE_ATTRIBUTES } = await freshSession();
      expect(SESSION_COOKIE_ATTRIBUTES.secure).toBe(false);
      expect(SESSION_COOKIE_ATTRIBUTES.httpOnly).toBe(true);
      expect(SESSION_COOKIE_ATTRIBUTES.sameSite).toBe("strict");
      expect(SESSION_COOKIE_ATTRIBUTES.path).toBe("/");
      expect(SESSION_COOKIE_ATTRIBUTES.maxAge).toBe(JWT_MAX_AGE_SECONDS);
    });

    it("is secure in production", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });
      const { SESSION_COOKIE_ATTRIBUTES } = await freshSession();
      expect(SESSION_COOKIE_ATTRIBUTES.secure).toBe(true);
    });
  });

  it("re-exports the canonical cookie name", async () => {
    const mod = await freshSession();
    expect(mod.SESSION_COOKIE).toBe(SESSION_COOKIE);
  });
});
