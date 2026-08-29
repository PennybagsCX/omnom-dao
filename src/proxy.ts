import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * API gateway proxy (edge) — defense-in-depth JWT check.
 *
 * Verifies the session JWT cryptographically (HS256 via jose, issuer +
 * audience validated) before a request reaches a protected API route. This is
 * the outer layer only: every protected route handler independently validates
 * the session via `@/lib/auth` (`getSession` / `requireAuth`), which performs
 * the same `verifySession` against the same secret.
 *
 * `@/lib/session` is deliberately dependency-light (jose only) so it can run
 * in the edge runtime without bundling Node-only snapshot/db code.
 */

const PUBLIC_API_PREFIXES = [
  "/api/v1/nonce",
  "/api/v1/verify",
  "/api/v1/health",
  "/api/v1/logout",
  // Cron sweep endpoint — has its own Bearer-secret auth check
  // (cron/finalize/route.ts), so JWT middleware must not intercept it.
  "/api/v1/cron/finalize",
  // CSP violation receiver — browsers POST reports without cookies,
  // and the endpoint must accept them from any origin (CSP is per-origin).
  "/api/v1/csp-report",
  // DEV ONLY: allow dev auth bypass outside the production bundle
  ...(process.env.NODE_ENV === "development" ? ["/api/v1/dev-login"] : []),
];

function isPublicReadProposal(method: string, pathname: string): boolean {
  return method === "GET" && (pathname === "/api/v1/proposals" || pathname.startsWith("/api/v1/proposals/"));
}

function isPublicTagsRead(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/api/v1/tags";
}

function isPublicSnapshotExplorerRead(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/api/v1/snapshot-explorer";
}

// GET /api/v1/governance-vote is a public read — election timing,
// eligibility counts, and tally are public knowledge. Viewer-specific
// fields (userChoice / userEligible) require the `?me=true` flag, and
// the route handler enforces that internally. POST remains auth-gated.
function isPublicGovernanceVoteRead(method: string, pathname: string): boolean {
  return method === "GET" && pathname === "/api/v1/governance-vote";
}

// GET /api/v1/elections/[key]/comments is a public read — discussion
// threads are part of the election record. The route handler internally
// tries `requireAuth()` for `myReaction` enrichment (anonymous readers
// get `myReaction: null`). POST/DELETE/reactions remain auth-gated.
function isPublicElectionCommentsRead(method: string, pathname: string): boolean {
  return (
    method === "GET" &&
    /^\/api\/v1\/elections\/[^/]+\/comments\/?$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Public API routes
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  if (isPublicReadProposal(method, pathname)) {
    return NextResponse.next();
  }

  if (isPublicTagsRead(method, pathname)) {
    return NextResponse.next();
  }

  if (isPublicSnapshotExplorerRead(method, pathname)) {
    return NextResponse.next();
  }

  if (isPublicGovernanceVoteRead(method, pathname)) {
    return NextResponse.next();
  }

  if (isPublicElectionCommentsRead(method, pathname)) {
    return NextResponse.next();
  }

  // Development only: bypass the edge check so mock/dev flows are not blocked
  // here (route handlers still enforce auth themselves). Never active in the
  // production bundle — NODE_ENV is inlined at build time.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // JWT verification — signature, expiry, issuer and audience are all checked.
  // A forged/garbage cookie value fails verification here (fail-closed).
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;
  if (!claims) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
