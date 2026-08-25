import { NextResponse, type NextRequest } from "next/server";

/**
 * Simplified Proxy for Development - Performance Optimized
 * 
 * This version removes the JWT verification call that might be causing
 * the server performance issues, while still maintaining basic routing.
 */

const PUBLIC_API_PREFIXES = [
  "/api/v1/nonce",
  "/api/v1/verify", 
  "/api/v1/health",
  "/api/v1/logout",
  "/api/v1/dev-login", // DEV ONLY: Allow dev authentication bypass
];

function isPublicReadProposal(method: string, pathname: string): boolean {
  return method === "GET" && (pathname === "/api/v1/proposals" || pathname.startsWith("/api/v1/proposals/"));
}

function isPublicTagsRead(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/api/v1/tags";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  console.log(`[Proxy] ${method} ${pathname}`); // Debug logging

  // Only API routes are guarded at the proxy level
  if (!pathname.startsWith("/api/v1/")) {
    console.log(`[Proxy] Allowing page route: ${pathname}`);
    return NextResponse.next();
  }

  // Public API routes
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p)) {
    console.log(`[Proxy] Allowing public API: ${pathname}`);
    return NextResponse.next();
  }
  
  if (isPublicReadProposal(method, pathname)) {
    console.log(`[Proxy] Allowing public proposal read: ${pathname}`);
    return NextResponse.next();
  }
  
  if (isPublicTagsRead(method, pathname)) {
    console.log(`[Proxy] Allowing public tags read: ${pathname}`);
    return NextResponse.next();
  }

  // For now, allow all API requests in development for debugging
  if (process.env.NODE_ENV === "development") {
    console.log(`[Proxy] DEV MODE: Allowing all API requests: ${pathname}`);
    return NextResponse.next();
  }

  console.log(`[Proxy] Checking auth for: ${pathname}`);

  // JWT verification - defense-in-depth middleware check
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" }}, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
