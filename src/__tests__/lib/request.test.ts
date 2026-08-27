import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/request";

function req(headers: Record<string, string | null>): NextRequest {
  return {
    headers: { get: (name: string) => headers[name] ?? null },
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" })),
    ).toBe("1.1.1.1");
  });

  it("trims whitespace around the first forwarded entry", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "  9.9.9.9 , 8.8.8.8" })),
    ).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when the forwarded list is empty", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "", "x-real-ip": "4.4.4.4" })),
    ).toBe("4.4.4.4");
  });

  it("falls back to x-real-ip when the first forwarded entry is blank", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": ", 5.5.5.5", "x-real-ip": "6.6.6.6" })),
    ).toBe("6.6.6.6");
  });

  it("trims x-real-ip", () => {
    expect(getClientIp(req({ "x-real-ip": " 7.7.7.7 " }))).toBe("7.7.7.7");
  });

  it("returns 0.0.0.0 when no IP headers exist", () => {
    expect(getClientIp(req({}))).toBe("0.0.0.0");
    expect(
      getClientIp(req({ "x-forwarded-for": null, "x-real-ip": null })),
    ).toBe("0.0.0.0");
  });
});
