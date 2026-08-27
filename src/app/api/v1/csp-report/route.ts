import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Receives Content-Security-Policy violation reports from browsers.
 *
 * Browsers POST a `csp-report` body whenever a CSP directive is violated.
 * Spec: https://www.w3.org/TR/CSP3/#violation-reports
 *
 * We accept any well-formed report and log it for ops visibility.
 * We do NOT store these long-term — high-traffic violations should be
 * forwarded to an external sink (Sentry, Logflare, etc.) before T+15d.
 *
 * NOTE: This endpoint is intentionally unauthenticated — browsers do not
 * include cookies when sending CSP reports.
 */
const ReportSchema = z.object({
  "csp-report": z
    .object({
      "violated-directive": z.string().optional(),
      "effective-directive": z.string().optional(),
      "blocked-uri": z.string().optional(),
      "document-uri": z.string().optional(),
      "original-policy": z.string().optional(),
      disposition: z.string().optional(),
      "status-code": z.number().optional(),
    })
    .passthrough(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    // Spec says to be lenient — silently accept malformed reports.
    return new NextResponse(null, { status: 204 });
  }

  const report = parsed.data["csp-report"];
  // Structured log so Vercel log search surfaces it as `csp_violation`.
  console.warn("[csp_violation]", {
    directive: report["violated-directive"] ?? report["effective-directive"],
    blocked: report["blocked-uri"],
    document: report["document-uri"],
    status: report["status-code"],
    ts: new Date().toISOString(),
  });

  // 204 No Content is the spec-recommended response.
  return new NextResponse(null, { status: 204 });
}

export async function GET(): Promise<Response> {
  // Browsers never GET — just sanity-check the endpoint exists.
  return NextResponse.json({ status: "ok", description: "csp-report receiver" });
}