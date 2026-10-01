/**
 * OMNOM DAO — One-off migration: VOTING_ENDING_72H notification type.
 *
 * The T-72h reminder wave (REFERENDUM-WAVE1.md — turnout is the lever) writes
 * VOTING_ENDING_72H notification rows from the cron sweep. The notifications
 * `type` CHECK constraint on databases created before that type existed
 * rejects them — and createNotification swallows the failure, so the whole
 * wave would be lost silently. SQLite cannot ALTER a CHECK constraint, so
 * evolving the type domain requires the classic copy-through-rebuild: create
 * notifications_new with the updated CHECK, copy all rows, drop the old
 * table, rename, recreate the indexes (same mechanics as
 * migrate-audit-vote-actions.ts).
 *
 * Idempotent: exits 0 as a no-op when the notifications table already knows
 * VOTING_ENDING_72H (fresh installs get the full list from
 * scripts/migrations.ts directly).
 *
 * Run once per existing database: `npx tsx scripts/migrate-notifications-72h.ts`.
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

// Identical to the notifications CREATE TABLE in scripts/migrations.ts (keep
// in sync — this script exists only for databases created before
// VOTING_ENDING_72H).
const NOTIFICATIONS_TABLE_DDL = `CREATE TABLE notifications_new (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id         TEXT NOT NULL,
      type            TEXT NOT NULL CHECK (type IN (
        'PROPOSAL_CREATED', 'VOTING_STARTED', 'VOTING_ENDING_SOON',
        'VOTING_ENDING_72H', 'PROPOSAL_RESULT', 'MENTION'
      )),
      title           TEXT NOT NULL CHECK (length(title) <= 100),
      body            TEXT NOT NULL CHECK (length(body) <= 500),
      read            INTEGER NOT NULL DEFAULT 0,
      proposal_id     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE SET NULL
    )`;

const NOTIFICATION_COLUMNS =
  "id, user_id, type, title, body, read, proposal_id, created_at";

// Exact recreate of the notifications indexes from scripts/migrations.ts.
const INDEX_DDL = [
  `CREATE INDEX idx_notifications_user_read ON notifications (user_id, read, created_at DESC)`,
  `CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read = 0`,
];

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");

  const db = createClient({ url, authToken });

  // Guard: skip when the live schema already accepts VOTING_ENDING_72H.
  const schema = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notifications'",
    args: [],
  });
  const tableSql = (schema.rows[0]?.sql as string | null) ?? "";
  if (tableSql.includes("VOTING_ENDING_72H")) {
    console.log("✅ notifications table already supports VOTING_ENDING_72H — nothing to do.");
    return;
  }

  // FK enforcement is per-connection; the DROP TABLE below must not fire any
  // FK behavior — pin it OFF here, OUTSIDE the transaction (PRAGMA
  // foreign_keys is a no-op inside one).
  await db.execute("PRAGMA foreign_keys=OFF");

  const countRes = await db.execute("SELECT COUNT(*) AS cnt FROM notifications");
  const rowCount = Number((countRes.rows[0]?.cnt as number | string) ?? 0);

  console.log("🚀 Rebuilding notifications table with VOTING_ENDING_72H support...");

  // Single transaction: either the whole rebuild lands or none of it does.
  await db.batch(
    [
      // Rerun insurance: clear any orphan from a past partial attempt.
      { sql: "DROP TABLE IF EXISTS notifications_new", args: [] },
      { sql: NOTIFICATIONS_TABLE_DDL, args: [] },
      {
        sql: `INSERT INTO notifications_new (${NOTIFICATION_COLUMNS}) SELECT ${NOTIFICATION_COLUMNS} FROM notifications`,
        args: [],
      },
      { sql: "DROP TABLE notifications", args: [] },
      { sql: "ALTER TABLE notifications_new RENAME TO notifications", args: [] },
      ...INDEX_DDL.map((sql) => ({ sql, args: [] })),
    ],
    "write",
  );

  // Safety verification: every notification row must have survived the rebuild.
  const afterRes = await db.execute("SELECT COUNT(*) AS cnt FROM notifications");
  const afterCount = Number((afterRes.rows[0]?.cnt as number | string) ?? 0);
  if (afterCount !== rowCount) {
    console.error(
      `\n💥 NOTIFICATION ROW COUNT CHANGED after rebuild (${rowCount} → ${afterCount}) — investigate now!\n`,
    );
    process.exit(1);
  }

  // Proof: the rebuilt constraint actually accepts the new type.
  const probe = await db.execute({
    sql: "INSERT INTO notifications (user_id, type, title, body) VALUES ('__migration_probe__', 'VOTING_ENDING_72H', '__migration_probe__', '__migration_probe__')",
    args: [],
  });
  await db.execute({
    sql: "DELETE FROM notifications WHERE user_id = '__migration_probe__'",
    args: [],
  });
  console.log(`✅ Copied ${rowCount} notification row(s); probe insert rowsAffected=${probe.rowsAffected}.`);
}

main().catch((err) => {
  console.error("\n💥 Migration failed:", err);
  process.exit(1);
});
