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
| **Governance wave prep** | `scripts/seed-governance-decisions.ts --wave 1\|2\|3` creates the 11 open governance parameters ([GOVERNANCE_MECHANICS §14](GOVERNANCE_MECHANICS.md)) — **all waves seed as PENDING_REVIEW** (there is no DRAFT→PENDING_REVIEW submit transition in the platform, so a seeded DRAFT could never be submitted). Wave 1 seeded into prod 2026-09-21: 3 PENDING_REVIEW rows, 5% quorum each. **Ballots are binary** (FOR/AGAINST map to explicit options — the platform has no multiple-choice ballots; the body states exactly what each vote means) and every body embeds **"The Turnout Math"**: total quadratic power 581,973,790, bar equivalents (5% ≈ 1,284 avg wallets, 10% ≈ 2,569, 20% ≈ 5,137), and peak-ever turnout 2.73% (35 voters, FGE). Computed from `data/holders.json` + prod ballot addresses. Announcement pack (3-week staggered cadence) at `DOCS/announcements/governance-wave-1.md`. |
| **Draft visibility fix** (2026-09-21) | The public proposals list no longer serves **DRAFT** items — filters targeting drafts return empty and the unfiltered list excludes them (`NON_PUBLIC_STATUSES` in `src/lib/proposal-service.ts`); the public filter bar has no Draft tab. Closes a leak where seed/staging drafts were publicly browsable. **PENDING_REVIEW stays public by design** — submitted proposals are this DAO's real governance content; an earlier same-day change that hid them emptied the live list (incident `c425a01`, no data lost — verified against prod: 7 PENDING_REVIEW rows were and are the complete expected state). Admin review queue unaffected (authed endpoint). Mock DB gained `NOT IN` + multi-column `GROUP BY` support so mock mode mirrors prod. |
| **Vote page `/vote`** (2026-09-22→23, owner-reviewed via Reticle marks) | Nav "Vote" points at **`/vote`** — the Foundational Governance Election page used as the literal template, showing the ONE current vote (most recently OPENED ACTIVE proposal; demo window anchored to **12:00 noon Toronto**, 7 days). Section stack mirrors the FGE page: hero (icon, ACTIVE+type eyebrow, title) → countdown (explicit closed-state text — the stale-default lesson) → gold stats grid with **live turnout** (`totalQuadraticPower` denominator) → status line → **"Cast your ballot" FGE choice cards** (click-to-vote; clicking a different card changes the ballot; gold "Current ballot" state; opens-later notice before the window starts) → per-choice results bars + turnout-vs-quorum progress (live via the shared query) → **"Who has voted" holder-class breakdown** (`tallyProposalByHolderClass`: FISH/unknown → Seahorse, FGE row conventions) → Discussion (the same thread as the proposal page) → full proposal body (Markdown + link to `/proposals/[id]`) → Past-votes rows (each linking to its dedicated page: FGE → `/governance-vote`, finalized → `/proposals/[id]`; admin-rejected rows excluded) → FAQ (proposal-vote mechanics). Cast/change logic lives in shared `src/lib/use-proposal-vote.ts` + `proposal-vote-actions.tsx` (extracted verbatim from the detail page — one code path, one query key, a cast from either surface updates both; detail page regression-proven by its e2e suites). `/governance-vote` untouched as the FGE archive; sitemap `/vote` 1.0/daily, `/governance-vote` 0.6/monthly. **Instrumented with Reticle** (dev-only verification HUD + owner feedback panel): CSP admits the dev bridge, E2E runs with `NEXT_PUBLIC_RETICLE_DEV=none` so the suite never fights the overlay. **Mock parity**: noon-window reset with zero tallies; FGE pinned to the real closed window (23/35 QUADRATIC). Fresh public-safe archive export `archives/governance-archive-2026-09-22T17-38-50-501Z.json`. |
| **Reaction tallies on cards** (2026-09-21) | Proposal list cards now show emoji reaction tallies (which emoji, how many) — the card UI already existed but the list API never hydrated counts, so it stayed hidden forever. `attachEmojiCounts` in `proposal-service.ts` batch-attaches per-page counts (no N+1); also feeds `/results`. Multi-column `GROUP BY` added to the mock DB so the route's own hydration works in mock; mock data seeded with sample reactions. Tests: card tally component suite + service attach assertions. |
| **Admin proposal deletion** (2026-09-19) | Admin can hard-delete **FAILED** proposals (rejected / quorum-failed) from the detail page or the new `/admin` "Failed proposals" cleanup section — votes, comments, and reactions go with it; notifications detach; a `PROPOSAL_DELETED` entry stays in the public audit log. Ships with per-type voting duration defaults (14d chain-selection/tokenomics, 7d fallback) fixing the approve route's hardcoded 168h window. **Prod migration done 2026-09-20** (`db:migrate:proposal-deleted`: audit_log rebuilt, 1 row preserved, re-run verified idempotent) — deletes are audit-safe as of now. |

## Deliberately pending — owner decisions

**No votes have COMPLETED since the election — but one is LIVE:** Week 1's *global default quorum* vote was approved **2026-09-22** and runs to Sep 29 (see the weekly table below). Wave 1 strategy was settled by the owner on 2026-09-21, and the three Wave 1 proposals were **SEEDED into prod as DRAFTs the same day** (idempotent per title):

1. ✅ **Governance waves strategy — DECIDED** — three themed waves of separate GENERAL proposals — Wave 1 voting rules (§14 #2, #3, #5) → Wave 2 process & access (#4, #6, #10) → Wave 3 holder protections (#7, #8, #9, #11); #12 deferred to the migration arc. **Wave 1 runs at the platform's 5% quorum floor** — a bootstrap convention vote whose container quorum is disclosed in each proposal body (the 10% v1 default was never ratified; a quorum-fail leaves the v1 rules in force). Seed script and announcements updated to match.
2. ✅ **Announcements — POSTED 2026-09-21** (owner confirmed): the three FGE result posts and the Wave 1 announcement are live. The Wave 1 discussion window is running.
3. **Admin review queue** — 7 proposals sit in PENDING_REVIEW at `dao.omnom.dog/admin` (3 Wave 1 + 4 pre-existing; needs the admin wallet). **Week 1's item left the queue on 2026-09-22** — it was approved and is live. Approve only the current week's item.
4. **Longer arc, after Wave 1**: Chain Selection vote → 6-round tokenomics framework ([TOKENOMICS-OPTIONS.md](../TOKENOMICS-OPTIONS.md) §9) → decision #12 resolved within it.

## Resuming — the exact steps

Wave 1 is **staggered one vote per week** — approve ONLY the current week's item. **Week 1 is already live** (approved 2026-09-22; the community votes at the new [`/vote`](../src/app/vote/page.tsx) hub):

| Week | Approve this item only | Window |
|---|---|---|
| 1 | Governance parameter: global default quorum | ✅ **approved 2026-09-22** → closes Sep 29 |
| 2 | Governance parameter: pass threshold (simple majority vs supermajority) | approve Sep 29 → closes Oct 6 |
| 3 | Governance parameter: per-type quorum schedule | approve Oct 6 → closes Oct 13 |

Weekly flow: approve the week's item at `dao.omnom.dog/admin` (approval starts the 7-day clock; the 30-min cron finalizes) → post that week's announcement from `DOCS/announcements/governance-wave-1.md` (Week 1 full post + X; Weeks 2–3 short posts) → after close, `/admin` → "Record outcome".

## Ops reference

- **Prod smoke**: `npm run verify:election` (needs `.env.local` Turso creds — those are real prod credentials).
- **Safe local UI work**: `TURSO_DATABASE_URL= TURSO_AUTH_TOKEN= NEXT_PUBLIC_ENABLE_DEV_AUTH=true npm run dev` → in-memory mock DB + dev-auth panel (bottom-right). Never run plain `npm run dev` for experimentation — `.env.local` points at **production** data.
- **Archives**: `npx tsx scripts/export-governance-archive.ts [--full]` (`--full` is private, never commit). Weekly public-safe export also runs via GitHub Actions.
- **Cron**: `cron-finalize.yml` fires every 30 min; manual trigger via `gh workflow run cron-finalize`. Secrets: `CRON_SECRET` (set), `CRON_HEALTH_URL` (optional, falls back to apex).

## Known non-urgent follow-ups

- framer-motion entrance animations bypass the CSS `prefers-reduced-motion` kill-switch (globals.css only zeroes CSS animations/transitions). Systemic — wrap the app in `<MotionConfig reducedMotion="user">` or gate entrances with `useReducedMotion()`.
- Detail page reports "0.00% / N%" quorum on live proposals (`quorumAchieved ?? 0` fallback) even with heavy participation; the /vote card handles the same state better by showing only the required threshold. Parity fix candidate.
- Push channels (email/Telegram) are removed; in-app only. Revisit if turnout justifies.
- Seed script is idempotent per single run but has no guard against two concurrent runs (operator-run tool; theoretical).
- Vercel Hobby caps the native cron at daily — the GitHub Actions pinger covers 30-min cadence.
