/**
 * OMNOM DAO — Database Migration Script
 *
 * Creates all 7 Turso/SQLite tables per DATA-MODEL.md §6 plus their indexes.
 * Idempotent (uses CREATE TABLE IF NOT EXISTS). Safe to re-run.
 *
 * Run: `npm run db:migrate`
 *
 * Tables:
 *   1. users
 *   2. proposals
 *   3. votes               (UNIQUE(proposal_id, voter_address))
 *   4. comments            (self-ref parent_id, soft-delete)
 *   5. notifications
 *   6. proposal_templates
 *   7. sessions            (JWT issuance / nonce bookkeeping; nonce TTL also in KV)
 */
import { createClient } from "@libsql/client";

import { MIGRATION_STATEMENTS } from "./migrations";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}`);
    console.error("   Copy .env.example → .env.local and fill in real values.\n");
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");

  const db = createClient({ url, authToken });

  console.log("🚀 Running OMNOM DAO migrations...");
  let applied = 0;
  for (const stmt of MIGRATION_STATEMENTS) {
    try {
      // Pass the SQL as a plain string — parameterized via args where needed.
      await db.execute(stmt.sql);
      applied++;
    } catch (err) {
      console.error("❌ Migration statement failed:\n   ", stmt.sql);
      throw err;
    }
  }

  console.log(`✅ Applied ${applied} migration statements (12 tables + indexes).`);
}

main().catch((err) => {
  console.error("\n💥 Migration failed:", err);
  process.exit(1);
});
