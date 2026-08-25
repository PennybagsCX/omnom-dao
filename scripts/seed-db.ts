/**
 * OMNOM DAO — Seed Script
 *
 * Seeds the 6 proposal_templates (one per ProposalType) per DATA-MODEL.md §6.6.
 * Uses UPSERT so the script is idempotent and re-runnable.
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
}

main().catch((err) => {
  console.error("\n💥 Seed failed:", err);
  process.exit(1);
});
