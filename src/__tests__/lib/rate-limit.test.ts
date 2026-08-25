import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ipBucket,
  userActionBucket,
  type RateLimitResult,
} from "@/lib/rate-limit";

/**
 * Rate-limit tests mock the `@vercel/kv` module so no real Redis is hit.
 * The real implementation uses `kv.incr` + `kv.expire` for a fixed-window
 * counter. We simulate those by tracking an incrementing counter per bucket
 * and observing when `checkRateLimit` reports `allowed: false`.
 */

function makeKvMock() {
  const counters = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    counters,
    ttls,
    mock: {
      incr: vi.fn(async (key: string) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return next;
      }),
      expire: vi.fn(async (key: string, seconds: number) => {
        ttls.set(key, seconds);
        return 1;
      }),
    },
    reset() {
      counters.clear();
      ttls.clear();
    },
  };
}

const realNow = Date.now;
let kvState: ReturnType<typeof makeKvMock>;

beforeEach(async () => {
  vi.resetModules();
  // Make KV look "available" by setting env URL.
  process.env.KV_REST_API_URL = "http://fake-kv";
  kvState = makeKvMock();
  vi.doMock("@vercel/kv", () => ({ kv: kvState.mock }));
});

afterEach(() => {
  vi.doUnmock("@vercel/kv");
  delete process.env.KV_REST_API_URL;
  Date.now = realNow;
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const r: RateLimitResult = await checkRateLimit("bucket", 5, 60);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
    expect(r.remaining).toBe(4);
  });

  it("sets the TTL only on the first request of a window", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    await checkRateLimit("ttl-bucket", 5, 60);
    expect(kvState.ttls.get("ttl-bucket")).toBe(60);
    kvState.mock.expire.mockClear();
    await checkRateLimit("ttl-bucket", 5, 60);
    // expire should NOT be called again on the second request.
    expect(kvState.mock.expire).not.toHaveBeenCalled();
  });

  it("blocks requests once the limit is exceeded", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const limit = 3;
    let last: RateLimitResult | null = null;
    for (let i = 0; i < limit; i++) {
      last = await checkRateLimit("over-bucket", limit, 60);
      expect(last.allowed).toBe(true);
    }
    // 4th request exceeds.
    const blocked = await checkRateLimit("over-bucket", limit, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(limit + 1);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires (counter cleared)", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const limit = 2;
    await checkRateLimit("reset-bucket", limit, 60);
    await checkRateLimit("reset-bucket", limit, 60);
    // Simulate window expiry by clearing the in-memory counter.
    kvState.counters.delete("reset-bucket");
    const after = await checkRateLimit("reset-bucket", limit, 60);
    expect(after.allowed).toBe(true);
    expect(after.count).toBe(1);
  });

  it("fails open (allows) when KV throws", async () => {
    vi.resetModules();
    vi.doMock("@vercel/kv", () => ({
      kv: { incr: vi.fn(async () => Promise.reject(new Error("KV down"))), expire: vi.fn() },
    }));
    process.env.KV_REST_API_URL = "http://fake-kv";
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const r = await checkRateLimit("failing-bucket", 1, 60);
    expect(r.allowed).toBe(true);
  });

  it("fails open when KV is not configured (no env URL)", async () => {
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_URL;
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const r = await checkRateLimit("no-kv-bucket", 1, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("bucket key builders", () => {
  it("ipBucket builds a per-IP API key", () => {
    expect(ipBucket("1.2.3.4")).toBe("rl:api:ip:1.2.3.4");
  });

  it("userActionBucket lowercases the address", () => {
    expect(userActionBucket("comments", "0xABCDEF")).toBe("rl:comments:0xabcdef");
  });
});
