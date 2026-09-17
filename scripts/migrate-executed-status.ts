/**
 * OMNOM DAO — One-off migration: EXECUTED proposal status.
 *
 * GOVERNANCE_MECHANICS.md §6.1 promises an "Executed" lifecycle state
 * ("Outcome recorded (off-chain action taken)"). SQLite cannot ALTER a CHECK
 * constraint, so evolving the proposals.status domain requires the classic
 * copy-through-rebuild: create proposals_new with the updated CHECK, copy all
 * rows, drop the old table, rename, and recreate the indexes.
 *
 * Idempotent: exits 0 as a no-op when the proposals table already knows
 * EXECUTED (fresh installs get it from scripts/migrations.ts directly).
 *
 * Run once: `npm run db:migrate:executed`
 */
import { createClient, type Client } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}`);
    console.error("   Copy .env.example → .env.local and fill in real values.\n");
    process.exit(1);
  }
  return value;
}

// Identical to the proposals CREATE TABLE in scripts/migrations.ts (keep in
// sync — this script exists only for databases created before EXECUTED).
const PROPOSALS_TABLE_DDL = `CREATE TABLE proposals_new (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title             TEXT NOT NULL CHECK (length(title) <= 200),
  description       TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'GENERAL'
                    CHECK (type IN (
                      'CHAIN_SELECTION', 'TOKENOMICS_CHANGE', 'TREASURY',
                      'GUIDELINE', 'TECHNICAL', 'GENERAL'
                    )),
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN (
                      'DRAFT', 'PENDING_REVIEW', 'ACTIVE',
                      'PASSED', 'FAILED', 'EXPIRED', 'EXECUTED'
                    )),
  author_address    TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  voting_starts_at  TEXT,
  voting_ends_at    TEXT,
  quorum_required   REAL NOT NULL DEFAULT 10.0,
  quorum_achieved   REAL,
  votes_for         INTEGER NOT NULL DEFAULT 0,
  votes_against     INTEGER NOT NULL DEFAULT 0,
  votes_abstain     INTEGER NOT NULL DEFAULT 0,
  metadata          TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (author_address) REFERENCES users (wallet_address)
)`;

const PROPOSAL_COLUMNS =
  "id, title, description, type, status, author_address, created_at, " +
  "updated_at, voting_starts_at, voting_ends_at, quorum_required, " +
  "quorum_achieved, votes_for, votes_against, votes_abstain, metadata";

// Exact recreate of the proposals indexes from scripts/migrations.ts.
const INDEX_DDL = [
  `CREATE INDEX idx_proposals_status ON proposals (status)`,
  `CREATE INDEX idx_proposals_author ON proposals (author_address)`,
  `CREATE INDEX idx_proposals_voting_period
        ON proposals (voting_starts_at, voting_ends_at)
        WHERE status = 'ACTIVE'`,
  `CREATE INDEX idx_proposals_created ON proposals (created_at DESC)`,
];

/** Row counts of tables that FK-reference proposals — logged before/after as a safety check. */
const CHILD_TABLES = ["votes", "comments", "proposal_emoji_reactions", "notifications"] as const;

async function childRowCounts(db: Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of CHILD_TABLES) {
    const res = await db.execute(`SELECT COUNT(*) AS cnt FROM ${table}`);
    out[table] = Number((res.rows[0]?.cnt as number | string) ?? 0);
  }
  return out;
}

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");

  const db = createClient({ url, authToken });

  // Guard: skip when the live schema already accepts EXECUTED.
  const schema = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'proposals'",
    args: [],
  });
  const tableSql = (schema.rows[0]?.sql as string | null) ?? "";
  if (tableSql.includes("EXECUTED")) {
    console.log("✅ proposals table already supports EXECUTED — nothing to do.");
    return;
  }

  // Pre-flight: the new CHECK drops 'CLOSED' (no code path ever wrote it).
  // Abort with a clear message rather than a cryptic constraint error if a
  // historical row somehow carries it.
  const closedRes = await db.execute(
    "SELECT COUNT(*) AS cnt FROM proposals WHERE status = 'CLOSED'",
  );
  const closedCount = Number((closedRes.rows[0]?.cnt as number | string) ?? 0);
  if (closedCount > 0) {
    console.error(
      `\n❌ Found ${closedCount} proposal(s) with status='CLOSED', which the new CHECK ` +
        "constraint drops. Map them to PASSED/FAILED/EXPIRED first, then re-run.\n",
    );
    process.exit(1);
  }

  // FK enforcement is per-connection; the DROP TABLE below must never fire the
  // ON DELETE CASCADE child FKs (votes/comments/reactions) — pin it OFF here,
  // OUTSIDE the transaction (PRAGMA foreign_keys is a no-op inside one).
  await db.execute("PRAGMA foreign_keys=OFF");

  const countRes = await db.execute("SELECT COUNT(*) AS cnt FROM proposals");
  const rowCount = Number((countRes.rows[0]?.cnt as number | string) ?? 0);
  const before = await childRowCounts(db);

  console.log("🚀 Rebuilding proposals table with EXECUTED status support...");

  // Single transaction: either the whole rebuild lands or none of it does.
  await db.batch(
    [
      // Rerun insurance: clear any orphan from a past partial attempt.
      { sql: "DROP TABLE IF EXISTS proposals_new", args: [] },
      { sql: PROPOSALS_TABLE_DDL, args: [] },
      {
        sql: `INSERT INTO proposals_new (${PROPOSAL_COLUMNS}) SELECT ${PROPOSAL_COLUMNS} FROM proposals`,
        args: [],
      },
      { sql: "DROP TABLE proposals", args: [] },
      { sql: "ALTER TABLE proposals_new RENAME TO proposals", args: [] },
      ...INDEX_DDL.map((sql) => ({ sql, args: [] })),
    ],
    "write",
  );

  // Safety verification: child rows must be untouched by the rebuild.
  const after = await childRowCounts(db);
  const lost = CHILD_TABLES.filter((t) => after[t] !== before[t]);
  if (lost.length > 0) {
    const detail = lost.map((t) => `${t}: ${before[t]} → ${after[t]}`).join(", ");
    console.error(`\n💥 CHILD ROW COUNT CHANGED after rebuild (${detail}) — investigate now!\n`);
    process.exit(1);
  }

  const childSummary = CHILD_TABLES.map((t) => `${t}=${after[t]}`).join(", ");
  console.log(
    `✅ Copied ${rowCount} proposal row(s); CHECK constraint now allows EXECUTED. ` +
      `Child rows intact (${childSummary}).`,
  );
}

main().catch((err) => {
  console.error("\n💥 Migration failed:", err);
  process.exit(1);
});
