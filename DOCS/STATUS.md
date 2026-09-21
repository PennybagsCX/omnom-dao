# Platform Status — where we left off

> **Last updated: 2026-09-17**, right after the post-election closeout shipped.
> This is the pick-back-up document: current state, what's deliberately pending, and how to resume.

---

## Where we are

The Foundational Governance Election (the DAO's first vote) closed **2026-09-12**: **Quadratic voting elected at 65.7%** (23/35 ballots; turnout 0.14% of 25,686 eligible wallets). The elected model was already live in code, and on **2026-09-17** everything *around* the result shipped (commits `61fe99e`, `f7dd282` — CI green, prod-verified):

| Shipped | What it means |
|---|---|
| **EXECUTED lifecycle** | Admin can now "record outcome" on passed proposals — the loop closes publicly (who, when, what happened). Prod schema migrated; rehearsed against a copy first. |
| **Public audit log** | `audit_log` table **had never existed** — every admin-action insert failed silently since inception. Now created, publicly readable, and live-verified. |
| **Public `/results` page** | Election results + every finalized proposal in one place, nav-linked. |
| **30-minute cron** | GitHub Actions pinger (`cron-finalize.yml`, secret `CRON_SECRET` set) drives finalize + ending-soon reminders; daily Vercel cron is the fallback. Sweep now runs *before* finalize so expiring votes don't miss their reminder. |
| **Accuracy pass** | Every "1 token = 1 vote" / "% of total supply" claim (UI + docs) corrected to the shipped quadratic model — plus the homepage follow-up (`4a6599d`): "Voting model TBD by community" → "Quadratic voting — community-elected", and the election countdown (whose past-date state read "Voting is now live") replaced with a closed banner linking to `/results`. Lesson recorded: staleness sweeps must be conceptual, not phrase-lists — rendered component defaults can be stale even when source strings are right. |
| **Governance wave prep** | `scripts/seed-governance-decisions.ts --wave 1\|2\|3` creates the 11 open governance parameters ([GOVERNANCE_MECHANICS §14](GOVERNANCE_MECHANICS.md)) as DRAFT proposals — plus a Wave 1 announcement draft. |
| **Admin proposal deletion** (2026-09-19) | Admin can hard-delete **FAILED** proposals (rejected / quorum-failed) from the detail page or the new `/admin` "Failed proposals" cleanup section — votes, comments, and reactions go with it; notifications detach; a `PROPOSAL_DELETED` entry stays in the public audit log. Ships with per-type voting duration defaults (14d chain-selection/tokenomics, 7d fallback) fixing the approve route's hardcoded 168h window. **Prod migration done 2026-09-20** (`db:migrate:proposal-deleted`: audit_log rebuilt, 1 row preserved, re-run verified idempotent) — deletes are audit-safe as of now. |

## Deliberately pending — owner decisions

**No votes have been RUN since the election.** Wave 1 strategy was settled by the owner on 2026-09-21, and the three Wave 1 proposals were **SEEDED into prod as DRAFTs the same day** (idempotent per title):

1. ✅ **Governance waves strategy — DECIDED** — three themed waves of separate GENERAL proposals — Wave 1 voting rules (§14 #2, #3, #5) → Wave 2 process & access (#4, #6, #10) → Wave 3 holder protections (#7, #8, #9, #11); #12 deferred to the migration arc. **Wave 1 runs at the platform's 5% quorum floor** — a bootstrap convention vote whose container quorum is disclosed in each proposal body (the 10% v1 default was never ratified; a quorum-fail leaves the v1 rules in force). Seed script and announcements updated to match.
2. ✅ **Announcements — POSTED 2026-09-21** (owner confirmed): the three FGE result posts and the Wave 1 announcement are live. The Wave 1 discussion window is running.
3. **Admin review queue** — 4 proposals sit in PENDING_REVIEW at `dao.omnom.dog/admin` (needs the admin wallet).
4. **Longer arc, after Wave 1**: Chain Selection vote → 6-round tokenomics framework ([TOKENOMICS-OPTIONS.md](../TOKENOMICS-OPTIONS.md) §9) → decision #12 resolved within it.

## Resuming — the exact steps

Wave 1 is **seeded** (2026-09-21, verified in prod: 3 DRAFT rows, quorum 5%). What remains:

```bash
# Nothing to run — the drafts already exist. Admin flow at dao.omnom.dog/admin:
# → submit + approve each of the 3 drafts (DRAFT → PENDING_REVIEW → ACTIVE)
#   Target: Tue Sep 22 — approval is the moment the 7-day clocks start
#   (Wave 1 rows: 5% quorum of total quadratic power, simple majority — the
#    disclosed convention-vote floor; Waves 2–3 use the 10% GENERAL default)
# → ~Tue Sep 29: windows close (30-min cron finalizes automatically)
#   then /admin → "Record outcome" on each result
# → Post the "Voting is LIVE" one-liner from DOCS/announcements/governance-wave-1.md at approval
```

If the drafts ever need re-creation, the seed is idempotent per title: `npx tsx --env-file=.env.local scripts/seed-governance-decisions.ts --wave 1` skips existing titles. Wave 1's announcement record (incl. the one-liner) is at `DOCS/announcements/governance-wave-1.md`. Later waves keep the `[DATE]`-placeholder pattern until their turn.

## Ops reference

- **Prod smoke**: `npm run verify:election` (needs `.env.local` Turso creds — those are real prod credentials).
- **Safe local UI work**: `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= NEXT_PUBLIC_ENABLE_DEV_AUTH=true npm run dev` → in-memory mock DB + dev-auth panel (bottom-right). Never run plain `npm run dev` for experimentation — `.env.local` points at **production** data.
- **Archives**: `npx tsx scripts/export-governance-archive.ts [--full]` (`--full` is private, never commit). Weekly public-safe export also runs via GitHub Actions.
- **Cron**: `cron-finalize.yml` fires every 30 min; manual trigger via `gh workflow run cron-finalize`. Secrets: `CRON_SECRET` (set), `CRON_HEALTH_URL` (optional, falls back to apex).

## Known non-urgent follow-ups

- Push channels (email/Telegram) are removed; in-app only. Revisit if turnout justifies.
- Seed script is idempotent per single run but has no guard against two concurrent runs (operator-run tool; theoretical).
- Vercel Hobby caps the native cron at daily — the GitHub Actions pinger covers 30-min cadence.
