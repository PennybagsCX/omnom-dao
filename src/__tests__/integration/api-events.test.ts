import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";

import { POST } from "@/app/api/v1/events/route";

/**
 * Integration tests for POST /api/v1/events (first-party traffic beacon).
 *
 * The route handler is invoked directly with a fake NextRequest. The DB and
 * rate-limit layers are mocked at the module boundary so no real Turso /
 * Vercel KV is contacted. The route is imported statically: its only module
 * state lives behind the mocked boundaries, so there is nothing to reset
 * between tests (and skipping `vi.resetModules` keeps the cold next/server
 * import out of the default 5s test timeout).
 */

const hoisted = vi.hoisted(() => ({
  execute: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { execute: hoisted.execute } }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: hoisted.checkRateLimit,
}));

const VALID_PAGE_VIEW = {
  type: "page_view",
  path: "/vote",
  utm_source: "x",
  utm_campaign: "wave1-referendum",
  utm_medium: "social",
  referrer: "https://x.com/omnomdao",
  session_id: "8f14e45f-ea09-41a0-9f55-5fd1c24b6bd4",
};

const VALID_SHARE_CLICK = { type: "share_click", channel: "x" };

function buildReq(body: unknown, jsonFails = false) {
  return {
    method: "POST",
    url: "http://localhost/api/v1/events",
    nextUrl: new URL("http://localhost/api/v1/events"),
    headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
    json: vi.fn(async () => {
      if (jsonFails) throw new SyntaxError("Unexpected token");
      return body;
    }),
  } as unknown as Parameters<typeof import("@/app/api/v1/events/route").POST>[0];
}

async function call(body: unknown, jsonFails = false): Promise<{ status: number }> {
  const res = (await POST(buildReq(body, jsonFails))) as NextResponse;
  return { status: res.status };
}

beforeEach(() => {
  hoisted.execute.mockReset();
  hoisted.execute.mockResolvedValue({ rows: [], columns: [], rowsAffected: 1 });
  hoisted.checkRateLimit.mockReset();
  hoisted.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 119, resetAt: 0, count: 1 });
});

/** First DB call as { sql, args }, failing the test if no insert happened. */
function firstInsert(): { sql: string; args: unknown[] } {
  const first = hoisted.execute.mock.calls[0]?.[0];
  if (!first) throw new Error("expected a traffic_events insert");
  return first;
}

describe("POST /api/v1/events", () => {
  it("accepts a valid page_view with 204 and inserts one row", async () => {
    const { status } = await call(VALID_PAGE_VIEW);
    expect(status).toBe(204);
    expect(hoisted.execute).toHaveBeenCalledTimes(1);
    const { sql, args } = firstInsert();
    expect(sql).toContain("INSERT INTO traffic_events");
    expect(args).toContain("page_view");
    expect(args).toContain("/vote");
    expect(args).toContain("wave1-referendum");
  });

  it("accepts a valid share_click and stores the channel", async () => {
    const { status } = await call(VALID_SHARE_CLICK);
    expect(status).toBe(204);
    const { args } = firstInsert();
    expect(args).toContain("share_click");
    expect(args).toContain("x");
  });

  it("stores a NULL channel for page_view events", async () => {
    await call(VALID_PAGE_VIEW);
    const { args } = firstInsert();
    const channelIndex = 6; // (id, type, path, utm_source, utm_campaign, utm_medium, channel, …)
    expect(args[channelIndex]).toBeNull();
  });

  it("rejects an unknown event type with 400 and never touches the DB", async () => {
    const { status } = await call({ type: "keystroke" });
    expect(status).toBe(400);
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const { status } = await call(null, true);
    expect(status).toBe(400);
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("rejects a non-object body with 400", async () => {
    const { status } = await call("page_view");
    expect(status).toBe(400);
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("still returns 204 when the DB write fails (fire-and-forget)", async () => {
    hoisted.execute.mockRejectedValue(new Error("Turso unavailable"));
    const { status } = await call(VALID_PAGE_VIEW);
    expect(status).toBe(204);
  });

  it("rate limits after the per-IP window is exhausted", async () => {
    hoisted.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0, count: 121 });
    const { status } = await call(VALID_PAGE_VIEW);
    expect(status).toBe(429);
    expect(hoisted.execute).not.toHaveBeenCalled();
  });

  it("keys the rate limit on the client IP", async () => {
    await call(VALID_PAGE_VIEW);
    expect(hoisted.checkRateLimit).toHaveBeenCalledWith("rl:events:203.0.113.7", 120, 60);
  });
});
