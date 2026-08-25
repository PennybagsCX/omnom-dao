import { type NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, SESSION_COOKIE_ATTRIBUTES } from "@/lib/auth";

/**
 * POST /api/v1/logout
 *
 * Clear the JWT session cookie. No body required. Always succeeds (idempotent).
 */
export async function POST() {
  const response = NextResponse.json({ success: true, data: { loggedOut: true } });
  response.cookies.set("omnom_token", "", {
    ...SESSION_COOKIE_ATTRIBUTES,
    maxAge: 0,
  });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}

/**
 * GET /api/v1/logout?next=/
 *
 * Browser-friendly logout: clears the cookie and redirects to `next` (or `/`).
 * Used by the Sign Out button for full-page-reload logout (dev mock wallet).
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/";
  // Sanitize: only allow relative paths to prevent open-redirect.
  const safePath = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const response = NextResponse.redirect(new URL(safePath, request.url));
  response.cookies.set("omnom_token", "", {
    ...SESSION_COOKIE_ATTRIBUTES,
    maxAge: 0,
  });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
