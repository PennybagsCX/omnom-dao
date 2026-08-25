import { type NextRequest } from "next/server";

import { apiSuccess } from "@/lib/api-response";
import { listAuditEntries, type AuditLogEntry } from "@/lib/audit-log";

/**
 * GET /api/v1/audit-log
 *
 * Public, paginated list of admin/moderator governance actions.
 *
 * This endpoint provides transparency for all proposal approvals, rejections,
 * and status overrides. It's readable by anyone — no authentication required.
 *
 * Query params:
 *   - page (default 1)
 *   - pageSize (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "50") || 50),
  );
  const offset = (page - 1) * pageSize;

  const { entries, total } = await listAuditEntries(pageSize, offset);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return apiSuccess<{ entries: AuditLogEntry[] }>(
    { entries },
    { page, pageSize, totalItems: total, totalPages },
  );
}
