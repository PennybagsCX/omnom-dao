// Wave-1 turnout timeline audit against production Turso (ESM).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.TURSO_DATABASE_URL;
const token = env.TURSO_AUTH_TOKEN;
if (!url || !token) { console.error("missing turso creds"); process.exit(1); }
console.log("db:", url.split("@")[1] || url);

const db = createClient({ url, authToken: token });

const holders = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data/holders.json"), "utf8"));
const holderMap = holders.holders || holders;
const WEI = 10n ** 18n;
let totalPower = 0n;
for (const v of Object.values(holderMap)) {
  const bal = typeof v === "object" ? BigInt(v.balanceRaw ?? v.balance ?? 0) : BigInt(v);
  totalPower += BigInt(Math.floor(Math.sqrt(Number(bal / WEI))));
}
console.log("totalQuadraticPower (current artifact):", totalPower.toString());

const props = await db.execute({
  sql: "SELECT id, title, status, quorum_required, quorum_achieved, votes_for, votes_against, votes_abstain, voting_starts_at, voting_ends_at, created_at FROM proposals ORDER BY created_at",
  args: [],
});
console.log("\n=== proposals ===");
for (const r of props.rows) console.log(JSON.stringify(r));

const wave = props.rows.filter(r =>
  ["wave", "q1", "q2", "q3", "question"].some(s => String(r.title || "").toLowerCase().includes(s)));
const ids = (wave.length ? wave : props.rows.slice(0, 3)).map(r => r.id);
console.log("\n=== per-proposal votes ===");
for (const id of ids) {
  const v = await db.execute({
    sql: "SELECT COUNT(*) AS n, SUM(voting_power) AS power, MIN(created_at) AS first_vote, MAX(created_at) AS last_vote FROM votes WHERE proposal_id = ?",
    args: [id],
  });
  const r = v.rows[0];
  console.log(id, "| votes:", r.n, "| sumPower:", r.power, "| first:", r.first_vote, "| last:", r.last_vote);
  const at = await db.execute({
    sql: "SELECT COUNT(*) AS n, SUM(voting_power) AS power FROM votes WHERE proposal_id = ? AND created_at <= '2026-10-20T19:53:32'",
    args: [id],
  });
  console.log("   at 2026-10-20T19:53:32Z → votes:", at.rows[0].n, "power:", at.rows[0].power);
}

const uniq = await db.execute({
  sql: `SELECT COUNT(DISTINCT voter) AS u FROM votes WHERE proposal_id IN (${ids.map(() => "?").join(",")})`,
  args: ids,
});
console.log("\nunique voters across ballots:", uniq.rows[0].u);
for (const id of ids) {
  const u = await db.execute({ sql: "SELECT COUNT(DISTINCT voter) AS u FROM votes WHERE proposal_id = ?", args: [id] });
  console.log("  unique voters", id, ":", u.rows[0].u);
}
