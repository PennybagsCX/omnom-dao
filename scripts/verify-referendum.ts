/**
 * OMNOM DAO — Wave 1 Referendum Verification Script
 *
 * Launch-gate smoke test (mirrors scripts/verify-election.ts). Confirms the
 * three GENERAL proposals seeded by scripts/seed-referendum.ts are correctly
 * in Turso and pinned to the sanctioned 30-day window:
 *
 *   1. Each title exists — type GENERAL, quorum_required 5, metadata tag
 *      { referendum: "wave1-2026", referendumQuestion: 1|2|3 }
 *   2. Status is a real lifecycle state (PENDING_REVIEW / ACTIVE / decided) —
 *      prints which. Announcements require ACTIVE, so a PENDING_REVIEW state
 *      warns loudly without failing the structural checks.
 *   3. When the window is set (ACTIVE/decided): voting_ends_at is EXACTLY
 *      2026-11-01T00:00:00.000Z on all three (the admin extend action pins
 *      this) and voting_starts_at is within ±6h of 2026-10-02T00:00:00Z
 *      (approve sets now + 168h; drift on the start only is tolerated).
 *   4. Every body discloses the consensus fallback — the `consensus-fallback`
 *      marker or the "most-voted outcome is still adopted" sentence — plus
 *      the honest turnout math (581,973,790 / 29,098,690 / 2.73% / 1.73%).
 *   5. Audit trail: PROPOSAL_APPROVED rows in audit_log for the three ids
 *      once ACTIVE/decided (counts reported; zero on an ACTIVE proposal
 *      means the approval was never audited — fail).
 *   6. --snapshot: recompute Σ floor(√(whole-token balance)) from
 *      data/holders.json and check it against the published denominator
 *      581,973,790 (the number every ballot body quotes).
 *
 * Exits 0 on success, 1 on any failure. Run `npx tsx
 * scripts/verify-referendum.ts [--snapshot]` (npm run verify:referendum)
 * BEFORE any announcement goes out — it must be green first.
 *
 * Env: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (real prod credentials from
 * .env.local — this always touches the database, like verify-election.ts).
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REFERENDUM_KEY = "wave1-2026";

const QUESTIONS = [
  { question: 1, title: "Wave 1 Referendum · Question 1: Global default quorum" },
  { question: 2, title: "Wave 1 Referendum · Question 2: Pass threshold" },
  { question: 3, title: "Wave 1 Referendum · Question 3: Per-type quorum schedule" },
] as const;

const REQUIRED_QUORUM = 5.0;
const REQUIRED_START = "2026-10-02T00:00:00.000Z";
const REQUIRED_END = "2026-11-01T00:00:00.000Z";
/**
 * approve sets voting_starts_at = now, so the start drifts by however far the
 * admin's click lands from the launch moment — a human, not a scheduler. The
 * EXACT close is pinned separately via "Extend window" (REQUIRED_END), so the
 * start only needs to catch gross errors (approved days early/late): ±6h.
 */
const START_TOLERANCE_MS = 6 * 60 * 60 * 1000;

const OPEN_STATES = new Set(["ACTIVE"]);
const DECIDED_STATES = new Set(["PASSED", "FAILED", "EXPIRED", "EXECUTED"]);
const KNOWN_STATES = new Set(["PENDING_REVIEW", ...OPEN_STATES, ...DECIDED_STATES]);

/** The disclosed consensus fallback — marker written by seed-referendum.ts. */
const FALLBACK_MARKER = "consensus-fallback";
const FALLBACK_SENTENCE = "most-voted outcome is still adopted";
/** The turnout math every ballot body must quote verbatim. */
const TURNOUT_NUMBERS = ["581,973,790", "29,098,690", "2.73%", "1.73%"] as const;

const EXPECTED_TOTAL_POWER = 581_973_790;

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
/** Context line that never counts as pass or fail. */
function note(label: string): void {
  console.log(`  ${yellow("→")} ${label}`);
}

interface ReferendumMetadata {
  referendum?: unknown;
  referendumQuestion?: unknown;
}

interface ReferendumRow {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string;
  quorum_required: number;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  metadata: string;
}

/** Σ floor(√(whole-token balance)) — the quadratic power denominator. */
function totalQuadraticPower(holders: Record<string, { balanceRaw?: string }>): number {
  let total = 0;
  for (const holder of Object.values(holders)) {
    const raw = holder?.balanceRaw;
    if (typeof raw !== "string") continue;
    total += Math.floor(Math.sqrt(Number(BigInt(raw) / 10n ** 18n)));
  }
  return total;
}

async function main(): Promise<void> {
  const snapshotOnlyFlag = process.argv.slice(2);
  let checkSnapshot = false;
  for (const arg of snapshotOnlyFlag) {
    if (arg === "--snapshot") checkSnapshot = true;
    else {
      console.log(`Usage: npx tsx scripts/verify-referendum.ts [--snapshot]`);
      process.exit(1);
    }
  }

  console.log("🗳️  OMNOM DAO Wave 1 Referendum verification\n");

  // ── 1. Env presence ─────────────────────────────────────────────
  console.log("Environment:");
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  assert("TURSO_DATABASE_URL is set", Boolean(url));
  assert("TURSO_AUTH_TOKEN is set", Boolean(token));
  if (!url || !token) {
    console.log(`\n${red("Missing required env vars. Aborting.")}`);
    process.exit(1);
  }

  // ── 2. Referendum rows ──────────────────────────────────────────
  console.log("\nDatabase — referendum questions:");
  const db = createClient({ url, authToken: token });

  const ballots: { q: (typeof QUESTIONS)[number]; row: ReferendumRow }[] = [];
  for (const q of QUESTIONS) {
    const res = await db.execute({
      sql: "SELECT * FROM proposals WHERE title = ? LIMIT 1",
      args: [q.title],
    });
    const row = res.rows[0];
    assert(`Q${q.question} row exists ("${q.title}")`, Boolean(row));
    if (!row) {
      console.log(
        `\n${red(`Q${q.question} missing. Run: npm run seed:referendum`)}`,
      );
      process.exit(1);
    }
    ballots.push({ q, row: row as unknown as ReferendumRow });
  }

  // ── 3. Per-question structural checks ───────────────────────────
  console.log("\nBallot structure:");
  for (const { q, row } of ballots) {
    console.log(`  ${yellow("▸")} Q${q.question}: ${row.title}`);

    assert("type = GENERAL", row.type === "GENERAL", `got ${row.type}`);
    assert(
      `quorum_required = ${REQUIRED_QUORUM}`,
      Number(row.quorum_required) === REQUIRED_QUORUM,
      `got ${row.quorum_required}`,
    );

    let meta: ReferendumMetadata | null = null;
    try {
      meta = JSON.parse(row.metadata) as ReferendumMetadata;
    } catch {
      assert("metadata parses as JSON", false, row.metadata.slice(0, 80));
    }
    if (meta) {
      assert(
        `metadata.referendum = "${REFERENDUM_KEY}"`,
        meta.referendum === REFERENDUM_KEY,
        `got ${JSON.stringify(meta.referendum)}`,
      );
      assert(
        `metadata.referendumQuestion = ${q.question}`,
        meta.referendumQuestion === q.question,
        `got ${JSON.stringify(meta.referendumQuestion)}`,
      );
    }
  }

  // ── 4. Statuses (announce-gate context) ─────────────────────────
  console.log("\nStatuses:");
  for (const { q, row } of ballots) {
    const known = typeof row.status === "string" && KNOWN_STATES.has(row.status);
    assert(
      `Q${q.question} status is a valid referendum state`,
      known,
      `got ${row.status}`,
    );
    note(`Q${q.question}: ${row.status}`);

    if (row.status === "PENDING_REVIEW") {
      console.log(
        `  ${yellow("!")} Q${q.question} is still PENDING_REVIEW — approve it at /admin ` +
          `(then extend to ${REQUIRED_END}) before announcements go out.`,
      );
    }
  }

  // ── 5. Voting window (once approved) ────────────────────────────
  console.log("\nVoting window (ACTIVE/decided questions only):");
  const requiredEndMs = Date.parse(REQUIRED_END);
  const requiredStartMs = Date.parse(REQUIRED_START);
  for (const { q, row } of ballots) {
    const opened = OPEN_STATES.has(row.status) || DECIDED_STATES.has(row.status);
    if (!opened) {
      note(`Q${q.question} skipped — no window yet (${row.status}).`);
      continue;
    }

    const endOk =
      typeof row.voting_ends_at === "string" &&
      Date.parse(row.voting_ends_at) === requiredEndMs;
    assert(
      `Q${q.question} voting_ends_at = ${REQUIRED_END} exactly`,
      endOk,
      `got ${row.voting_ends_at ?? "(null)"} — pin it with the /admin "Extend window" control`,
    );

    const startMs =
      typeof row.voting_starts_at === "string"
        ? Date.parse(row.voting_starts_at)
        : Number.NaN;
    const startOk =
      !Number.isNaN(startMs) &&
      Math.abs(startMs - requiredStartMs) <= START_TOLERANCE_MS;
    const driftMin = Number.isNaN(startMs)
      ? "(null)"
      : `${((startMs - requiredStartMs) / 60000).toFixed(1)} min vs target`;
    assert(
      `Q${q.question} voting_starts_at within ±6h of ${REQUIRED_START}`,
      startOk,
      `got ${row.voting_starts_at ?? "(null)"} (${driftMin})`,
    );

    if (endOk && startOk) {
      const days = Math.round(
        (requiredEndMs - startMs) / (24 * 60 * 60 * 1000),
      );
      const now = new Date();
      const phase =
        now.getTime() < startMs
          ? "UPCOMING"
          : now.getTime() <= requiredEndMs
            ? "OPEN"
            : "CLOSED";
      note(
        `Q${q.question}: window ≈ ${days} days, phase ${phase} (${now.toISOString()})`,
      );
    }
  }

  // ── 6. Body disclosures (fallback + turnout math) ────────────────
  console.log("\nBody disclosures:");
  for (const { q, row } of ballots) {
    const body = row.description ?? "";

    const hasMarker = body.includes(FALLBACK_MARKER);
    const hasSentence = body.includes(FALLBACK_SENTENCE);
    assert(
      `Q${q.question} body discloses the consensus fallback`,
      hasMarker || hasSentence,
      `neither "${FALLBACK_MARKER}" nor "${FALLBACK_SENTENCE}" found`,
    );
    note(
      `Q${q.question} fallback via: ${[
        hasMarker ? `"${FALLBACK_MARKER}"` : null,
        hasSentence ? `"${FALLBACK_SENTENCE}"` : null,
      ]
        .filter(Boolean)
        .join(" + ") || "none"}`,
    );

    const missingNumbers = TURNOUT_NUMBERS.filter((n) => !body.includes(n));
    assert(
      `Q${q.question} body quotes the turnout math (${TURNOUT_NUMBERS.join(", ")})`,
      missingNumbers.length === 0,
      missingNumbers.length > 0 ? `missing ${missingNumbers.join(", ")}` : undefined,
    );
  }

  // ── 7. Audit trail (approval events) ────────────────────────────
  console.log("\nAudit trail (PROPOSAL_APPROVED):");
  for (const { q, row } of ballots) {
    const opened = OPEN_STATES.has(row.status) || DECIDED_STATES.has(row.status);
    const auditRes = await db.execute({
      sql:
        "SELECT COUNT(*) AS n FROM audit_log " +
        "WHERE action = 'PROPOSAL_APPROVED' AND target_type = 'proposal' AND target_id = ?",
      args: [row.id],
    });
    const approvals = Number(auditRes.rows[0]?.n ?? 0);
    if (opened) {
      assert(
        `Q${q.question} has ≥1 PROPOSAL_APPROVED audit row (id ${row.id})`,
        approvals >= 1,
        `found ${approvals} — an approval happened but was never audited`,
      );
    } else {
      note(
        `Q${q.question}: ${approvals} PROPOSAL_APPROVED row(s) — expected while ${row.status}`,
      );
    }
  }

  // ── 8. Optional snapshot recompute ──────────────────────────────
  if (checkSnapshot) {
    console.log("\nSnapshot (--snapshot):");
    const holdersPath = resolve(process.cwd(), "data/holders.json");
    const exists = existsSync(holdersPath);
    assert("data/holders.json exists", exists, holdersPath);
    if (exists) {
      const snapshot = JSON.parse(
        readFileSync(holdersPath, "utf-8"),
      ) as { holders?: Record<string, { balanceRaw?: string }> };
      const wallets = Object.keys(snapshot.holders ?? {}).length;
      const total = totalQuadraticPower(snapshot.holders ?? {});
      note(`recomputed Σ√(balance) across ${wallets} wallets = ${total}`);
      assert(
        `total quadratic power = ${EXPECTED_TOTAL_POWER}`,
        total === EXPECTED_TOTAL_POWER,
        `got ${total} — this denominator is quoted in every ballot body`,
      );
    }
  }

  // ── Summary ─────────────────────────────────────────────────────
  const pending = ballots.filter(({ row }) => row.status === "PENDING_REVIEW").length;
  console.log();
  if (failures === 0) {
    if (pending > 0) {
      console.log(
        green(`✅ All checks passed`) +
          yellow(
            ` — but ${pending} question(s) still PENDING_REVIEW. Approve + extend at /admin, ` +
              `then re-run before announcements.`,
          ),
      );
    } else {
      console.log(
        green("✅ All checks passed. Referendum is production-ready — announcements may go out."),
      );
    }
    process.exit(0);
  } else {
    console.log(red(`❌ ${failures} check(s) failed. Do NOT announce until green.`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥 Verification crashed:", err);
  process.exit(1);
});
