/**
 * Migration: pin the quorum denominator per voting window (card t_fcd1f74f).
 *
 * Two new proposals columns:
 *   snapshot_hash          — SHA-256 of data/holders.json at vote open
 *   total_quadratic_power  — Σ quadratic power of that artifact at vote open
 *
 * finalizeProposal() must use the pinned value instead of re-reading the
 * artifact, so an artifact regeneration mid-window can never retroactively
 * move a vote's quorum bar (the Wave 1 incident: ~215M at open vs 582M at
 * finalize). Legacy rows keep NULL and fall back to live compute + a flag.
 *
 * Idempotent: checks PRAGMA table_info before ALTERing.
 * Run: npx tsx scripts/migrate-pin-snapshot-denominator.ts
 */
import { db } from "@/lib/db";

async function columnExists(name: string): Promise<boolean> {
  const res = await db.execute("PRAGMA table_info(proposals)");
  return res.rows.some((r) => r.name === name);
}

async function main() {
  for (const [name, type] of [
    ["snapshot_hash", "TEXT"],
    ["total_quadratic_power", "REAL"],
  ] as const) {
    if (await columnExists(name)) {
      console.log(`[migrate] ${name} already present — skip`);
      continue;
    }
    await db.execute(`ALTER TABLE proposals ADD COLUMN ${name} ${type}`);
    console.log(`[migrate] added ${name} ${type}`);
  }
  const res = await db.execute("PRAGMA table_info(proposals)");
  const cols = res.rows.map((r) => r.name);
  console.log("[migrate] proposals columns now include:",
    ["snapshot_hash", "total_quadratic_power"].map((c) => `${c}=${cols.includes(c)}`).join(" "));
}

main().catch((e) => {
  console.error("[migrate] failed:", e?.message ?? e);
  process.exit(1);
});
