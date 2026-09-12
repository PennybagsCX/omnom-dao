/**
 * OMNOM DAO — One-time backfill: election-result notification
 *
 * The Foundational Governance Election (foundational-2026) closed on
 * 2026-09-12 with QUADRATIC winning 65.7% — but the election surface had no
 * notification producers, so no user was notified. This inserts a single
 * PROPOSAL_RESULT notification for every registered user.
 *
 * Idempotent: skips users who already have an election-result notification
 * (matched by title), so it is safe to re-run.
 *
 * Run: npx tsx scripts/backfill-election-notification.ts
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */
import { createClient } from "@libsql/client";

const TITLE = "🏁 Election result: Quadratic voting wins";
const BODY =
  "The Foundational Governance Election has closed. Quadratic voting won with 65.7% of 35 ballots " +
  "(Linear 17.1%, One-wallet-one-vote 14.3%, Tiered 2.9%). Voting power for proposals will follow " +
  "the community's choice: the square root of your snapshot balance. See dao.omnom.dog for details.";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.startsWith("mock://")) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const db = createClient({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: requireEnv("TURSO_AUTH_TOKEN"),
  });

  const users = await db.execute("SELECT id FROM users");
  console.log(`Registered users: ${users.rows.length}`);

  let inserted = 0;
  let skipped = 0;
  for (const row of users.rows) {
    const userId = row.id as string;
    const seen = await db.execute({
      sql: "SELECT 1 FROM notifications WHERE user_id = ? AND title = ? LIMIT 1",
      args: [userId, TITLE],
    });
    if (seen.rows.length > 0) {
      skipped++;
      continue;
    }
    await db.execute({
      sql: "INSERT INTO notifications (user_id, type, title, body, proposal_id) VALUES (?, 'PROPOSAL_RESULT', ?, ?, NULL)",
      args: [userId, TITLE, BODY],
    });
    inserted++;
  }

  console.log(`✅ Inserted ${inserted}, skipped ${skipped} (already notified).`);
}

main().catch((err) => {
  console.error("💥 Backfill failed:", err);
  process.exit(1);
});
