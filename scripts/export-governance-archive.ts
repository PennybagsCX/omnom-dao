/**
 * OMNOM DAO — Governance Archive Export
 *
 * Dumps the governance record to a timestamped JSON file with a SHA-256
 * checksum, for durable off-database backup.
 *
 * Two modes:
 *   default      PUBLIC-SAFE — everything a public site visitor can already
 *                see (proposals, aggregate tallies, election results and
 *                metadata, public comment threads, reaction aggregates).
 *                Safe for artifacts on a public repo.
 *   --full       Adds per-wallet votes and election ballots (address →
 *                choice). This is admin-audit data — run it locally with
 *                your Turso credentials and store the output somewhere
 *                private:
 *                  npx tsx scripts/export-governance-archive.ts --full
 *
 * Run: npx tsx scripts/export-governance-archive.ts [--full]
 * Env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
 */
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "" || value.startsWith("mock://")) {
    console.error(`❌ Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const full = process.argv.includes("--full");
  const db = createClient({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: requireEnv("TURSO_AUTH_TOKEN"),
  });

  const dump = async (label: string, sql: string) => {
    const res = await db.execute(sql);
    console.log(`  ${label}: ${res.rows.length} rows`);
    return res.rows;
  };

  console.log(`🗄️  Exporting governance archive (${full ? "FULL — private" : "public-safe"})…`);

  // ── Public-safe sections ─────────────────────────────────────────
  const election = await dump("election", "SELECT * FROM governance_election");
  const electionResults = await dump(
    "election_results",
    "SELECT choice, COUNT(*) AS count FROM governance_election_ballots GROUP BY election_key, choice",
  );
  const proposals = await dump("proposals", "SELECT * FROM proposals");
  const voteTallies = await dump(
    "vote_tallies",
    "SELECT proposal_id, choice, COUNT(*) AS voters, SUM(voting_power) AS total_power FROM votes GROUP BY proposal_id, choice",
  );
  const comments = await dump(
    "comments_public",
    "SELECT proposal_id, author_address, CASE WHEN deleted_at IS NOT NULL THEN '[deleted]' ELSE content END AS content, created_at, parent_id, deleted_at FROM comments",
  );
  const commentReactionCounts = await dump(
    "comment_reactions_agg",
    "SELECT comment_id, type, COUNT(*) AS count FROM comment_reactions GROUP BY comment_id, type",
  );
  const proposalEmojiCounts = await dump(
    "proposal_emoji_agg",
    "SELECT proposal_id, emoji, COUNT(*) AS count FROM proposal_emoji_reactions GROUP BY proposal_id, emoji",
  );

  // ── Full-only sections (admin audit) ─────────────────────────────
  const votes = full ? await dump("votes", "SELECT * FROM votes") : null;
  const ballots = full ? await dump("ballots", "SELECT * FROM governance_election_ballots") : null;
  const ballotEvents = full
    ? await dump("ballot_events", "SELECT * FROM governance_election_ballot_events")
    : null;

  const archive = {
    format: "omnom-governance-archive/1",
    mode: full ? "full" : "public-safe",
    exportedAt: new Date().toISOString(),
    sections: {
      election,
      electionResults,
      proposals,
      voteTallies,
      comments,
      commentReactionCounts,
      proposalEmojiCounts,
      ...(full ? { votes, ballots, ballotEvents } : {}),
    },
  };

  const json = JSON.stringify(archive, null, 1);
  const sha256 = createHash("sha256").update(json).digest("hex");
  const filename = `governance-archive-${new Date().toISOString().replace(/[:.]/g, "-")}${full ? "-FULL-PRIVATE" : ""}.json`;
  writeFileSync(filename, json);

  console.log(`\n✅ ${filename}`);
  console.log(`🔐 SHA-256: ${sha256}`);
  if (full) {
    console.log("⚠️  FULL archive contains per-wallet votes/ballots — store privately.");
  }
}

main().catch((err) => {
  console.error("\n💥 Export failed:", err);
  process.exit(1);
});
