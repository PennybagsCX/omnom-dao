# Foundational Governance Election — Official Results

**Election key:** `foundational-2026`
**Voting window:** 2026-08-29 00:00 UTC → 2026-09-12 00:00 UTC (14 days)
**Eligibility:** 25,686 ever-held wallets (pinned snapshot, `omnom-snapshot-ever-held.csv` @ `2c38af7`, SHA-256 `1f64a663…`)
**Status:** CLOSED — verified via `npm run verify:election` against production on 2026-09-12 (all integrity checks passed: snapshot hash, eligible count, tier distribution, pinned window).

## Results

| Choice | Ballots | Share |
|---|---:|---:|
| **QUADRATIC — Quadratic voting** | **23** | **65.7%** ✅ |
| LINEAR — Linear token voting | 6 | 17.1% |
| ONE_WALLET_ONE_VOTE — One wallet, one vote | 5 | 14.3% |
| TIERED — Tiered voting | 1 | 2.9% |
| **Total ballots** | **35** | turnout 0.14% of eligible |

## Audit trail (from `governance_election_ballot_events`)

- **35** `CAST` events — one immutable ballot per voter (unique per wallet, enforced)
- **132** `CHANGE` events — ballots could be changed throughout the window; the active ballot is the latest row per voter
- First ballot cast: 2026-08-29 01:33:49 UTC · Last ballot event: 2026-09-11 16:31:22 UTC
- Full per-ballot audit export: `GET /api/v1/admin/election?export=ballots` (admin session required)

## Outcome

The community selected **Quadratic Voting** as the governance voting model.
Per ROADMAP.md, applying the quadratic model to proposal voting power is the
planned v2 enhancement ("Quadratic Voting — Medium effort"); proposal voting
continues on the tiered holder-class power model until that work lands.

---

*Source of truth: the `governance_election` / `governance_election_ballots` /
`governance_election_ballot_events` tables in the production Turso database.
This document is the durable human-readable record of the closed election.*
