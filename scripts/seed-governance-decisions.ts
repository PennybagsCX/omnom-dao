/**
 * OMNOM DAO — Seed: open governance decisions as community-vote proposals
 *
 * Turns the unresolved governance parameters in DOCS/GOVERNANCE_MECHANICS.md
 * §14 ("Open Governance Decisions") into GENERAL proposals, grouped in three
 * themed waves:
 *
 *   Wave 1 — Voting rules        (§14 #2 global quorum, #3 pass threshold, #5 per-type quorums)
 *   Wave 2 — Process & access    (§14 #4 pending-review, #6 creation gate, #10 emergency type)
 *   Wave 3 — Holder protections  (§14 #7 veto/cooling-off, #8 snapshot disputes,
 *                                 #9 multi-wallet aggregation, #11 whale transparency)
 *
 * §14 #1 (voting math) is SETTLED — the Foundational Governance Election
 * (2026-09-12) chose quadratic voting — and §14 #12 (governance vs. snapshot
 * token) is deferred to the tokenomics arc (TOKENOMICS-OPTIONS.md). Neither is
 * seeded here.
 *
 * Every proposal is inserted as 'PENDING_REVIEW' authored by the admin
 * wallet (first entry of NEXT_PUBLIC_ADMIN_ADDRESSES), so the human gate is
 * preserved: an admin reviews and approves through the existing UI. All
 * waves seed as PENDING_REVIEW — there is no DRAFT→PENDING_REVIEW submit
 * transition in the platform, so a seeded DRAFT could never be submitted
 * (and would be invisible to the public list). Staggered cadence: the admin
 * approves ONE Wave 1 item per week; later-wave items wait in the queue.
 *
 * The baseline values quoted in the descriptions were read from the code, not
 * the docs: TYPE_DEFAULTS (create wizard), proposal_templates seed,
 * proposal-finalize.ts (SUPERMAJORITY_TYPES), PROPOSAL_TYPE_CONFIG
 * (minHolderClass) and voting-power.ts (quorum denominator).
 *
 * Idempotent: a proposal whose exact title already exists is skipped. The
 * wave's inserts run in one libsql batch (single transaction).
 *
 * Run:
 *   npx tsx scripts/seed-governance-decisions.ts --wave 1            # insert
 *   npx tsx scripts/seed-governance-decisions.ts --wave 1 --dry-run  # print only
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

/**
 * First admin wallet, parsed exactly like getAdminAddresses() in
 * src/lib/constants.ts (comma-separated, trimmed, lowercased).
 */
function firstAdminAddress(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? "";
  const first = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .find((s) => s.length > 0);
  return first ?? null;
}

/** One governance decision seeded as a single GENERAL proposal. */
interface DecisionSeed {
  /** §14 row number, for the Reference section and idempotency notes. */
  ref: number;
  title: string;
  description: string;
  tags: string[];
  /** quorum_required stored on the row — 5% floor for Wave 1, GENERAL v1 default (10%) otherwise. */
  quorum: number;
}

interface Wave {
  wave: 1 | 2 | 3;
  theme: string;
  /** Status the wave's rows are inserted with. */
  seedStatus: "DRAFT" | "PENDING_REVIEW";
  decisions: readonly DecisionSeed[];
}

/**
 * v1 GENERAL rules (verified in code): 10% quorum of total quadratic power,
 * simple majority, 168h default window. Waves 2–3 rows use the GENERAL
 * defaults so admin submission via the UI needs no overrides.
 */
const GENERAL_V1_QUORUM = 10.0;

/**
 * Wave 1 — the convention vote that settles the rulebook itself — is seeded
 * at the platform's 5% quorum floor instead. The v1 10% default was never
 * ratified by any vote (it shipped as an engineering placeholder), and at
 * current turnout it is unreachable; a rulebook vote no turnout could
 * legitimize would settle nothing. Each Wave 1 proposal body discloses the
 * 5% container explicitly, and a quorum-fail leaves the v1 rules in force.
 */
const WAVE1_QUORUM = 5.0;

/**
 * Public repo base for the reference links embedded in proposal bodies (the
 * repo is public, so every voter can follow them).
 */
const GITHUB = "https://github.com/PennybagsCX/omnom-dao/blob/main";
const GM = `${GITHUB}/DOCS/GOVERNANCE_MECHANICS.md`;
const PRD = `${GITHUB}/PRD.md`;

const WAVES: readonly Wave[] = [
  {
    wave: 1,
    theme: "Voting rules",
    seedStatus: "PENDING_REVIEW",
    decisions: [
      {
        ref: 2,
        title: "Governance parameter: global default quorum",
        tags: ["governance", "voting-rules"],
        quorum: WAVE1_QUORUM,
        description: `## TL;DR

**One question: how many people need to vote before a result counts?**

- 🟢 **VOTE FOR** to adopt a single **5% global default quorum** — the lowest bar the platform allows, ratified by you.
- 🔴 **VOTE AGAINST** to keep the current per-type defaults (10–15%, set by nobody).

Everything below is the full analysis, including the real turnout math.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = adopt a **5% global default quorum** for every proposal type. From now on, a result counts when ≥5% of all voting power participates.
- **AGAINST** = keep today's rules: per-type defaults of 10–15% that were never ratified by any vote.
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.
- Whichever way you lean: a result only counts at all if the 5% turnout bar is met — see the math below.

## The Turnout Math (full transparency)

Real numbers from the pinned snapshot (25,686 ever-held wallets, block 5,992,210):

- **Total voting power:** 581,973,790 — the sum of √(balance) across every wallet ever holding $OMNOM.
- **The 5% bar** (this vote's own quorum floor) = **29,098,690 power ≈ 1,284 average-power wallets voting.**
- The old 10% default ≈ 2,569 average-power wallets. The PRD's 20% ≈ 5,137.
- **Peak turnout ever:** the Foundational Governance Election — our most-promoted vote — reached **15,865,230 power = 2.73% of total**, from 35 voters.

Honest read: the 5% bar is roughly **2× the best turnout this community has ever produced**. The old 10% default was ~3.7× peak. That is why this convention vote runs at the platform floor (5%) instead of the never-ratified 10% default: a rulebook vote no realistic turnout could legitimize would settle nothing. **If this vote fails to reach quorum, nothing changes — the current rules stay in force.**

## Current Baseline (v1)

There is no single global value today. Seeded per-type defaults apply: Chain Selection 15%, Tokenomics Change 15%, Treasury 10%, Technical 10%, Community Guideline 10%, General Discussion 10%. Quorum counts every ballot (abstentions included) against **total quadratic power** — the sum of floor(sqrt(balance)) across the snapshot. The source documents disagreed (schema default 10%, creation-UI floor 5%, PRD recommendation 20%); that disagreement is exactly what this vote settles.

## Options Considered

- **5% global** (recommended — VOTE FOR) — lowest friction, easiest legitimacy; risk: a small early electorate decides for everyone.
- **Keep the per-type 10–15% band** (AGAINST) — the status quo; risk: never ratified, and at measured turnout it can never be met.
- **20% global** (PRD recommendation, dropped from this ballot) — strongest mandate; at 2.73% peak turnout it is unreachable for years. Anyone may propose it later once participation grows.

## What Changes If Adopted

The "default_quorum" values in "proposal_templates" and the create-proposal wizard defaults become 5% for every type. The finalization engine itself is unchanged.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 2](${GM}#14-open-governance-decisions) — "Global default quorum"; conflict documented in [§8](${GM}#8-quorum--pass-thresholds).`,
      },
      {
        ref: 3,
        title: "Governance parameter: pass threshold (simple majority vs supermajority)",
        tags: ["governance", "voting-rules"],
        quorum: WAVE1_QUORUM,
        description: `## TL;DR

**One question: how many "yes" votes does it take to win?**

- 🟢 **VOTE FOR** to **ratify the current split**: everyday proposals pass on simple majority; chain, tokenomics and technical changes need a 60% supermajority.
- 🔴 **VOTE AGAINST** for simple majority everywhere (no supermajority for anything).

This vote **ratifies rules that until now were never voted on** — a yes makes them officially yours. Full analysis below.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = ratify today's split: simple majority (more yes than no) for Treasury, Community Guideline and General Discussion; **≥60% supermajority** of yes/no power for Chain Selection, Tokenomics Change and Technical — the decisions that can reshape the whole project.
- **AGAINST** = abolish the supermajority: every proposal type passes on simple majority.
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.

## The Turnout Math (full transparency)

Real numbers from the pinned snapshot (25,686 ever-held wallets, block 5,992,210):

- **Total voting power:** 581,973,790 — the sum of √(balance) across every wallet ever holding $OMNOM.
- **The 5% bar** (this vote's own quorum floor) = **29,098,690 power ≈ 1,284 average-power wallets voting.**
- The old 10% default ≈ 2,569 average-power wallets.
- **Peak turnout ever:** the Foundational Governance Election reached **15,865,230 power = 2.73% of total**, from 35 voters.

Honest read: the 5% bar is roughly **2× the best turnout this community has ever produced**. That is why this convention vote runs at the platform floor (5%) instead of the never-ratified 10% default: a rulebook vote no realistic turnout could legitimize would settle nothing. **If this vote fails to reach quorum, nothing changes — the current rules stay in force.**

## Current Baseline (v1)

Split by type. Simple majority (FOR > AGAINST) for Treasury, Community Guideline and General Discussion; **≥60% supermajority** of (FOR + AGAINST) for Chain Selection, Tokenomics Change and Technical. Abstentions never count toward the outcome — only toward quorum. These defaults shipped with the platform and were never ratified by a vote; that is exactly what this ballot fixes.

## Options Considered

- **Ratify the current split** (recommended — VOTE FOR) — big decisions stay harder to pass; everyday ones stay easy.
- **Simple majority for all** (AGAINST) — maximizes throughput; high-impact decisions become materially easier to pass.
- **60% supermajority for all** (dropped from this ballot) — maximizes consensus but makes every proposal harder at exactly the time turnout is the binding constraint. Anyone may propose it later.

## What Changes If Adopted

Formally ratified thresholds. The finalize engine's supermajority type set stays as-is — this vote turns placeholder defaults into community-ratified rules. Choosing AGAINST removes Chain Selection, Tokenomics Change and Technical from that set.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 3](${GM}#14-open-governance-decisions) — "Global pass threshold"; per-type table in [§5](${GM}#5-proposal-types--thresholds), math in [§8](${GM}#8-quorum--pass-thresholds).`,
      },
      {
        ref: 5,
        title: "Governance parameter: per-type quorum schedule",
        tags: ["governance", "voting-rules"],
        quorum: WAVE1_QUORUM,
        description: `## TL;DR

**One question: should bigger decisions need more voters than small ones?**

- 🟢 **VOTE FOR** to adopt a **graded turnout bar**: General Discussion proposals 5% · standard proposals (Treasury, Guideline, Technical) 10% · chain & tokenomics 25%.
- 🔴 **VOTE AGAINST** to keep today's flat 10–15% defaults for every type.

This is week 3 of the rulebook: it builds on the turnout default set in week 1 and the win condition set in week 2. Full analysis below.

## How To Vote

The ballot is FOR / AGAINST / ABSTAIN:

- **FOR** = adopt the graded schedule: **General Discussion 5% · Treasury, Community Guideline, Technical 10% · Chain Selection, Tokenomics Change 25%.** ("General Discussion" = formal proposals about community matters rather than money or code — e.g. a community event or program.) Everyday proposals stay easy; the decisions that could reshape the project need the deepest participation.
- **AGAINST** = keep the flat seeded defaults (10–15% for every type).
- **ABSTAIN** counts toward turnout (quorum) but not toward the outcome.
- Interplay: if week 1 adopted the 5% global default, this schedule becomes the per-type refinement of it; if week 1 failed, this vote still decides the schedule on its own.

## The Turnout Math (full transparency)

Real numbers from the pinned snapshot (25,686 ever-held wallets, block 5,992,210):

- **Total voting power:** 581,973,790 — the sum of √(balance) across every wallet ever holding $OMNOM.
- **The 5% bar** (this vote's own quorum floor) = **29,098,690 power ≈ 1,284 average-power wallets voting.**
- Under the graded schedule, the General Discussion bar (5%) ≈ 1,284 average wallets, the 10% standard bar ≈ 2,569, and the 25% chain/tokenomics bar ≈ 6,421.
- **Peak turnout ever:** the Foundational Governance Election reached **15,865,230 power = 2.73% of total**, from 35 voters.

Honest read: the 5% bar is roughly **2× the best turnout this community has ever produced**, and the 25% bar for chain-level decisions is a deliberate statement: the biggest calls wait for the deepest participation. That is why this convention vote runs at the platform floor (5%) instead of the never-ratified 10% default. **If this vote fails to reach quorum, nothing changes — the current rules stay in force.**

## Current Baseline (v1)

Seeded defaults: Chain Selection 15%, Tokenomics Change 15%, Treasury 10%, Technical 10%, Community Guideline 10%, General Discussion 10% (default voting window 7 days; 14 days for Chain Selection and Tokenomics Change). A proposer may override quorum at creation within a 5–50% floor.

## Options Considered

- **Adopt the graded schedule** (recommended — VOTE FOR): 5% / 10% / 25% by weight of the decision.
- **Keep seeded 10–15% flat** (AGAINST) — the status quo; never ratified.
- **PRD §9 variant** (considered) — Chain Selection 25%, Tokenomics Change 25%, Treasury 15%, Community Guideline 10%, Technical 15%, General Discussion 5%; the recommended schedule above is a lightly flattened version of it.
- **Hybrid** — community-amended schedule proposed during discussion; amend via comments and a follow-up vote.

## What Changes If Adopted

"default_quorum" on the seeded "proposal_templates" and the per-type defaults in the create wizard become the graded schedule. Already-active proposals keep their locked quorum.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 5](${GM}#14-open-governance-decisions) — "Per-type quorums"; [PRD §9 schedule](${PRD}), seeded defaults [§8.3](${GM}#83-v1-seeded-defaults-data-modelmd).`,
      },
    ],
  },
  {
    wave: 2,
    theme: "Process & access",
    seedStatus: "PENDING_REVIEW",
    decisions: [
      {
        ref: 4,
        title: "Governance parameter: pending-review duration",
        tags: ["governance", "process"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

How long may a submitted proposal sit in **Pending Review** before something automatic happens — 24-hour auto-approve, or a 7-day maximum with auto-reject if unreviewed?

## Current Baseline (v1)

No automatic timer. Submitted proposals wait in Pending Review until an admin or moderator acts; neither the 24h auto-approve path (DESIGN.md §4.3) nor the max-7-days auto-reject rule (PRD FR-6) is implemented. The duration was left as a configurable parameter pending exactly this vote.

## Options

- **24h auto-approve** — keeps the pipeline moving; risk: spam slips through unreviewed.
- **Max 7 days, auto-reject if unreviewed** (PRD FR-6) — bounded wait; risk: good proposals die by moderator neglect.
- **Keep fully manual review** (status quo) — human judgment on everything; risk: unbounded queue times.

## What Changes If Adopted

A scheduled sweep that transitions aged PENDING_REVIEW proposals, plus an SLA indicator in the moderation queue. Status quo adds nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 4](${GM}#14-open-governance-decisions) — "Pending Review duration"; conflict documented in [§6.2](${GM}#62-editing--transition-rules).`,
      },
      {
        ref: 6,
        title: "Governance parameter: minimum holding to create proposals",
        tags: ["governance", "process"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

Who may create proposals — keep the current tiering (Shark+ for high-impact types, any verified holder for the rest), open everything to any verified holder, or let anyone create high-impact proposals subject to priority review?

## Current Baseline (v1)

Chain Selection, Tokenomics Change and Technical require **Shark tier or above**; Treasury, Community Guideline and General Discussion are open to **any verified holder** (lowest tier). The gate is enforced server-side at creation, not just in the UI.

## Options

- **Keep current tiering** (status quo) — high-impact proposals need economic skin in the game.
- **Any verified holder for all types** — most open; the spam load moves to review instead of the creation gate.
- **Any verified + priority review** — anyone may create high-impact proposals, but those enter a prioritized review queue.

## What Changes If Adopted

The per-type minimum-holder-class configuration (server gate and creation-UI copy). Status quo changes nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 6](${GM}#14-open-governance-decisions) — "Min holding to create proposals"; tier table in [§5](${GM}#5-proposal-types--thresholds).`,
      },
      {
        ref: 10,
        title: "Governance parameter: emergency proposal type",
        tags: ["governance", "process"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

Add an **"Emergency" proposal type** — e.g. 24-hour voting window, 35% quorum, triggerable by a multi-whale coalition or moderators — or affirm that no emergency track exists?

## Current Baseline (v1)

None. Exactly six proposal types exist, enforced by a database constraint on the proposals table. Per-type minimum voting windows are 3 days (Treasury, Community Guideline, Technical, General) and 7 days (Chain Selection, Tokenomics Change) — there is no fast lane.

## Options

- **Keep none** (status quo) — urgent matters run through normal proposals at normal speed.
- **Add the emergency type as specced** — 24h voting, 35% quorum, multi-whale/moderator trigger.
- **Add an emergency track, parameters later** — agree the track exists now; settle its numbers in a follow-up vote.

## What Changes If Adopted

A schema migration extending the allowed proposal types, new type configuration, and cron handling for 24-hour windows. Status quo changes nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 10](${GM}#14-open-governance-decisions) — "Emergency proposals"; [PRD open question Q10](${PRD}).`,
      },
    ],
  },
  {
    wave: 3,
    theme: "Holder protections",
    seedStatus: "PENDING_REVIEW",
    decisions: [
      {
        ref: 7,
        title: "Governance parameter: 30% holder veto and cooling-off",
        tags: ["governance", "holder-protections"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

Adopt the PRD-recommended safeguard — a proposal that draws AGAINST votes from **30% of unique holders** enters a **7-day cooling-off period** before it can be resubmitted — or defer it.

## Current Baseline (v1)

Not enforced. No veto or cooling-off logic exists anywhere in the platform today; a failed proposal can be revised and resubmitted immediately.

## Options

- **Adopt as recommended** — 30% unique-holder AGAINST triggers a 7-day cooling-off before resubmission.
- **Defer** — revisit in a later governance wave once voting patterns are known.
- **Adopt a modified variant** — amend the threshold or duration here, or in a follow-up vote.

## What Changes If Adopted

Vote accounting gains a unique-AGAINST-holder counter and resubmission gating (interacting with the duplicate-title spam check). Deferring changes nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 7](${GM}#14-open-governance-decisions) — "30% unique-holder veto / cooling-off"; anti-whale measures in [§10.1](${GM}#101-anti-whale-measures-prd-recommendations).`,
      },
      {
        ref: 8,
        title: "Governance parameter: snapshot dispute resolution",
        tags: ["governance", "holder-protections"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

How should disputes about the governance **snapshot** be resolved — trust the pinned snapshot, run a formal dispute process, or allow community override votes?

## Current Baseline (v1)

Trust the snapshot. Balances are frozen at a pinned block and published for independent verification, and voting power derives from that frozen record — but there is no dispute mechanism of any kind.

## Options

- **Keep trust-the-snapshot** (status quo) — simplest; a wrong snapshot would be everyone's problem.
- **Formal dispute process** — defined challenge window, evidence requirements, admin adjudication.
- **Community-override path** — a vote can amend snapshot-derived eligibility in defined cases.

## What Changes If Adopted

A dispute intake process and possibly a public verification surface. Status quo adds nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 8](${GM}#14-open-governance-decisions) — "Snapshot dispute resolution"; [PRD open question Q4](${PRD}).`,
      },
      {
        ref: 9,
        title: "Governance parameter: multi-wallet aggregation",
        tags: ["governance", "holder-protections"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

Should one person be allowed to **aggregate many wallets'** voting power — and if so, is there a cap, and what abuse prevention applies?

## Current Baseline (v1)

Aggregation is allowed and uncapped: every wallet signs in and votes independently, with one ballot per wallet per proposal; delegated power adds on top under the delegation rules. There is no identity linkage and no per-person cap.

## Options

- **Keep uncapped aggregation** (status quo) — permissionless; a determined actor can multiply presence.
- **Cap wallets per user** — requires linking identities, which creates a new privacy surface.
- **Keep uncapped + anti-abuse monitoring** — no hard cap, but aggregated voting patterns are watched and disclosed.

## What Changes If Adopted

Vote accounting changes and possibly a new identity-linkage layer. Status quo changes nothing.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 9](${GM}#14-open-governance-decisions) — "Multi-wallet aggregation"; [PRD open question Q5](${PRD}).`,
      },
      {
        ref: 11,
        title: "Governance parameter: whale vote transparency",
        tags: ["governance", "holder-protections"],
        quorum: GENERAL_V1_QUORUM,
        description: `## The Decision

How visible should large holders' ballots be — **forced public**, **opt-out with a public notice**, or a **full privacy toggle** for everyone?

## Current Baseline (v1)

Aggregate tallies only. Live totals (FOR / AGAINST / ABSTAIN) are public on every proposal, but individual ballots — whale or not — are not published on any public surface in v1. The governance docs anticipated a "public-by-default with privacy toggle" model; this vote decides what actually ships.

## Options

- **Force whale votes public** above a holder-class threshold — maximum accountability; may push whales to abstain or delegate.
- **Opt-out with notification** — a whale may hide the ballot, but "a whale-class holder voted" is still announced.
- **Full privacy toggle** — every voter can hide their ballot; aggregate tallies stay public.

## What Changes If Adopted

Ballot-visibility rules and possibly a new public ballots feed. Status quo stays aggregate-only.

## Reference

[GOVERNANCE_MECHANICS.md §14, row 11](${GM}#14-open-governance-decisions) — "Whale vote transparency"; [PRD open question Q8](${PRD}).`,
      },
    ],
  },
];

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/seed-governance-decisions.ts --wave <1|2|3> [--dry-run]

  --wave 1    Voting rules        (GOVERNANCE_MECHANICS §14 #2, #3, #5)
  --wave 2    Process & access    (§14 #4, #6, #10)
  --wave 3    Holder protections  (§14 #7, #8, #9, #11)

  --dry-run   Print everything that would be inserted. Makes no database
              connection and requires no environment variables.`);
}

interface CliArgs {
  wave: 1 | 2 | 3;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs | null {
  let wave: number | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wave") {
      wave = Number(argv[i + 1]);
      i++;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      return null; // unknown flag — show usage
    }
  }

  if (wave === null || !Number.isInteger(wave) || wave < 1 || wave > 3) {
    return null;
  }
  return { wave: wave as 1 | 2 | 3, dryRun };
}

function printDecision(d: DecisionSeed, author: string, status: string): void {
  console.log("─".repeat(72));
  console.log(`§14 row    : #${d.ref}`);
  console.log(`Title      : ${d.title}`);
  console.log("Type       : GENERAL");
  console.log(`Status     : ${status}`);
  console.log(`Author     : ${author}`);
  console.log(`Quorum     : ${d.quorum}% of total quadratic power`);
  console.log(`Tags       : ${JSON.stringify({ type: "base", links: [], tags: d.tags })}`);
  console.log("Description:");
  console.log(d.description);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    printUsage();
    process.exit(1);
  }

  const wave = WAVES.find((w) => w.wave === args.wave);
  if (!wave) {
    printUsage();
    process.exit(1);
  }

  const author = firstAdminAddress() ?? "(NEXT_PUBLIC_ADMIN_ADDRESSES not set)";

  // ── Dry run: print and exit. No env vars, no database. ──────────────
  if (args.dryRun) {
    console.log(
      `DRY RUN — wave ${wave.wave} (${wave.theme}): would insert ` +
        `${wave.decisions.length} GENERAL proposal(s) as status '${wave.seedStatus}'. ` +
        `No database connection was made.\n`,
    );
    for (const d of wave.decisions) {
      printDecision(d, author, wave.seedStatus);
    }
    console.log("─".repeat(72));
    console.log(`DRY RUN complete — ${wave.decisions.length} proposal(s) printed, nothing written.`);
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

  console.log(`🌱 Seeding governance decisions — wave ${wave.wave} (${wave.theme})...`);

  // Idempotency: skip any proposal whose exact title already exists.
  const toInsert: DecisionSeed[] = [];
  for (const d of wave.decisions) {
    const seen = await db.execute({
      sql: "SELECT 1 FROM proposals WHERE title = ? LIMIT 1",
      args: [d.title],
    });
    if (seen.rows.length > 0) {
      console.log(`   ↷ skip (already seeded): ${d.title}`);
    } else {
      toInsert.push(d);
    }
  }

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert — every proposal in this wave already exists.");
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
  for (const d of toInsert) {
    stmts.push({
      sql:
        "INSERT INTO proposals (title, description, type, status, author_address, quorum_required, metadata) " +
        "VALUES (?, ?, 'GENERAL', ?, ?, ?, ?)",
      args: [
        d.title,
        d.description,
        wave.seedStatus,
        adminAddress,
        d.quorum,
        JSON.stringify({ type: "base", links: [], tags: d.tags }),
      ],
    });
  }

  await db.batch(stmts, "write");

  for (const d of toInsert) {
    console.log(`   ✓ ${wave.seedStatus} #${d.ref}: ${d.title}`);
  }
  console.log(
    `✅ Seeded ${toInsert.length} proposal(s) for wave ${wave.wave} as '${wave.seedStatus}'. ` +
      `Next: admin reviews and approves them at dao.omnom.dog/admin (PENDING_REVIEW → ACTIVE).`,
  );
}

main().catch((err) => {
  console.error("\n💥 Seed failed:", err);
  process.exit(1);
});
