import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";

/**
 * Integration tests for POST /api/v1/nonce.
 *
 * The route handler is invoked directly with a fake NextRequest. The auth,
 * rate-limit, and DB layers are mocked at the module boundary so no real
 * Vercel KV / Turso is contacted.
 */

const VALID_ADDR = ADDR_DOLPHIN;

// Hoisted mutable mock state (factories run before imports).
const hoisted = vi.hoisted(() => ({
  generateNonce: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  generateNonce: hoisted.generateNonce,
  RATE_WINDOWS: {
    noncePerAddress: { limit: 5, windowSeconds: 300 },
    apiPerIp: { limit: 60, windowSeconds: 60 },
    verifyPerIp: { limit: 10, windowSeconds: 300 },
    proposalPerUser: { limit: 3, windowSeconds: 604800 },
    commentPerUser: { limit: 30, windowSeconds: 86400 },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
  userActionBucket: (action: string, addr: string) => `rl:${action}:${addr.toLowerCase()}`,
  ipBucket: (ip: string) => `rl:api:ip:${ip}`,
}));

function buildReq(body: unknown) {
  return {
    method: "POST",
    url: "http://localhost/api/v1/nonce",
    nextUrl: new URL("http://localhost/api/v1/nonce"),
    headers: new Headers(),
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body)),
    cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
  } as unknown as Parameters<typeof import("@/app/api/v1/nonce/route").POST>[0];
}

async function call(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const { POST } = await import("@/app/api/v1/nonce/route");
  const res = (await POST(buildReq(body))) as NextResponse;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  vi.resetModules();
  hoisted.generateNonce.mockReset();
  hoisted.checkRateLimit.mockReset();
  hoisted.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0, count: 1 });
  hoisted.generateNonce.mockResolvedValue({ nonce: "abc123def456", issuedAt: "2026-06-15T00:00:00.000Z" });
});

describe("POST /api/v1/nonce", () => {
  it("returns a nonce + issuedAt for a valid address", async () => {
    const { status, body } = await call({ address: VALID_ADDR });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).nonce).toBe("abc123def456");
    expect(hoisted.generateNonce).toHaveBeenCalledWith(VALID_ADDR);
  });

  it("calls generateNonce with a lowercased address (checksum hex accepted)", async () => {
    // Uppercase only the hex digits — the `0x` prefix must stay lowercase.
    const checksummed = "0x" + VALID_ADDR.slice(2).toUpperCase();
    await call({ address: checksummed });
    expect(hoisted.generateNonce).toHaveBeenCalledWith(VALID_ADDR);
  });

  it("rejects an invalid address format with 400", async () => {
    const { status, body } = await call({ address: "not-an-address" });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(hoisted.generateNonce).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON body with 400", async () => {
    const req = {
      method: "POST",
      url: "http://localhost/api/v1/nonce",
      nextUrl: new URL("http://localhost/api/v1/nonce"),
      headers: new Headers(),
      json: vi.fn(async () => {
        throw new SyntaxError("Unexpected token");
      }),
      text: vi.fn(),
      cookies: { get: vi.fn(), getAll: vi.fn(() => []) },
    } as unknown as Parameters<typeof import("@/app/api/v1/nonce/route").POST>[0];
    const { POST } = await import("@/app/api/v1/nonce/route");
    const res = (await POST(req)) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("rate limits after exceeding the 5-per-window cap", async () => {
    // First 5 allowed, 6th blocked.
    hoisted.checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: 0, count: 1 })
      .mockResolvedValueOnce({ allowed: true, remaining: 3, resetAt: 0, count: 2 })
      .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: 0, count: 3 })
      .mockResolvedValueOnce({ allowed: true, remaining: 1, resetAt: 0, count: 4 })
      .mockResolvedValueOnce({ allowed: true, remaining: 0, resetAt: 0, count: 5 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 0, count: 6 });

    for (let i = 0; i < 5; i++) {
      const r = await call({ address: VALID_ADDR });
      expect(r.status).toBe(200);
    }
    const blocked = await call({ address: VALID_ADDR });
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  });

  it("uses the noncePerAddress rate window (limit=5, window=300s)", async () => {
    await call({ address: VALID_ADDR });
    expect(hoisted.checkRateLimit).toHaveBeenCalledWith("rl:nonce:" + VALID_ADDR, 5, 300);
  });
});
