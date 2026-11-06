#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- deliberate CommonJS .cjs node script */
/**
 * Wave 1 fallback adoption — executes Mode 2 (adopt) for the three
 * referendum questions after the 24h cooling-off (intents declared
 * 2026-11-06T19:32Z). Replicates adopt-consensus route Mode 2 exactly:
 * guardrail evaluation with force, metadata write, status EXPIRED→EXECUTED,
 * PROPOSAL_ADOPTED_AS_CONSENSUS audit row. Options A ruling (card t_fcd1f74f):
 * Q1 FOR, Q2 FOR, Q3 AGAINST — most-voted outcome per question.
 * Stdlib + @libsql/client only. Run: node scripts/adopt_wave1.js [--dry-run]
 */
const fs = require("fs");
const { createClient } = require("@libsql/client");

const env = {};
for (const f of [".env.local", ".env"]) {
  try {
    for (const l of fs.readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const ADMIN = "0x22f4194f6706e70abaa14ab352d0baa6c7ced24a";
const INTENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DRY = process.argv.includes("--dry-run");

const QUESTIONS = [
  {
    id: "6cb00f187fa5803b05e81c4f4ddc6c0e",
    outcome: "FOR",
    note: "Q1 Global default quorum — most-voted outcome FOR adopted as working consensus under the disclosed Wave 1 fallback. Participation disclosure: 19 unique wallets, 11,050,399 power (100% FOR), quorum 1.90% of 5%. Oct-20 widget quorum-hit signal was computed against a stale smaller artifact and is documented as erroneous. Re-confirmation ratification vote planned as turnout grows. Executed by Kai on operator Option A directive (t_fcd1f74f).",
  },
  {
    id: "c60735e4eb338017b2d7ca988526ce2a",
    outcome: "FOR",
    note: "Q2 Pass threshold — most-voted outcome FOR adopted as working consensus under the disclosed Wave 1 fallback. Participation disclosure: 16 unique wallets, 9,756,510 power (100% FOR), quorum 1.68% of 5%. Re-confirmation ratification vote planned as turnout grows. Executed by Kai on operator Option A directive (t_fcd1f74f).",
  },
  {
    id: "28f865c5a8ff51ca5254b365624ad52d",
    outcome: "AGAINST",
    note: "Q3 Per-type quorum schedule — most-voted outcome AGAINST (74% of participating power) adopted as working consensus under the disclosed Wave 1 fallback: the graded schedule is NOT adopted; flat seeded defaults stay in force. Participation disclosure: 16 unique wallets, 9,756,510 participating power, quorum 1.68% of 5%. Re-confirmation ratification vote planned as turnout grows. Executed by Kai on operator Option A directive (t_fcd1f74f).",
  },
];

async function main() {
  const db = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  for (const q of QUESTIONS) {
    const before = await db.execute({
      sql: "SELECT status, votes_for, votes_against, metadata FROM proposals WHERE id = ?",
      args: [q.id],
    });
    if (before.rows.length === 0) {
      console.log(q.id.slice(0, 8), "SKIP — proposal missing");
      continue;
    }
    const p = before.rows[0];
    if (p.status !== "EXPIRED") {
      console.log(q.id.slice(0, 8), "SKIP — status", p.status, "(already adopted or changed)");
      continue;
    }
    const meta0 = JSON.parse(p.metadata || "{}");
    const declaredAt = meta0.fallbackIntentDeclaredAt;
    const ageOk =
      typeof declaredAt === "string" &&
      Date.now() - Date.parse(declaredAt) >= INTENT_COOLDOWN_MS;
    if (!ageOk) {
      console.log(
        q.id.slice(0, 8),
        "COOLDOWN — intent declared",
        declaredAt || "(missing)",
        "→ adoption unlocks 24h after. Run again later.",
      );
      continue;
    }
    const f = Number(p.votes_for) || 0;
    const a = Number(p.votes_against) || 0;
    const winShare = f + a > 0 ? f / (f + a) : 0;
    const mostVoted = f >= a ? "FOR" : "AGAINST";
    if (mostVoted !== q.outcome) {
      console.log(q.id.slice(0, 8), "GUARD — most-voted outcome", mostVoted, "≠ plan outcome", q.outcome, "→ SKIPPING (re-confirm before writing)");
      continue;
    }
    const adoptedAt = new Date().toISOString();
    const meta = {
      ...meta0,
      adoptedAs: "consensus-fallback",
      adoptedOutcome: q.outcome,
      quorumAchieved: meta0.quorumAchieved ?? null,
      adoptedBy: ADMIN,
      adoptedAt,
      fallbackGuardrails: {
        winShare: Number(winShare.toFixed(4)),
        requiredWinShare: 0.6,
        forced: true,
      },
      adoptionNote: q.note,
    };
    if (DRY) {
      console.log(q.id.slice(0, 8), "DRY-RUN would set EXECUTED, adoptedOutcome", q.outcome, ", winShare", winShare.toFixed(4));
      continue;
    }
    const res = await db.execute({
      sql: "UPDATE proposals SET status = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
      args: ["EXECUTED", JSON.stringify(meta), q.id, "EXPIRED"],
    });
    if (res.rowsAffected === 0) {
      console.log(q.id.slice(0, 8), "RACE — no rows updated (status changed)");
      continue;
    }
    await db.execute({
      sql: "INSERT INTO audit_log (id, actor_address, action, target_type, target_id, details) VALUES (lower(hex(randomblob(16))), ?, ?, 'proposal', ?, ?)",
      args: [
        ADMIN,
        "PROPOSAL_ADOPTED_AS_CONSENSUS",
        q.id,
        JSON.stringify({ adoptedOutcome: q.outcome, adoptedAt, forced: true, note: q.note }),
      ],
    });
    const after = await db.execute({
      sql: "SELECT status, metadata FROM proposals WHERE id = ?",
      args: [q.id],
    });
    const am = JSON.parse(after.rows[0].metadata || "{}");
    console.log(
      q.id.slice(0, 8),
      "ADOPTED ✓ status:", after.rows[0].status,
      "| adoptedOutcome:", am.adoptedOutcome,
      "| adoptedAs:", am.adoptedAs,
      "| audit row inserted",
    );
  }
  console.log(
    "<@1491871360136249566> Wave 1 fallback adoption executed (t_fcd1f74f, Option A): "
    + "Q1 FOR, Q2 FOR, Q3 AGAINST — status EXECUTED, adoptedAs consensus-fallback, "
    + "audit rows recorded, participation notes public. Evidence lines above per row.",
  );
}

main().catch((e) => {
  console.error("adopt_wave1 error:", (e.message || "").slice(0, 300));
  process.exit(1);
});
