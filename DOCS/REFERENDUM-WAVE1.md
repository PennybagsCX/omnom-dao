# Wave 1 Referendum — Decision Record

**Status:** APPROVED by the project owner, 2026-10-01. Launch-critical record for the referendum replacing the weekly Wave 1 cadence.

## What happened before this decision

- **Foundational Governance Election (FGE)** — `foundational-2026`, 2026-08-29 → 2026-09-12. One wallet = one ballot, plurality, no quorum requirement. Result: **Quadratic voting elected, 65.7% of 35 ballots**. Turnout: 0.14% of the 25,686-wallet electorate = 15,865,230 power = **2.73%** of total quadratic power. Full record: [`ELECTION-RESULTS.md`](ELECTION-RESULTS.md).
- **Wave 1, Week 1** — "Governance parameter: global default quorum" (GENERAL, 5% container quorum), live 2026-09-23 22:00 UTC → 2026-09-30 22:00 UTC. **Finalized EXPIRED — quorum not met.** Verified final numbers (queried prod + independently recomputed from `votes` and `data/holders.json` on 2026-10-01): **27 ballots, 10,096,667 power = 1.735%** of the 581,973,790 denominator. Stored `quorum_achieved` matches the independent recompute exactly — **no tally defect**; the miss is genuine turnout.
- The remaining two Wave 1 decisions (pass threshold, per-type quorum schedule) were never opened.

## Decision

1. **One combined referendum instead of three weekly votes.** The three Wave 1 decisions vote simultaneously in a single 30-day window:
   - **Opens:** tonight 8 PM EST (2026-10-01) = **2026-10-02 00:00 UTC**
   - **Closes:** **2026-11-01 00:00 UTC** (exactly 30 days; 8 PM local on Oct 31)
   - The three decisions remain three separate GENERAL proposals (FOR/AGAINST each) so all existing voting, finalize, audit, and admin machinery applies unchanged — one campaign, one window, one `/vote` page presenting all three questions.
2. **The 5% container quorum is kept — not lowered.** (5% = 29,098,690 power ≈ 1,284 average-power wallets.)
3. **Consensus fallback, disclosed up front.** Every proposal body and announcement states: *if the 5% quorum is not reached, the most-voted outcome will still be adopted as the community's working consensus — recorded openly as a quorum-missed decision (metadata `adoptedAs: "consensus-fallback"`) and re-confirmed in a later ratification vote as turnout grows.* This supersedes the earlier "if quorum fails, nothing changes" language, which appeared in the seeded Week 1 bodies and the `/vote` FAQ.
4. **Mobilization, not rule change, is the lever.** Ship before/at launch: live homepage banner, referendum `/vote` hub (3 ballots), share buttons (X / Telegram / copy), dynamic OG cards, live quorum computation on detail pages, first-party traffic analytics, T-72h + T-24h reminder waves, admin window-extension, and the adopt-as-consensus admin action.

## Why one referendum (machinery rationale)

The FGE machinery (`src/lib/election.ts`) is hardcoded to `foundational-2026` with a CHECK-constrained 4-choice ballot table and `UNIQUE(election_key, voter_address)` — generalizing it into a multi-question referendum would require new schema, tally, routes, and pages before a legitimacy-critical vote. Three simultaneous GENERAL proposals reuse the entire proposal pipeline and give the same voter experience (one visit, three ballots).

## Launch mechanics

1. Seed via `npm run seed:referendum` (3 × GENERAL, PENDING_REVIEW, quorum 5.0, titles `Wave 1 Referendum · Question N: …`, metadata `{referendum: "wave1-2026", referendumQuestion: 1|2|3}`).
2. Reject the superseded Week-1 PENDING_REVIEW rows ("Governance parameter: pass threshold…", "Governance parameter: per-type quorum schedule").
3. At T-0: approve all three at `/admin` (approve sets +168h), then immediately use the admin **extend** action to set `2026-11-01T00:00:00.000Z` on each.
4. `npm run verify:referendum` must be green before announcements go out.

## Referendum questions

| Q | Title | FOR means |
|---|---|---|
| 1 | Wave 1 Referendum · Question 1: Global default quorum | Adopt 5% as the ratified global default quorum |
| 2 | Wave 1 Referendum · Question 2: Pass threshold | Keep simple majority as the global default (supermajority stays for high-impact types) |
| 3 | Wave 1 Referendum · Question 3: Per-type quorum schedule | Adopt the per-type schedule (15% Chain/Tokenomics, 10% Treasury/Technical/Community/General) |

Exact bodies live in `scripts/seed-referendum.ts`.

## Announcement plan

Copy pack: [`announcements/referendum-wave1.md`](announcements/referendum-wave1.md). Cadence: launch (T-0) → T+7 → T+14 → T+21 → last-48h → results (two variants: quorum reached / consensus fallback). All links carry `utm_campaign=wave1-referendum`.
