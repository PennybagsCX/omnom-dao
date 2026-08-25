import type { NextRequest } from "next/server";

/**
 * Extract the client IP from a NextRequest, honoring the `x-forwarded-for`
 * and `x-real-ip` headers set by Vercel's edge network.
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xReal = request.headers.get("x-real-ip");
  if (xReal) return xReal.trim();
  return "0.0.0.0";
}
