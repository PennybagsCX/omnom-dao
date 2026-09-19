/**
 * OMNOM DAO — One-off migration: PROPOSAL_DELETED audit action.
 *
 * The audit_log.action CHECK constraint (added in migrations §17) must learn
 * the new PROPOSAL_DELETED action written by DELETE
 * /api/v1/proposals/[id]/delete. SQLite cannot ALTER a CHECK constraint, so
 * evolving the audit_log.action domain requires the classic
 * copy-through-rebuild: create audit_log_new with the updated CHECK, copy all
 * rows, drop the old table, rename, and recreate the indexes.
 *
 * Idempotent: exits 0 as a no-op when the audit_log table already knows
 * PROPOSAL_DELETED (fresh installs get it from scripts/migrations.ts
 * directly).
 *
 * Run once per existing database: `npm run db:migrate:proposal-deleted`
 * (must run before the first production delete — the route's audit writer
 * is fire-and-forget and would otherwise fail silently).
 */
import { createClient } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}`);
    console.error("   Copy .env.example → .env.local and fill in real values.\n");
    process.exit(1);
  }
  return value;
}

// Identical to the audit_log CREATE TABLE in scripts/migrations.ts (keep in
// sync — this script exists only for databases created before
// PROPOSAL_DELETED).
const AUDIT_LOG_TABLE_DDL = `CREATE TABLE audit_log_new (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      actor_address   TEXT NOT NULL,
      action          TEXT NOT NULL CHECK (action IN (
                        'PROPOSAL_APPROVED', 'PROPOSAL_REJECTED',
                        'PROPOSAL_OUTCOME_RECORDED', 'PROPOSAL_STATUS_OVERRIDE',
                        'PROPOSAL_DELETED'
                      )),
      target_type     TEXT NOT NULL CHECK (target_type IN ('proposal', 'user', 'platform')),
      target_id       TEXT NOT NULL,
      details         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )`;

const AUDIT_LOG_COLUMNS =
  "id, actor_address, action, target_type, target_id, details, created_at";

// Exact recreate of the audit_log indexes from scripts/migrations.ts.
const INDEX_DDL = [
  `CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC)`,
  `CREATE INDEX idx_audit_log_target ON audit_log (target_type, target_id)`,
];

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");

  const db = createClient({ url, authToken });

  // Guard: skip when the live schema already accepts PROPOSAL_DELETED.
  const schema = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'",
    args: [],
  });
  const tableSql = (schema.rows[0]?.sql as string | null) ?? "";
  if (tableSql.includes("PROPOSAL_DELETED")) {
    console.log("✅ audit_log table already supports PROPOSAL_DELETED — nothing to do.");
    return;
  }

  // FK enforcement is per-connection; the DROP TABLE below must not fire any
  // FK behavior — pin it OFF here, OUTSIDE the transaction (PRAGMA
  // foreign_keys is a no-op inside one).
  await db.execute("PRAGMA foreign_keys=OFF");

  const countRes = await db.execute("SELECT COUNT(*) AS cnt FROM audit_log");
  const rowCount = Number((countRes.rows[0]?.cnt as number | string) ?? 0);

  console.log("🚀 Rebuilding audit_log table with PROPOSAL_DELETED support...");

  // Single transaction: either the whole rebuild lands or none of it does.
  await db.batch(
    [
      // Rerun insurance: clear any orphan from a past partial attempt.
      { sql: "DROP TABLE IF EXISTS audit_log_new", args: [] },
      { sql: AUDIT_LOG_TABLE_DDL, args: [] },
      {
        sql: `INSERT INTO audit_log_new (${AUDIT_LOG_COLUMNS}) SELECT ${AUDIT_LOG_COLUMNS} FROM audit_log`,
        args: [],
      },
      { sql: "DROP TABLE audit_log", args: [] },
      { sql: "ALTER TABLE audit_log_new RENAME TO audit_log", args: [] },
      ...INDEX_DDL.map((sql) => ({ sql, args: [] })),
    ],
    "write",
  );

  // Safety verification: every audit row must have survived the rebuild.
  const afterRes = await db.execute("SELECT COUNT(*) AS cnt FROM audit_log");
  const afterCount = Number((afterRes.rows[0]?.cnt as number | string) ?? 0);
  if (afterCount !== rowCount) {
    console.error(
      `\n💥 AUDIT ROW COUNT CHANGED after rebuild (${rowCount} → ${afterCount}) — investigate now!\n`,
    );
    process.exit(1);
  }

  console.log(
    `✅ Copied ${rowCount} audit_log row(s); CHECK constraint now allows PROPOSAL_DELETED.`,
  );
}

main().catch((err) => {
  console.error("\n💥 Migration failed:", err);
  process.exit(1);
});
