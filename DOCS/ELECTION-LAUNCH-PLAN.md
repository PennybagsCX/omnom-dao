# OMNOMDAO Foundational Governance Election — Launch Plan

## Purpose

The first on-platform vote determines how future OMNOMDAO proposals will be
counted. The election itself deliberately uses **one wallet, one vote**: every
wallet in the pinned ever-held snapshot receives exactly one immutable ballot,
regardless of token balance.

## Election facts

| Item | Value |
|---|---|
| Ballot rule | One wallet = one vote |
| Voting period | 14 days |
| Eligibility | 25,686 wallets in the pinned ever-held master list |
| Source commit | `2c38af77ba37e67328347cc44bcabbd07551ec42` |
| Source file | `omnom-snapshot-ever-held.csv` |
| Source SHA-256 | `1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128` |
| Ballots | Irrevocable once cast |
| Results | Public and live during voting |

## Ballot choices

1. **Quadratic voting** — voting power equals the square root of snapshot token balance.
2. **One wallet, one vote** — every eligible wallet receives one equal vote.
3. **Tiered voting** — kraken, whale, dolphin, shark, octopus, crab, and seahorse cohorts receive fixed voting blocks.
4. **Linear token voting** — retain one token = one vote.

## Security controls

- SIWE wallet verification is required before a ballot can be cast.
- Eligibility is checked against the pinned snapshot artifact.
- A database `UNIQUE(election_key, voter_address)` constraint prevents duplicate ballots.
- Ballots outside the configured election window are rejected.
- The admin interface can view and export election data but cannot alter ballots.
- Election window and eligibility records are stored with the election itself.

## Admin operations checklist

1. Sign in with the sole configured admin wallet:
   `0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a`.
2. Open `/admin`.
3. Confirm:
   - Election phase is `OPEN`;
   - eligible wallet count is 25,686;
   - source commit and SHA-256 match the pinned values above.
4. Monitor:
   - ballots cast;
   - turnout percentage;
   - choice tallies;
   - snapshot-audit limitations.
5. Export:
   - `Eligibility CSV` — every eligible wallet and rank;
   - `Ballot audit CSV` — voter address, choice, and cast time.
6. After the window closes:
   - export the final ballot audit;
   - publish the final result and audit report;
   - archive the exports with the launch record.

## Live-testing checklist

- [x] `/api/v1/governance-vote` returns status, phase, turnout, and results.
- [x] Anonymous users see public results and a connect-wallet prompt.
- [x] Snapshot-ineligible wallets are rejected with `NOT_IN_SNAPSHOT`.
- [x] Duplicate ballots are rejected with `ALREADY_VOTED`.
- [x] Closed-window ballots are rejected with `VOTING_CLOSED`.
- [x] Unit tests cover status, eligibility, duplicate, and timing behavior.
- [x] Browser checks pass at 375, 768, 1280, and 1920 pixels.
- [x] Full Playwright suite passes.
- [ ] Production migration `npm run db:migrate`.
- [ ] Production smoke test after migration.
- [ ] Announce the election.
- [ ] Close and publish results after 14 days.

## Recommended public announcement

> **OMNOMDAO Foundational Governance Election is open**
>
> This vote decides how future proposals are counted.
>
> Every wallet in the verified ever-held snapshot gets one ballot. One wallet,
> one vote, one time. Voting stays open for 14 days.
>
> The electorate is 25,686 ever-held wallets from the public snapshot corpus at
> github.com/DBOT-DC/omnom-snapshot (pinned commit `2c38af77`). The ever-held file
> is SHA-256 verified as `1f64a663…c128`.
>
> Your choices are:
> 1. Quadratic voting
> 2. One wallet, one vote
> 3. Tiered voting
> 4. Linear token voting
>
> Why this first vote uses one wallet, one vote: under the current linear model,
> four wallets control ~87.1% of token-weighted votes. A one-wallet-one-vote
> founding election prevents that concentration from determining the future
> voting framework itself.
>
> Snapshot audit summary:
> - All repository snapshot files and ten weekly CSVs matched their published hashes.
> - The final snapshot contains 25,542 current wallets.
> - Top 1 wallet: 68.9% of supply; top 4: ~87.1%.
> - 255 wallets first appeared after baseline; those still holding own 1.2546%.
> - 84 repeated round-number historical balances cover 665 wallets.
> - Three exact offsetting baseline-to-final balance changes were identified.
> - These patterns warrant review but do not prove manipulation. Balance
>   snapshots cannot establish common ownership or intent. MEXC off-chain
>   holdings are outside this corpus.
>
> Connect the wallet that held $OMNOM, verify by signing the free read-only
> message, and cast your one ballot at `/governance-vote`.
>
> Full audit methodology and limitations: `docs/ELECTION-SNAPSHOT-AUDIT.md`.
