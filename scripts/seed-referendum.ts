/**
 * OMNOM DAO — Seed: Wave 1 Referendum (combined, single-window rulebook vote)
 *
 * Replaces the weekly Wave 1 cadence. After Week 1 ("Governance parameter:
 * global default quorum") finalized EXPIRED at 1.73% on 2026-09-30, the
 * remaining Wave 1 decisions now go to vote SIMULTANEOUSLY in one 30-day
 * window (2026-10-02 00:00 UTC → 2026-11-01 00:00 UTC) — one mobilization
 * instead of three weekly asks. Decision record: DOCS/REFERENDUM-WAVE1.md.
 *
 * The three proposals are ordinary GENERAL proposals (FOR/AGAINST/ABSTAIN,
 * quadratic power), NOT a new election system — see the decision record for
 * why. All three carry:
 *   - quorum_required 5.0 (the platform floor is KEPT, not lowered),
 *   - metadata { referendum: "wave1-2026", referendumQuestion: 1|2|3 } — the
 *     grouping key the /vote referendum hub and verify:referendum use,
 *   - bodies rewritten for the referendum: real turnout history (FGE 2.73%,
 *     Week 1 1.73%) and the DISCLOSED CONSENSUS FALLBACK ("if 5% is not
 *     reached, the most-voted outcome is adopted as the community's working
 *     consensus — recorded as quorum-missed and re-confirmed later"), which
 *     supersedes the old "nothing changes on a quorum-fail" language.
 *
 * Idempotent by exact title; inserts run in one libsql batch (transaction).
 * Every proposal is inserted as 'PENDING_REVIEW' authored by the admin wallet
 * (first entry of NEXT_PUBLIC_ADMIN_ADDRESSES) — the human gate at /admin is
 * preserved. NOTE: approving sets voting_ends_at = now + 168h; immediately
 * afterwards use the admin "Extend window" control to pin 2026-11-01T00:00:00.000Z.
 * Also reject the superseded PENDING_REVIEW rows ("Governance parameter: pass
 * threshold…", "Governance parameter: per-type quorum schedule").
 *
 * Run:
 *   npx tsx scripts/seed-referendum.ts            # insert
 *   npx tsx scripts/seed-referendum.ts --dry-run  # print only
 *
 * Env (insert mode only): TURSO_DATABASE_URL, TURSO_AUTH_TOKEN,
 * NEXT_PUBLIC_ADMIN_ADDRESSES. --dry-run requires no env vars and never
 * touches the database.
 */
import { createClient, type InStatement } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return value;
}

/** First admin wallet, parsed exactly like getAdminAddresses() in src/lib/constants.ts. */
function firstAdminAddress(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? "";
  const first = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .find((s) => s.length > 0);
  return first ?? null;
}

interface ReferendumQuestion {
  question: 1 | 2 | 3;
  title: string;
  description: string;
  tags: string[];
  /** quorum_required stored on the row — the platform floor is kept, not lowered. */
  quorum: number;
}

/** Metadata key the /vote hub and verify:referendum group on. */
const REFERENDUM_KEY = "wave1-2026";

const GITHUB = "https://github.com/PennybagsCX/omnom-dao/blob/main";
const GM = `${GITHUB}/DOCS/GOVERNANCE_MECHANICS.md`;
const PRD = `${GITHUB}/PRD.md`;
const RECORD = `${GITHUB}/DOCS/REFERENDUM-WAVE1.md`;

/**
 * Shared turnout framing, embedded in every body. Numbers verified against
 * prod on 2026-10-01: denominator recomputed from data/holders.json
 * (581,973,790 — exact match), Week 1 recompute from the votes table matched
 * the stored quorum_achieved to 4 decimal places.
 */
function turnoutMath(): string {
  return `## The Turnout Math (full transparency)

Real numbers from the pinned snapshot (25,686 ever-held wallets, block 5,992,210):

- **Total voting power:** 581,973,790 — the sum of √(balance) across every wallet ever holding $OMNOM.
- **The 5% bar** (this referendum's quorum floor) = **29,098,690 power ≈ 1,284 average-power wallets voting.**
- **Our track record, honestly:** the Foundational Governance Election — our most-promoted vote — drew **35 voters = 2.73%** (the record). Week 1 of this very rulebook drew **27 voters = 1.73%**, and finalized as quorum-not-met on Sep 30.

Honest read: the 5% bar is ~47× last vote's turnout and ~2× our all-time record. We are keeping the bar anyway — a rulebook ratified at a lower bar would always carry an asterisk. Instead the window is **30 days** (not 7), all three questions vote at once (one campaign, not three), and the promotion push you'll see on X and Telegram is the biggest this DAO has attempted.`;
}

/**
 * The disclosed consensus fallback — present verbatim in EVERY referendum body
 * and every announcement, so nobody can claim it was invented after the fact.
 */
function fallback(): string {
  return `## If We Don't Reach 5%

**The fallback, stated up front:** if this referendum closes below the 5% quorum bar, the **most-voted outcome is still adopted** as the community's working consensus — recorded openly in the proposal record as a quorum-missed decision (\`adoptedAs: consensus-fallback\`, with the final turnout numbers attached), and **re-confirmed in a later ratification vote** once turnout has grown. Your vote counts either way: under quorum it is binding; under the fallback it sets the working consensus. Nothing about this window is decorative.`;
}

const QUESTIONS: readonly ReferendumQuestion[] = [
  {
    question: 1,
    title: "Wave 1 Referendum · Question 1: Global default quorum",
    tags: ["governance", "voting-rules", "referendum"],
    quorum: 5.0,
    description: `## TL;DR

**Question 1 of 3 — one ballot window, three rulebook decisions, 30 days.**

How many people need to vote before a result counts?

- 🟢 **VOTE FOR** to adopt a single **5% global default quorum** — the lowest bar the platform allows, ratified by you.
- 🔴 **VOTE AGAINST** to keep the current per-type defaults (10–15%, set by nobody).

Questions 2 (pass threshold) and 3 (per-type quorum schedule) run in the same window at dao.omnom.dog/vote — each is a separate ballot and stands on its own.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = adopt a **5% global default quorum** for every proposal type. From now on, a result counts when ≥5% of all voting power participates.
- **AGAINST** = keep today's rules: per-type defaults of 10–15% that were never ratified by any vote.
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.

${turnoutMath()}

## Current Baseline (v1)

There is no single global value today. Seeded per-type defaults apply: Chain Selection 15%, Tokenomics Change 15%, Treasury 10%, Technical 10%, Community Guideline 10%, General Discussion 10%. Quorum counts every ballot (abstentions included) against **total quadratic power** — the sum of floor(sqrt(balance)) across the snapshot. The source documents disagreed (schema default 10%, creation-UI floor 5%, PRD recommendation 20%); that disagreement is exactly what this vote settles. The Week 1 attempt at this question closed Sep 30 at 1.73% — this referendum re-runs it with a 30-day window and the fallback disclosed below.

${fallback()}

## What Changes If Adopted

The "default_quorum" values in "proposal_templates" and the create-proposal wizard defaults become 5% for every type. The finalization engine itself is unchanged. Under the consensus fallback, the winning option is adopted as the working consensus and flagged for re-confirmation.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 2](${GM}#14-open-governance-decisions) — "Global default quorum"; conflict in [§8](${GM}#8-quorum--pass-thresholds); decision record: [REFERENDUM-WAVE1.md](${RECORD}).`,
  },
  {
    question: 2,
    title: "Wave 1 Referendum · Question 2: Pass threshold",
    tags: ["governance", "voting-rules", "referendum"],
    quorum: 5.0,
    description: `## TL;DR

**Question 2 of 3 — one ballot window, three rulebook decisions, 30 days.**

How many "yes" votes does it take to win?

- 🟢 **VOTE FOR** to **ratify the current split**: everyday proposals pass on simple majority; chain, tokenomics and technical changes need a 60% supermajority.
- 🔴 **VOTE AGAINST** for simple majority everywhere (no supermajority for anything).

This vote **ratifies rules that until now were never voted on** — a yes makes them officially yours. Questions 1 (quorum) and 3 (per-type schedule) run in the same window at dao.omnom.dog/vote.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = ratify today's split: simple majority (more yes than no) for Treasury, Community Guideline and General Discussion; **≥60% supermajority** of yes/no power for Chain Selection, Tokenomics Change and Technical — the decisions that can reshape the whole project.
- **AGAINST** = abolish the supermajority: every proposal type passes on simple majority.
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.

${turnoutMath()}

## Current Baseline (v1)

Split by type. Simple majority (FOR > AGAINST) for Treasury, Community Guideline and General Discussion; **≥60% supermajority** of (FOR + AGAINST) for Chain Selection, Tokenomics Change and Technical. Abstentions never count toward the outcome — only toward quorum. These defaults shipped with the platform and were never ratified by a vote; that is exactly what this ballot fixes.

${fallback()}

## What Changes If Adopted

Formally ratified thresholds. The finalize engine's supermajority type set stays as-is — this vote turns placeholder defaults into community-ratified rules. Choosing AGAINST removes Chain Selection, Tokenomics Change and Technical from that set. Under the consensus fallback, the winning option is adopted as the working consensus and flagged for re-confirmation.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 3](${GM}#14-open-governance-decisions) — "Global pass threshold"; per-type table in [§5](${GM}#5-proposal-types--thresholds), math in [§8](${GM}#8-quorum--pass-thresholds); decision record: [REFERENDUM-WAVE1.md](${RECORD}).`,
  },
  {
    question: 3,
    title: "Wave 1 Referendum · Question 3: Per-type quorum schedule",
    tags: ["governance", "voting-rules", "referendum"],
    quorum: 5.0,
    description: `## TL;DR

**Question 3 of 3 — one ballot window, three rulebook decisions, 30 days.**

Should bigger decisions need more voters than small ones?

- 🟢 **VOTE FOR** to adopt a **graded turnout bar**: General Discussion proposals 5% · standard proposals (Treasury, Guideline, Technical) 10% · chain & tokenomics 25%.
- 🔴 **VOTE AGAINST** to keep today's flat 10–15% defaults for every type.

Questions 1 (global quorum) and 2 (pass threshold) run in the same window at dao.omnom.dog/vote — each ballot stands on its own; if Question 1 adopted the 5% global default, this schedule becomes its per-type refinement.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = adopt the graded schedule: **General Discussion 5% · Treasury, Community Guideline, Technical 10% · Chain Selection, Tokenomics Change 25%.** ("General Discussion" = formal proposals about community matters rather than money or code.) Everyday proposals stay easy; the decisions that could reshape the project need the deepest participation.
- **AGAINST** = keep the flat seeded defaults (10–15% for every type).
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.

${turnoutMath()}

Under the graded schedule, the General Discussion bar (5%) ≈ 1,284 average wallets, the 10% standard bar ≈ 2,569, and the 25% chain/tokenomics bar ≈ 6,421 — a deliberate statement: the biggest calls wait for the deepest participation.

## Current Baseline (v1)

Seeded defaults: Chain Selection 15%, Tokenomics Change 15%, Treasury 10%, Technical 10%, Community Guideline 10%, General Discussion 10% (default voting window 7 days; 14 days for Chain Selection and Tokenomics Change). A proposer may override quorum at creation within a 5–50% floor.

${fallback()}

## What Changes If Adopted

"default_quorum" on the seeded "proposal_templates" and the per-type defaults in the create wizard become the graded schedule. Already-active proposals keep their locked quorum. Under the consensus fallback, the winning option is adopted as the working consensus and flagged for re-confirmation.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 5](${GM}#14-open-governance-decisions) — "Per-type quorums"; [PRD §9 schedule](${PRD}), seeded defaults [§8.3](${GM}#83-v1-seeded-defaults-data-modelmd); decision record: [REFERENDUM-WAVE1.md](${RECORD}).`,
  },
];

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/seed-referendum.ts [--dry-run]

  Seeds the Wave 1 Referendum: 3 GENERAL proposals (PENDING_REVIEW, quorum 5%),
  one per rulebook question, metadata-tagged referendum=${REFERENDUM_KEY}.

  --dry-run   Print everything that would be inserted. Makes no database
              connection and requires no environment variables.`);
}

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs | null {
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else return null; // unknown flag — show usage
  }
  return { dryRun };
}

function printQuestion(q: ReferendumQuestion, author: string, status: string): void {
  console.log("─".repeat(72));
  console.log(`Question   : #${q.question}`);
  console.log(`Title      : ${q.title}`);
  console.log("Type       : GENERAL");
  console.log(`Status     : ${status}`);
  console.log(`Author     : ${author}`);
  console.log(`Quorum     : ${q.quorum}% of total quadratic power`);
  console.log(
    `Tags       : ${JSON.stringify({
      type: "base",
      links: [],
      tags: q.tags,
      referendum: REFERENDUM_KEY,
      referendumQuestion: q.question,
    })}`,
  );
  console.log("Description:");
  console.log(q.description);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exit(1);
  }

  const author = firstAdminAddress() ?? "(NEXT_PUBLIC_ADMIN_ADDRESSES not set)";

  // ── Dry run: print and exit. No env vars, no database. ──────────────
  if (args.dryRun) {
    console.log(
      `DRY RUN — Wave 1 Referendum: would insert ${QUESTIONS.length} GENERAL proposal(s) ` +
        `as status 'PENDING_REVIEW'. No database connection was made.\n`,
    );
    for (const q of QUESTIONS) {
      printQuestion(q, author, "PENDING_REVIEW");
    }
    console.log("─".repeat(72));
    console.log(`DRY RUN complete — ${QUESTIONS.length} proposal(s) printed, nothing written.`);
    return;
  }

  // ── Insert mode ─────────────────────────────────────────────────────
  const adminAddress = firstAdminAddress();
  if (!adminAddress) {
    console.error(
      "\n❌ Missing required env var: NEXT_PUBLIC_ADMIN_ADDRESSES " +
        "(comma-separated admin wallets; the first entry authors the drafts)\n",
    );
    process.exit(1);
  }
  const db = createClient({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: requireEnv("TURSO_AUTH_TOKEN"),
  });

  console.log(`🌱 Seeding Wave 1 Referendum (${QUESTIONS.length} questions, one 30-day window)...`);

  // Idempotency: skip any proposal whose exact title already exists.
  const toInsert: ReferendumQuestion[] = [];
  for (const q of QUESTIONS) {
    const seen = await db.execute({
      sql: "SELECT 1 FROM proposals WHERE title = ? LIMIT 1",
      args: [q.title],
    });
    if (seen.rows.length > 0) {
      console.log(`   ↷ skip (already seeded): ${q.title}`);
    } else {
      toInsert.push(q);
    }
  }

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert — every referendum question already exists.");
    return;
  }

  // One batch = one transaction. The author needs a users row to satisfy the
  // proposals.author_address foreign key.
  const stmts: InStatement[] = [
    {
      sql: "INSERT INTO users (wallet_address) VALUES (?) ON CONFLICT(wallet_address) DO NOTHING",
      args: [adminAddress],
    },
  ];
  for (const q of toInsert) {
    stmts.push({
      sql:
        "INSERT INTO proposals (title, description, type, status, author_address, quorum_required, metadata) " +
        "VALUES (?, ?, 'GENERAL', ?, ?, ?, ?)",
      args: [
        q.title,
        q.description,
        "PENDING_REVIEW",
        adminAddress,
        q.quorum,
        JSON.stringify({
          type: "base",
          links: [],
          tags: q.tags,
          referendum: REFERENDUM_KEY,
          referendumQuestion: q.question,
        }),
      ],
    });
  }

  await db.batch(stmts, "write");

  for (const q of toInsert) {
    console.log(`   ✓ PENDING_REVIEW Q${q.question}: ${q.title}`);
  }
  console.log(
    `✅ Seeded ${toInsert.length} referendum proposal(s). Launch sequence:\n` +
      `   1. Approve all three at /admin (approve sets voting_ends_at = now + 168h).\n` +
      `   2. Immediately use "Extend window" on each to pin 2026-11-01T00:00:00.000Z.\n` +
      `   3. Reject the superseded rows: "Governance parameter: pass threshold… (simple majority vs supermajority"` +
      ` and "Governance parameter: per-type quorum schedule".\n` +
      `   4. npm run verify:referendum must be green before announcements go out.`,
  );
}

main().catch((err) => {
  console.error("\n💥 Seed failed:", err);
  process.exit(1);
});
