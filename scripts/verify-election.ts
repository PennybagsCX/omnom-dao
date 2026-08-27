/**
 * OMNOM DAO — Election Verification Script
 *
 * Post-deploy smoke test. Confirms:
 *   1. The foundational-2026 election row exists in Turso
 *   2. SNAPSHOT_SHA256 env matches the SHA of data/holders.json on disk
 *   3. Total holders in the snapshot matches eligible_wallet_count
 *   4. Tier distribution matches EXPECTED_DIST
 *   5. Voting window covers 2026-08-29 → 2026-09-12 (14 days)
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Run: `npx tsx scripts/verify-election.ts`
 *       (or wire into CI as a post-deploy check)
 */
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_TIER_DIST = {
  krakens: 1,
  whales: 3,
  dolphins: 30,
  sharks: 326,
  octopuses: 1078,
  crabs: 1701,
  seahorses: 22547,
} as const;

const REQUIRED_TOTAL = 25_686;
const REQUIRED_START = "2026-08-29T00:00:00.000Z";
const REQUIRED_END = "2026-09-12T00:00:00.000Z";
const REQUIRED_ELECTION_KEY = "foundational-2026";

function red(s: string): string {
  return `\x1b[31m${s}\x1b[0m`;
}
function green(s: string): string {
  return `\x1b[32m${s}\x1b[0m`;
}
function yellow(s: string): string {
  return `\x1b[33m${s}\x1b[0m`;
}

let failures = 0;
function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ${green("✓")} ${label}`);
  } else {
    failures++;
    console.log(`  ${red("✗")} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log("🗳️  OMNOM DAO election verification\n");

  // ── 1. Env presence ─────────────────────────────────────────────
  console.log("Environment:");
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const pinnedSha = process.env.SNAPSHOT_SHA256;
  assert("TURSO_DATABASE_URL is set", Boolean(url));
  assert("TURSO_AUTH_TOKEN is set", Boolean(token));
  assert("SNAPSHOT_SHA256 is set", Boolean(pinnedSha));
  if (!url || !token || !pinnedSha) {
    console.log(`\n${red("Missing required env vars. Aborting.")}`);
    process.exit(1);
  }

  // ── 2. Local artifact SHA ───────────────────────────────────────
  console.log("\nLocal artifact:");
  const holdersPath = resolve(process.cwd(), "data/holders.json");
  const exists = existsSync(holdersPath);
  assert("data/holders.json exists", exists, holdersPath);
  if (!exists) process.exit(1);

  const bytes = readFileSync(holdersPath);
  const localSha = createHash("sha256").update(bytes).digest("hex");
  assert(
    `data/holders.json SHA-256 matches env`,
    localSha === pinnedSha,
    `local=${localSha} env=${pinnedSha}`,
  );

  // ── 3. DB election row ──────────────────────────────────────────
  console.log("\nDatabase:");
  const db = createClient({ url, authToken: token });

  const electionRes = await db.execute({
    sql: "SELECT * FROM governance_election WHERE election_key = ?",
    args: [REQUIRED_ELECTION_KEY],
  });
  const row = electionRes.rows[0];
  assert("governance_election.foundational-2026 exists", Boolean(row));
  if (!row) {
    console.log(`\n${red("Election row missing. Run: npm run db:seed")}`);
    process.exit(1);
  }

  assert(
    "title = 'Foundational Governance Election'",
    row.title === "Foundational Governance Election",
  );
  assert(
    "voting_starts_at = 2026-08-29T00:00:00Z",
    row.voting_starts_at === REQUIRED_START,
  );
  assert(
    "voting_ends_at = 2026-09-12T00:00:00Z",
    row.voting_ends_at === REQUIRED_END,
  );
  assert(
    "snapshot_commit pinned",
    row.snapshot_commit === "2c38af77ba37e67328347cc44bcabbd07551ec42",
  );
  assert(
    "snapshot_file = omnom-snapshot-ever-held.csv",
    row.snapshot_file === "omnom-snapshot-ever-held.csv",
  );
  assert(
    "snapshot_file_sha256 = 1f64a663…",
    row.snapshot_file_sha256 ===
      "1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128",
  );
  assert(
    "eligible_wallet_count = 25686",
    row.eligible_wallet_count === REQUIRED_TOTAL,
  );

  // ── 4. Voting window math ───────────────────────────────────────
  console.log("\nWindow:");
  const start = new Date(row.voting_starts_at as string);
  const end = new Date(row.voting_ends_at as string);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  assert("voting window is exactly 14 days", days === 14, `got ${days}`);

  const now = new Date();
  const phase =
    now < start ? "UPCOMING" : now <= end ? "OPEN" : "CLOSED";
  console.log(`  ${yellow("→")} current phase: ${phase} (${now.toISOString()})`);

  // ── 5. Snapshot integrity ───────────────────────────────────────
  console.log("\nSnapshot:");
  type Holder = {
    holderClass: string;
    currentlyHolds: boolean;
  };
  type HoldersFile = {
    sortedAddresses: string[];
    holders: Record<string, Holder>;
    metadata: {
      totalHolders: number;
      distribution: Record<string, number>;
      blockNumber: number;
    };
  };
  const snapshot = JSON.parse(bytes.toString("utf-8")) as HoldersFile;

  assert(
    `snapshot.metadata.totalHolders = ${REQUIRED_TOTAL}`,
    snapshot.metadata?.totalHolders === REQUIRED_TOTAL,
    `got ${snapshot.metadata?.totalHolders}`,
  );

  assert(
    `snapshot metadata.blockNumber = 59922100`,
    snapshot.metadata?.blockNumber === 59_922_100,
    `got ${snapshot.metadata?.blockNumber}`,
  );

  const dist = snapshot.metadata?.distribution ?? {};
  let distOk = true;
  for (const [tier, expected] of Object.entries(REQUIRED_TIER_DIST)) {
    const got = dist[tier];
    if (got !== expected) {
      distOk = false;
      console.log(`    ${red("✗")} ${tier}: expected ${expected}, got ${got}`);
    }
  }
  assert("tier distribution matches EXPECTED_DIST", distOk);

  assert(
    `holders map has ${REQUIRED_TOTAL} entries`,
    Object.keys(snapshot.holders ?? {}).length === REQUIRED_TOTAL,
  );

  // ── Summary ─────────────────────────────────────────────────────
  console.log();
  if (failures === 0) {
    console.log(
      green(`✅ All checks passed. Election is production-ready (phase: ${phase}).`),
    );
    process.exit(0);
  } else {
    console.log(red(`❌ ${failures} check(s) failed.`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 Verification crashed:", err);
  process.exit(1);
});