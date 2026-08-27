/**
 * OMNOM DAO — Seed Script
 *
 * Seeds:
 *   1. The 6 proposal_templates (one per ProposalType) per DATA-MODEL.md §6.6.
 *   2. The Foundational Governance Election row (governance_election) per
 *      ELECTION-LAUNCH-PLAN.md.
 *
 * Uses UPSERT so the script is idempotent and re-runnable. Safe to run on
 * every deploy.
 *
 * Run: `npm run db:seed` (after `npm run db:migrate`)
 */
import { createClient } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return value;
}

interface TemplateSeed {
  type: string;
  title: string;
  description: string;
  defaultQuorum: number;
  defaultDurationHours: number;
  requiredFields: string[];
}

const TEMPLATES: readonly TemplateSeed[] = [
  {
    type: "CHAIN_SELECTION",
    title: "[Chain Selection] {{chain_name}}",
    description:
      "## Proposed Chain\n\n{{chain_description}}\n\n## Rationale\n\n{{rationale}}\n\n## Risks\n\n{{risks}}",
    defaultQuorum: 15.0,
    defaultDurationHours: 336,
    requiredFields: ["chain_name", "chain_description", "rationale", "risks", "chain_id"],
  },
  {
    type: "TREASURY",
    title: "[Treasury] {{purpose}}",
    description:
      "## Request\n\n{{amount}} tokens to {{recipient}}\n\n## Purpose\n\n{{purpose}}\n\n## Budget Impact\n\n{{budget_impact}}",
    defaultQuorum: 10.0,
    defaultDurationHours: 168,
    requiredFields: ["amount", "recipient", "purpose", "budget_impact"],
  },
  {
    type: "TOKENOMICS_CHANGE",
    title: "[Tokenomics] {{change_type}}",
    description:
      "## Change\n\n{{change_description}}\n\n## Motivation\n\n{{motivation}}\n\n## Expected Impact\n\n{{expected_impact}}",
    defaultQuorum: 15.0,
    defaultDurationHours: 336,
    requiredFields: ["change_type", "change_description", "motivation", "expected_impact"],
  },
  {
    type: "TECHNICAL",
    title: "[Technical] {{feature_name}}",
    description:
      "## Feature / Change\n\n{{specification}}\n\n## Implementation\n\n{{implementation_plan}}",
    defaultQuorum: 10.0,
    defaultDurationHours: 168,
    requiredFields: ["feature_name", "specification", "implementation_plan"],
  },
  {
    type: "GUIDELINE",
    title: "[Guideline] {{guideline_title}}",
    description: "## Proposed Guideline\n\n{{guideline_body}}",
    defaultQuorum: 10.0,
    defaultDurationHours: 168,
    requiredFields: ["guideline_title", "guideline_body"],
  },
  {
    type: "GENERAL",
    title: "[General] {{title}}",
    description: "## Description\n\n{{description}}",
    defaultQuorum: 10.0,
    defaultDurationHours: 168,
    requiredFields: ["title", "description"],
  },
];

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");
  const db = createClient({ url, authToken });

  console.log("🌱 Seeding proposal_templates...");

  const upsertSql = `
    INSERT INTO proposal_templates
      (type, title, description_template, default_quorum, default_duration_hours, required_fields)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(type) DO UPDATE SET
      title = excluded.title,
      description_template = excluded.description_template,
      default_quorum = excluded.default_quorum,
      default_duration_hours = excluded.default_duration_hours,
      required_fields = excluded.required_fields,
      updated_at = datetime('now')
  `;

  for (const t of TEMPLATES) {
    await db.execute({
      sql: upsertSql,
      args: [
        t.type,
        t.title,
        t.description,
        t.defaultQuorum,
        t.defaultDurationHours,
        JSON.stringify(t.requiredFields),
      ],
    });
    console.log(`   ✓ ${t.type}`);
  }

  console.log(`✅ Seeded ${TEMPLATES.length} proposal_templates.`);

  // ── Foundational Governance Election ────────────────────────────────
  // Window: 2026-08-29 00:00:00 UTC → 2026-09-12 00:00:00 UTC (14 days).
  // Ballot semantics: ONE WALLET = ONE VOTE (every eligible wallet casts
  // exactly one ballot, regardless of holdings). See src/lib/election.ts.
  // Snapshot source: DBOT-DC/omnom-snapshot @ 2c38af77 (pinned).
  console.log("🗳️  Seeding foundational governance election...");

  const electionSeed = {
    election_key: "foundational-2026",
    title: "Foundational Governance Election",
    voting_starts_at: "2026-08-29T00:00:00.000Z",
    voting_ends_at: "2026-09-12T00:00:00.000Z",
    snapshot_commit: "2c38af77ba37e67328347cc44bcabbd07551ec42",
    snapshot_file: "omnom-snapshot-ever-held.csv",
    snapshot_file_sha256: "1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128",
    eligible_wallet_count: 25686,
  };

  const electionUpsert = `
    INSERT INTO governance_election
      (election_key, title, voting_starts_at, voting_ends_at,
       snapshot_commit, snapshot_file, snapshot_file_sha256, eligible_wallet_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(election_key) DO UPDATE SET
      title = excluded.title,
      voting_starts_at = excluded.voting_starts_at,
      voting_ends_at = excluded.voting_ends_at,
      snapshot_commit = excluded.snapshot_commit,
      snapshot_file = excluded.snapshot_file,
      snapshot_file_sha256 = excluded.snapshot_file_sha256,
      eligible_wallet_count = excluded.eligible_wallet_count
  `;

  await db.execute({
    sql: electionUpsert,
    args: [
      electionSeed.election_key,
      electionSeed.title,
      electionSeed.voting_starts_at,
      electionSeed.voting_ends_at,
      electionSeed.snapshot_commit,
      electionSeed.snapshot_file,
      electionSeed.snapshot_file_sha256,
      electionSeed.eligible_wallet_count,
    ],
  });
  console.log(`   ✓ ${electionSeed.election_key} (window: ${electionSeed.voting_starts_at} → ${electionSeed.voting_ends_at})`);
  console.log(`✅ Seeded foundational governance election.`);
}

main().catch((err) => {
  console.error("\n💥 Seed failed:", err);
  process.exit(1);
});
