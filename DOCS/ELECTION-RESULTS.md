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

The community selected **Quadratic Voting** as the governance voting model,
and it is now shipped: voting power is floor(√(snapshot balance)) in
`src/lib/voting-power.ts`, and quorum is measured against total quadratic
power (Σ√balance across all snapshot holders) in `src/lib/proposal-finalize.ts`.

---

*Source of truth: the `governance_election` / `governance_election_ballots` /
`governance_election_ballot_events` tables in the production Turso database.
This document is the durable human-readable record of the closed election.*

*Durable archive: exported 2026-09-17 via `scripts/export-governance-archive.ts`
(public-safe mode → `governance-archive-2026-09-17T18-38-16-409Z.json`,
SHA-256 `b4696c21bdd6bc69258b19b60512b9e8977e89a87a949a0d541e86b3c6ea42ce`).
The `--full` per-wallet audit export exists privately off-repo
(SHA-256 `153eee5b7f9c7dd160262680e588c7e764a0610c0d89ea85a225a5b273f62585`).*
