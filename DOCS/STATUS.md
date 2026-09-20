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

**No votes have been run or seeded since the election.** The owner explicitly deferred everything voting-related pending strategy discussions "over the next few days":

1. **Governance waves strategy** — which decisions go first, how to frame quorum/threshold options given the 0.14% turnout reality, timing between waves. Recommended shape (from planning): three themed waves of separate GENERAL proposals — Wave 1 voting rules (§14 #2, #3, #5) → Wave 2 process & access (#4, #6, #10) → Wave 3 holder protections (#7, #8, #9, #11); #12 deferred to the migration arc.
2. **FGE result announcements** — drafted but unposted: `DOCS/announcements/telegram-full.md`, `telegram-caption.md`, `x-draft.md`.
3. **Admin review queue** — 4 proposals sit in PENDING_REVIEW at `dao.omnom.dog/admin` (needs the admin wallet).
4. **Longer arc, after Wave 1**: Chain Selection vote → 6-round tokenomics framework ([TOKENOMICS-OPTIONS.md](../TOKENOMICS-OPTIONS.md) §9) → decision #12 resolved within it.

## Resuming — the exact steps

When the strategy is settled, running Wave 1 is:

```bash
npx tsx scripts/seed-governance-decisions.ts --wave 1 --dry-run   # preview
npx tsx scripts/seed-governance-decisions.ts --wave 1             # creates DRAFTs (admin wallet author)
# → admin submits + approves at /admin → 7-day vote runs under current v1 rules
#   (GENERAL: 10% quorum of total quadratic power, simple majority)
# → after close: /admin → "Record outcome" on each result
```

Each wave needs its announcement draft (Wave 1's is at `DOCS/announcements/governance-wave-1.md`, dates as `[DATE]` placeholders) and a discussion period before the vote opens.

## Ops reference

- **Prod smoke**: `npm run verify:election` (needs `.env.local` Turso creds — those are real prod credentials).
- **Safe local UI work**: `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= NEXT_PUBLIC_ENABLE_DEV_AUTH=true npm run dev` → in-memory mock DB + dev-auth panel (bottom-right). Never run plain `npm run dev` for experimentation — `.env.local` points at **production** data.
- **Archives**: `npx tsx scripts/export-governance-archive.ts [--full]` (`--full` is private, never commit). Weekly public-safe export also runs via GitHub Actions.
- **Cron**: `cron-finalize.yml` fires every 30 min; manual trigger via `gh workflow run cron-finalize`. Secrets: `CRON_SECRET` (set), `CRON_HEALTH_URL` (optional, falls back to apex).

## Known non-urgent follow-ups

- Approve route hardcodes a 168h (7-day) window regardless of the per-type defaults the create flow advertises.
- Push channels (email/Telegram) are removed; in-app only. Revisit if turnout justifies.
- Seed script is idempotent per single run but has no guard against two concurrent runs (operator-run tool; theoretical).
- Vercel Hobby caps the native cron at daily — the GitHub Actions pinger covers 30-min cadence.
