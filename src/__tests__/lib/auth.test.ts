import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ERROR_CODE_MAP,
  NONCE_TTL_SECONDS,
  PROPOSAL_TYPE_CONFIG,
} from "@/lib/constants";
import { ErrorCode, HolderClass } from "@/types";

const ADDR = "0xAbC0000000000000000000000000000000000123";
const ADDR_LOWER = ADDR.toLowerCase();

// ── Module-boundary mocks ────────────────────────────────────────────────────

const cookieJar = vi.hoisted(() => new Map<string, string>());

const kvState = vi.hoisted(() => ({
  store: new Map<string, string>(),
  fail: false,
}));

const recoverState = vi.hoisted(() => ({
  address: "0xAbC0000000000000000000000000000000000123",
  fail: false,
  calls: [] as { message: string; signature: string }[],
}));

const snapshotState = vi.hoisted(() => ({
  holder: null as Record<string, unknown> | null,
}));

const executeMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
  })),
}));

vi.mock("@vercel/kv", () => ({
  kv: {
    set: vi.fn(async (key: string, value: string, opts?: { ex: number }) => {
      if (kvState.fail) throw new Error("kv down");
      return { key, value, opts };
    }),
    get: vi.fn(async (key: string) => {
      if (kvState.fail) throw new Error("kv down");
      return kvState.store.get(key) ?? null;
    }),
    del: vi.fn(async (key: string) => {
      if (kvState.fail) throw new Error("kv down");
      kvState.store.delete(key);
      return 1;
    }),
  },
}));

vi.mock("viem", () => ({
  recoverMessageAddress: vi.fn(async (params: { message: string; signature: string }) => {
    recoverState.calls.push(params);
    if (recoverState.fail) throw new Error("recovery failed");
    return recoverState.address;
  }),
}));

vi.mock("@/lib/snapshot", () => ({
  lookupEnrichedSnapshotHolder: vi.fn(async () => snapshotState.holder),
}));

vi.mock("@/lib/db", () => ({
  db: { execute: executeMock },
}));

// Real session module (unmocked) so JWT handling is exercised end-to-end.
import {
  clearSessionCookie,
  consumeNonce,
  defaultDisplayName,
  generateNonce,
  getSession,
  getSessionAddress,
  getServerSession,
  registerVerifiedHolder,
  requireAuth,
  signSession,
  verifySiweSignature,
  parseSiweMessage,
  UnauthorizedError,
  canCreateProposalType,
  meetsClassRequirement,
  RATE_WINDOWS,
} from "@/lib/auth";

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars";

function validSiweMessage(overrides: Record<string, string> = {}): string {
  const issuedAt = overrides.issuedAt ?? new Date().toISOString();
  const lines = [
    "localhost wants you to sign in with your Ethereum account:",
    overrides.address ?? ADDR,
    "",
    "Sign in with your Ethereum account to OMNOM DAO",
    "",
    `Nonce: ${overrides.nonce ?? "abc123"}`,
    `Issued At: ${issuedAt}`,
  ];
  if (overrides.expirationTime) {
    lines.push(`Expiration Time: ${overrides.expirationTime}`);
  }
  return lines.join("\n");
}

describe("auth (SIWE + JWT server-side)", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    // NODE_ENV is typed read-only; Object.assign sidesteps it in tests.
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.NEXT_PUBLIC_SITE_URL;
    cookieJar.clear();
    kvState.store.clear();
    kvState.fail = false;
    recoverState.address = ADDR;
    recoverState.fail = false;
    recoverState.calls.length = 0;
    snapshotState.holder = null;
    executeMock.mockReset();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  describe("UnauthorizedError", () => {
    it("carries the error code and HTTP status", () => {
      const err = new UnauthorizedError(ErrorCode.UNAUTHORIZED);
      expect(err.name).toBe("UnauthorizedError");
      expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(err.statusCode).toBe(ERROR_CODE_MAP[ErrorCode.UNAUTHORIZED].status);
      expect(err.message).toBe(ERROR_CODE_MAP[ErrorCode.UNAUTHORIZED].message);
    });
  });

  describe("session accessors", () => {
    it("getSession returns null when no cookie is present", async () => {
      expect(await getSession()).toBeNull();
    });

    it("getSession returns null for an invalid cookie value", async () => {
      cookieJar.set("omnom_token", "garbage");
      expect(await getSession()).toBeNull();
    });

    it("getSession returns claims for a valid session token", async () => {
      const token = await signSession({
        walletAddress: ADDR,
        holderClass: HolderClass.DOLPHIN,
        votingPower: 42,
      });
      cookieJar.set("omnom_token", token);

      const claims = await getSession();
      expect(claims?.sub).toBe(ADDR);
      expect(claims?.holderClass).toBe(HolderClass.DOLPHIN);
      expect(claims?.votingPower).toBe(42);
    });

    it("getSessionAddress returns lowercase for DB consistency", async () => {
      expect(await getSessionAddress()).toBeNull();
      const token = await signSession({
        walletAddress: ADDR,
        holderClass: HolderClass.SEAHORSE,
        votingPower: 1,
      });
      cookieJar.set("omnom_token", token);
      expect(await getSessionAddress()).toBe(ADDR_LOWER);
    });

    it("getServerSession delegates to getSession", async () => {
      const token = await signSession({
        walletAddress: ADDR,
        holderClass: HolderClass.WHALE,
        votingPower: 10,
      });
      cookieJar.set("omnom_token", token);
      const claims = await getServerSession();
      expect(claims?.sub).toBe(ADDR);
    });

    it("requireAuth returns claims when authenticated", async () => {
      const token = await signSession({
        walletAddress: ADDR,
        holderClass: HolderClass.WHALE,
        votingPower: 10,
      });
      cookieJar.set("omnom_token", token);
      const claims = await requireAuth();
      expect(claims.sub).toBe(ADDR);
    });

    it("requireAuth throws UnauthorizedError without a session", async () => {
      await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(requireAuth()).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
    });

    it("clearSessionCookie renders a Max-Age=0 header in dev", () => {
      expect(clearSessionCookie()).toBe(
        "omnom_token=; Path=/; Max-Age=0; HttpOnly; SameSite=strict",
      );
    });
  });

  describe("generateNonce", () => {
    it("stores a 32-char hex nonce in KV with the 5-minute TTL", async () => {
      const { nonce, issuedAt } = await generateNonce(ADDR);
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(new Date(issuedAt).toString()).not.toBe("Invalid Date");

      const { kv } = await import("@vercel/kv");
      expect(kv.set).toHaveBeenCalledWith(`nonce:${ADDR_LOWER}`, nonce, {
        ex: NONCE_TTL_SECONDS,
      });
    });

    it("still returns a nonce when KV is unavailable in dev", async () => {
      kvState.fail = true;
      const result = await generateNonce(ADDR);
      expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it("does not throw when KV is unavailable in production", async () => {
      kvState.fail = true;
      Object.assign(process.env, { NODE_ENV: "production" });
      await expect(generateNonce(ADDR)).resolves.toMatchObject({
        nonce: expect.stringMatching(/^[0-9a-f]{32}$/),
      });
    });
  });

  describe("consumeNonce", () => {
    it("returns true on a match and deletes the nonce (single-use)", async () => {
      kvState.store.set(`nonce:${ADDR_LOWER}`, "n-1");
      expect(await consumeNonce(ADDR, "n-1")).toBe(true);
      expect(kvState.store.has(`nonce:${ADDR_LOWER}`)).toBe(false);
    });

    it("returns false on a mismatch and still deletes the nonce", async () => {
      kvState.store.set(`nonce:${ADDR_LOWER}`, "n-1");
      expect(await consumeNonce(ADDR, "n-2")).toBe(false);
      expect(kvState.store.has(`nonce:${ADDR_LOWER}`)).toBe(false);
    });

    it("returns false when no nonce was ever stored", async () => {
      expect(await consumeNonce(ADDR, "n-1")).toBe(false);
    });

    it("fails open in development when KV errors", async () => {
      kvState.fail = true;
      expect(await consumeNonce(ADDR, "n-1")).toBe(true);
    });

    it("fails closed in production when KV errors", async () => {
      kvState.fail = true;
      Object.assign(process.env, { NODE_ENV: "production" });
      expect(await consumeNonce(ADDR, "n-1")).toBe(false);
    });
  });

  describe("parseSiweMessage", () => {
    it("parses a complete message with optional expiration", () => {
      const msg = validSiweMessage({
        address: ADDR,
        nonce: "n-1",
        expirationTime: new Date(Date.now() + 60_000).toISOString(),
      });
      const parsed = parseSiweMessage(msg);
      expect(parsed).toEqual({
        domain: "localhost",
        address: ADDR,
        nonce: "n-1",
        issuedAt: parsed.issuedAt,
        expirationTime: parsed.expirationTime,
      });
      expect(parsed.expirationTime).not.toBeNull();
    });

    it("returns null expirationTime when the field is absent", () => {
      const parsed = parseSiweMessage(validSiweMessage());
      expect(parsed.expirationTime).toBeNull();
    });

    it("throws INVALID_SIGNATURE when the header line is missing", () => {
      expect(() => parseSiweMessage("random text\n0xabc")).toThrowError(
        UnauthorizedError,
      );
    });

    it("throws INVALID_ADDRESS for a malformed address", () => {
      const msg = validSiweMessage({ address: "0x123" });
      expect(() => parseSiweMessage(msg)).toThrow(UnauthorizedError);
    });

    it("throws INVALID_SIGNATURE when Nonce is missing", () => {
      const msg = [
        "localhost wants you to sign in with your Ethereum account:",
        ADDR,
        "",
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");
      const err = capture(() => parseSiweMessage(msg));
      expect(err?.code).toBe(ErrorCode.INVALID_SIGNATURE);
    });

    it("throws INVALID_SIGNATURE when Issued At is missing", () => {
      const msg = [
        "localhost wants you to sign in with your Ethereum account:",
        ADDR,
        "",
        "Nonce: n-1",
      ].join("\n");
      const err = capture(() => parseSiweMessage(msg));
      expect(err?.code).toBe(ErrorCode.INVALID_SIGNATURE);
    });
  });

  describe("verifySiweSignature", () => {
    it("succeeds end-to-end with a matching recovered address", async () => {
      const result = await verifySiweSignature(validSiweMessage(), "0xsig");
      expect(result.ok).toBe(true);
      expect(result.address).toBe(ADDR);
      expect(recoverState.calls).toHaveLength(1);
    });

    it("is case-insensitive on the recovered address", async () => {
      recoverState.address = ADDR.toUpperCase();
      const result = await verifySiweSignature(validSiweMessage(), "0xsig");
      expect(result.ok).toBe(true);
    });

    it("fails when the message cannot be parsed", async () => {
      const result = await verifySiweSignature("garbage", "0xsig");
      expect(result).toMatchObject({
        ok: false,
        address: null,
        error: ErrorCode.INVALID_SIGNATURE,
      });
    });

    it("fails when the domain does not match the site hostname", async () => {
      const msg = validSiweMessage().replace(
        "localhost wants",
        "evil.example wants",
      );
      const result = await verifySiweSignature(msg, "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.INVALID_SIGNATURE);
    });

    it("rejects a localhost-bound message in production when the site URL differs", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });
      process.env.NEXT_PUBLIC_SITE_URL = "https://omnom.example";
      const result = await verifySiweSignature(validSiweMessage(), "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.INVALID_SIGNATURE);
    });

    it("accepts a localhost-bound message in development when the site URL differs", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://omnom.example";
      const result = await verifySiweSignature(validSiweMessage(), "0xsig");
      expect(result.ok).toBe(true);
    });

    it("fails when Issued At is not a parseable date", async () => {
      const msg = validSiweMessage({ issuedAt: "not-a-date" });
      const result = await verifySiweSignature(msg, "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.INVALID_SIGNATURE);
    });

    it("fails NONCE_EXPIRED when issued more than 5 minutes ago", async () => {
      const msg = validSiweMessage({
        issuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });
      const result = await verifySiweSignature(msg, "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.NONCE_EXPIRED);
    });

    it("fails NONCE_EXPIRED when the explicit expiration time has passed", async () => {
      const msg = validSiweMessage({
        expirationTime: new Date(Date.now() - 60_000).toISOString(),
      });
      const result = await verifySiweSignature(msg, "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.NONCE_EXPIRED);
    });

    it("accepts a future explicit expiration time", async () => {
      const msg = validSiweMessage({
        expirationTime: new Date(Date.now() + 3600_000).toISOString(),
      });
      const result = await verifySiweSignature(msg, "0xsig");
      expect(result.ok).toBe(true);
    });

    it("fails when the recovered address does not match", async () => {
      recoverState.address = "0x9999999999999999999999999999999999999999";
      const result = await verifySiweSignature(validSiweMessage(), "0xsig");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.INVALID_SIGNATURE);
    });

    it("fails when signature recovery throws", async () => {
      recoverState.fail = true;
      const result = await verifySiweSignature(validSiweMessage(), "0xbad");
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.INVALID_SIGNATURE);
    });
  });

  describe("registerVerifiedHolder", () => {
    it("throws NOT_IN_SNAPSHOT when the address is not a holder", async () => {
      snapshotState.holder = null;
      const err = await captureAsync(() => registerVerifiedHolder(ADDR));
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err?.code).toBe(ErrorCode.NOT_IN_SNAPSHOT);
      expect(executeMock).not.toHaveBeenCalled();
    });

    it("refreshes last_login_at for an existing user", async () => {
      snapshotState.holder = { walletAddress: ADDR_LOWER, holderClass: "WHALE" };
      executeMock.mockResolvedValueOnce({
        rows: [
          {
            id: "u-1",
            wallet_address: ADDR_LOWER,
            display_name: "Existing",
            created_at: "2026-01-01T00:00:00.000Z",
            last_login_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      });

      const { user, isNew } = await registerVerifiedHolder(ADDR);
      expect(isNew).toBe(false);
      expect(user.id).toBe("u-1");
      expect(user.displayName).toBe("Existing");

      expect(executeMock).toHaveBeenCalledTimes(2);
      const update = executeMock.mock.calls[1]![0] as { sql: string };
      expect(update.sql).toContain("UPDATE users SET last_login_at");
    });

    it("falls back to the truncated address as display name when the row has none", async () => {
      snapshotState.holder = { walletAddress: ADDR_LOWER };
      executeMock.mockResolvedValueOnce({
        rows: [
          {
            id: "u-2",
            wallet_address: ADDR_LOWER,
            display_name: "",
            created_at: "2026-01-01T00:00:00.000Z",
            last_login_at: null,
          },
        ],
      });

      const { user } = await registerVerifiedHolder(ADDR);
      expect(user.displayName).toBe(defaultDisplayName(ADDR_LOWER));
    });

    it("creates a new user on first authentication", async () => {
      snapshotState.holder = { walletAddress: ADDR_LOWER };
      executeMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "u-new",
              wallet_address: ADDR_LOWER,
              display_name: "0xabc0…0123",
              created_at: "2026-08-24T00:00:00.000Z",
              last_login_at: "2026-08-24T00:00:00.000Z",
            },
          ],
        });

      const { user, isNew } = await registerVerifiedHolder(ADDR);
      expect(isNew).toBe(true);
      expect(user.id).toBe("u-new");
      const insert = executeMock.mock.calls[1]![0] as {
        sql: string;
        args: (string | null)[];
      };
      expect(insert.sql).toContain("INSERT INTO users");
      expect(insert.args[0]).toBe(ADDR_LOWER);
      expect(insert.args[1]).toBe(defaultDisplayName(ADDR_LOWER));
    });
  });

  describe("defaultDisplayName", () => {
    it("truncates long addresses to 0x1234…abcd", () => {
      expect(defaultDisplayName("0xAbCDEF1234567890abcdef1234567890abcdef12")).toBe(
        "0xabcd…ef12",
      );
    });

    it("returns short addresses unchanged (lowercased)", () => {
      expect(defaultDisplayName("0xAB")).toBe("0xab");
    });
  });

  describe("proposal-type gating", () => {
    it("lets KRAKEN create every configured proposal type", () => {
      for (const type of Object.keys(PROPOSAL_TYPE_CONFIG)) {
        expect(canCreateProposalType(HolderClass.KRAKEN, type)).toBe(true);
      }
    });

    it("lets WHALE create every configured proposal type", () => {
      for (const type of Object.keys(PROPOSAL_TYPE_CONFIG)) {
        expect(canCreateProposalType(HolderClass.WHALE, type)).toBe(true);
      }
    });

    it("lets DOLPHIN (rank 5) create high-impact types requiring SHARK (rank 4)", () => {
      // DOLPHIN rank 5 > SHARK rank 4, so can create SHARK-gated types
      expect(canCreateProposalType(HolderClass.DOLPHIN, "CHAIN_SELECTION")).toBe(true);
      expect(canCreateProposalType(HolderClass.DOLPHIN, "TOKENOMICS_CHANGE")).toBe(true);
      expect(canCreateProposalType(HolderClass.DOLPHIN, "TECHNICAL")).toBe(true);
    });

    it("lets SHARK create high-impact types", () => {
      expect(canCreateProposalType(HolderClass.SHARK, "CHAIN_SELECTION")).toBe(true);
      expect(canCreateProposalType(HolderClass.SHARK, "TOKENOMICS_CHANGE")).toBe(true);
      expect(canCreateProposalType(HolderClass.SHARK, "TECHNICAL")).toBe(true);
    });

    it("blocks OCTOPUS from creating high-impact types", () => {
      expect(canCreateProposalType(HolderClass.OCTOPUS, "CHAIN_SELECTION")).toBe(false);
      expect(canCreateProposalType(HolderClass.OCTOPUS, "TOKENOMICS_CHANGE")).toBe(false);
      expect(canCreateProposalType(HolderClass.OCTOPUS, "TECHNICAL")).toBe(false);
    });

    it("blocks CRAB from creating high-impact types", () => {
      expect(canCreateProposalType(HolderClass.CRAB, "CHAIN_SELECTION")).toBe(false);
      expect(canCreateProposalType(HolderClass.CRAB, "TOKENOMICS_CHANGE")).toBe(false);
      expect(canCreateProposalType(HolderClass.CRAB, "TECHNICAL")).toBe(false);
    });

    it("gates SEAHORSE according to the minimum holder class", () => {
      for (const [type, config] of Object.entries(PROPOSAL_TYPE_CONFIG)) {
        expect(canCreateProposalType(HolderClass.SEAHORSE, type)).toBe(
          meetsClassRequirement(HolderClass.SEAHORSE, config.minHolderClass),
        );
      }
    });

    it("FISH (deprecated, rank 1) passes only floor gates", () => {
      // FISH maps to SEAHORSE rank, so same behavior
      expect(canCreateProposalType(HolderClass.FISH, "TREASURY")).toBe(true);
      expect(canCreateProposalType(HolderClass.FISH, "GUIDELINE")).toBe(true);
      expect(canCreateProposalType(HolderClass.FISH, "GENERAL")).toBe(true);
      expect(canCreateProposalType(HolderClass.FISH, "CHAIN_SELECTION")).toBe(false);
      expect(canCreateProposalType(HolderClass.FISH, "TOKENOMICS_CHANGE")).toBe(false);
      expect(canCreateProposalType(HolderClass.FISH, "TECHNICAL")).toBe(false);
    });

    it("rejects unknown proposal types", () => {
      expect(canCreateProposalType(HolderClass.WHALE, "NOT_A_TYPE")).toBe(false);
    });

    it("meetsClassRequirement respects the 7-tier class hierarchy", () => {
      // Higher rank passes lower rank requirement
      expect(meetsClassRequirement(HolderClass.KRAKEN, HolderClass.SEAHORSE)).toBe(true);
      expect(meetsClassRequirement(HolderClass.WHALE, HolderClass.SEAHORSE)).toBe(true);
      expect(meetsClassRequirement(HolderClass.DOLPHIN, HolderClass.SHARK)).toBe(true);
      expect(meetsClassRequirement(HolderClass.SHARK, HolderClass.SHARK)).toBe(true);
      // Lower rank fails higher rank requirement
      expect(meetsClassRequirement(HolderClass.OCTOPUS, HolderClass.SHARK)).toBe(false);
      expect(meetsClassRequirement(HolderClass.CRAB, HolderClass.SHARK)).toBe(false);
      expect(meetsClassRequirement(HolderClass.SEAHORSE, HolderClass.DOLPHIN)).toBe(false);
      expect(meetsClassRequirement(HolderClass.FISH, HolderClass.SHARK)).toBe(false);
    });
  });

  it("exposes the documented rate-limit windows", () => {
    expect(RATE_WINDOWS.apiPerIp).toEqual({ limit: 60, windowSeconds: 60 });
    expect(RATE_WINDOWS.noncePerAddress.limit).toBe(5);
    expect(RATE_WINDOWS.verifyPerIp.limit).toBe(10);
    expect(RATE_WINDOWS.proposalPerUser).toEqual({
      limit: 3,
      windowSeconds: 7 * 24 * 60 * 60,
    });
    expect(RATE_WINDOWS.commentPerUser.limit).toBe(30);
  });
});

function capture(fn: () => void): UnauthorizedError | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err as UnauthorizedError;
  }
}

async function captureAsync(
  fn: () => Promise<unknown>,
): Promise<UnauthorizedError | null> {
  try {
    await fn();
    return null;
  } catch (err) {
    return err as UnauthorizedError;
  }
}
