import { db } from "@/lib/db";

/**
 * Admin action audit log service.
 *
 * Records every admin/moderator action with a timestamp, actor address,
 * action type, target entity, and optional details. This creates a
 * transparent, publicly auditable trail of all governance gatekeeping
 * decisions — addressing the single-admin trust concern.
 *
 * The audit log is publicly readable via GET /api/v1/audit-log.
 */

/** Categories of admin actions. */
export type AuditAction =
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_REJECTED"
  | "PROPOSAL_STATUS_OVERRIDE";

export interface AuditLogEntry {
  id: string;
  actorAddress: string;
  action: AuditAction;
  targetType: "proposal" | "user" | "platform";
  targetId: string;
  details: string | null;
  createdAt: string;
}

/** Map a raw DB row to a typed AuditLogEntry. */
function rowToEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    actorAddress: row.actor_address as string,
    action: row.action as AuditAction,
    targetType: row.target_type as "proposal" | "user" | "platform",
    targetId: row.target_id as string,
    details: (row.details as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Record an admin action in the audit log.
 *
 * This is fire-and-forget by design — it should never block or break the
 * primary operation. If the audit log write fails, the action still proceeds
 * but the error is logged.
 */
export async function recordAuditEvent(
  actorAddress: string,
  action: AuditAction,
  targetType: "proposal" | "user" | "platform",
  targetId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.execute({
      sql: "INSERT INTO audit_log (actor_address, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)",
      args: [
        actorAddress.toLowerCase(),
        action,
        targetType,
        targetId,
        details ? JSON.stringify(details) : null,
      ],
    });
  } catch (err) {
    // Audit log failure must never break governance operations.
    console.error("[audit-log] Failed to record event:", err);
  }
}

/**
 * List audit log entries (public, paginated).
 *
 * @param limit  - page size (max 100)
 * @param offset - pagination offset
 */
export async function listAuditEntries(
  limit = 50,
  offset = 0,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const clampedLimit = Math.min(100, Math.max(1, limit));

  const countRes = await db.execute({
    sql: "SELECT COUNT(*) AS cnt FROM audit_log",
    args: [],
  });
  const total = Number((countRes.rows[0]?.cnt as number | string) ?? 0);

  const res = await db.execute({
    sql: "SELECT id, actor_address, action, target_type, target_id, details, created_at " +
         "FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
    args: [clampedLimit, offset],
  });

  const entries = res.rows.map((r) =>
    rowToEntry(r as unknown as Record<string, unknown>),
  );

  return { entries, total };
}
