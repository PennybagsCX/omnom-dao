# OMNOMDAO Foundational Election — Snapshot Integrity & Concentration Audit

**Source repository:** <https://github.com/DBOT-DC/omnom-token>
**Pinned commit:** `33df90601bd73217c57bc4d93e221c102a3eebce`
**Commit date:** 2026-08-11 12:01:26 UTC
**Audit date:** 2026-08-16
**Scope:** All snapshot files published at the pinned commit.

## Reproducibility

Each input file was downloaded from the pinned commit and compared byte-for-byte to the repository's `HASHES.json`. All four principal snapshot files and all ten weekly CSVs matched their published SHA-256 hashes.

| File | SHA-256 |
|---|---|
| `omnom-snapshot-ever-held.csv` | `1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128` |
| `omnom-snapshot-latest.csv` | `4df99e05d4def915da299b2cbece345519e2cc8afab9a63564e20cc1b883bc87` |
| `omnom-snapshot-pre-announcement.csv` | `056433ed5f60fbd3ce0fa6399fb3035422ce1eaa0da3fffc7f019ea477968811` |
| `omnom-snapshot-FINAL.json` | `16d6cb810b62082d9b5e5ed981c7165ab045c19b224c48c3973cfce6efba8e17` |
| `weekly/*.csv` | All 10 verified against `HASHES.json` |

The archived copy used by this audit is stored under
`.codex/snapshot-corpus/` and includes `tree.json`, the complete Git tree at
the pinned commit.

## Population and snapshot cadence

| Population | Count |
|---|---:|
| Ever-held master list | 25,686 |
| Pre-announcement baseline | 25,431 |
| Final (Aug. 8, 2026) current holders | 25,542 |
| Baseline wallets still present in final snapshot | 25,295 |
| Baseline wallets absent from final snapshot | 136 |
| Wallets first seen after baseline | 255 |
| Wallets first seen after baseline and present in final | 247 |
| Aggregate balance held by those 247 final wallets | 1.2546% of latest supply |

First-seen distribution (ever-held master list):

| First snapshot | Wallets |
|---|---:|
| Pre-announcement | 25,431 |
| 2026-06-14 | 12 |
| 2026-06-21 | 66 |
| 2026-06-28 | 51 |
| 2026-07-05 | 32 |
| 2026-07-06 | 3 |
| 2026-07-13 | 20 |
| 2026-07-20 | 31 |
| 2026-07-27 | 31 |
| 2026-08-03 | 6 |
| 2026-08-08 | 3 |

## Concentration (final Aug. 8 snapshot)

| Cohort | Share of latest supply |
|---|---:|
| Top 1 | 68.900% |
| Top 2 | 77.082% |
| Top 4 | 83.529% |
| Top 10 | 86.567% |
| Top 50 | 90.665% |
| Top 100 | 92.877% |

The current token-weighted model is therefore plutocratic: the top wallet
alone controls more than two thirds of token-weighted voting power, and four
wallets control more than four fifths. This concentration is the principal
reason a one-wallet-one-vote foundational election is appropriate for choosing
the future voting framework.

## Balance-change observations

Eighty addresses present in both baseline and final snapshots changed by at
least one of the audit thresholds:

- an increase of at least 500%; or
- a decrease of at least 80%.

The ten largest proportional increases ranged from approximately +6.9× to
+3,574× in token units. The ten largest proportional decreases were all
near-total sell-downs. This is activity on a chain in its wind-down period and
does not, without transaction-level provenance, establish manipulation.

### Exact offsetting balance changes

Three exact offsetting baseline-to-final balance pairs were identified:

| Gain address | Loss address | Exact amount (wei) |
|---|---|---|
| `0x2e2e67bfb31c22d6c2aeae0bb2278171913a8209` | `0x157ce95c86e7e0706b85d07a942837529606073b` | 10,067,942,943 × 10²⁴ |
| `0xdd47565e6c8a620b8ac3094c518e0582d5129867` | `0xf40e062348ce2326d7b6410a94c88bd247c37050` | 3,262,889,369,922,155,752,910,160,628 |
| `0x109a5b24511f5dc0ad08d73f3d0613d31bb887d4` | `0x06b01527ff8340b3f731584a9501ad1999f718c5` | 444 × 10²⁴ |

An exact offset is consistent with wallet-to-wallet transfer but can also occur
by coincidence after multiple unrelated transactions. Transaction-level review
would be required to identify sender, recipient, timing, and intent. No such
conclusion is available from balance snapshots alone.

### Reappearing wallets

Only two addresses appear, disappear, and then reappear across the weekly
series. This is not sufficient, standing alone, to prove coordinated conduct.

### Vanished high-balance wallets

131 wallets with baseline balances greater than 1,000,000 OMNOM are absent
from the final snapshot. Their balances may have been sold, transferred, or
consolidated; the snapshot corpus cannot distinguish those alternatives.

### Identical historical balances

Among ever-held wallets whose maximum historical balance exceeds one million
OMNOM, 84 distinct balance values are shared by multiple wallets, covering 665
addresses in total. Examples include:

- 115 wallets with a maximum balance of exactly 10,000,000 OMNOM;
- 65 wallets with exactly 2,700,000 OMNOM;
- 55 wallets with exactly 5,000,000 OMNOM;
- 40 wallets with exactly 100,000,000 OMNOM;
- 33 wallets with exactly 1,000,000,000 OMNOM.

Round-number repeated balances are consistent with an airdrop, exchange
distribution, farming reward, commercial purchase lots, or planned
multi-wallet accumulation. Balance equality alone cannot distinguish among
these possibilities.

## Election implications and limitations

1. **Verified finding — extreme concentration.** Four wallets control
   83.529% of final-snapshot token supply. A linear token-weighted election
   would allow those wallets to dictate the future framework.
2. **Verified finding — robust one-wallet-one-vote electorate.** The final
   snapshot contains 25,542 wallets, of which the top four constitute only
   0.0157%. The one-wallet-one-vote electorate materially reduces that
   dominance.
3. **Verified observation — multi-wallet patterns exist.** Identical
   round-number balances across hundreds of wallets and exact offsetting
   balance changes indicate that some holdings may be organized across
   multiple wallets.
4. **Data limitation — provenance is incomplete.** The repository provides
   balance snapshots, not a transaction graph or wallet-controller identity.
   It cannot by itself prove common ownership, Sybil coordination, or intent.
5. **Data limitation — MEXC holdings are not represented.** The repository
   expressly notes that off-chain MEXC holdings are outside these snapshots.

### Recommended public treatment

- Use the ever-held master list as the broadest verified electorate for this
  first election, unless the community chooses current-final holders only.
- Publish this audit with the poll so voters understand both the concentration
  risk and the evidentiary limits.
- State plainly that identical balances and offsetting changes are flags for
  review, not findings of manipulation.
- For a stronger future audit, export the full Dogechain transfer-event
  history (before further external links decay) and perform transaction-graph
  analysis.

## Reproduction notes

- CSVs were parsed using their published columns.
- Addresses were normalized to lowercase.
- `balance_raw` was interpreted as an integer token amount in wei.
- Concentration uses final snapshot `balance_raw`.
- “Large change” means present in both baseline and final with either
  `(final-baseline)/baseline ≥ 5` or `≤ -0.8`.
- Exact-offset detection compares net baseline-to-final changes for all
  addresses.
- Identical-balance detection groups ever-held `max_balance_raw` values above
  10²⁴ wei (one million whole OMNOM).
