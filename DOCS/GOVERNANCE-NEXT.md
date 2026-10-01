# Governance Next — the post-referendum agenda

**Created:** 2026-10-01, launch day of the Wave 1 Referendum. This is the
standing list of what governance should decide **after** the referendum
results close on 2026-11-01, in priority order. Nothing here changes the live
referendum — these are the next votes.

---

## The honest baseline every decision below starts from

The frozen snapshot lists **25,686 ever-held wallets**, but that number is
not the electorate — it is a *historical record*:

- **22,547 are Seahorses** (the bottom class) — largely dust positions,
  airdrop farmers, round-trip traders, and abandoned accounts. Most have been
  out of the market since the June snapshots.
- **The realistically reachable, invested base is roughly 1,000–3,000
  wallets** (Octopus class and up, plus engaged Crabs), and the realistic
  voting base is **~100–500 wallets** even with strong promotion.
- **New buyers today get zero voting power** — the snapshot is frozen at
  block 59,922,100 (2026-06-07). Growth marketing cannot grow the electorate.

Strategic consequence: design the rulebook for **a few hundred invested
people, not twenty-six thousand ghosts** — then grow the electorate as a
separate, explicit workstream (§5 below).

---

## 1. Ratify the fallback rule for keeps (first vote after the referendum)

The Wave 1 fallback — "most-voted outcome adopted as working consensus" — was
the right emergency brake and was disclosed before the vote. It should **not**
be the permanent rule. Propose as the standing rule:

- **Changes need a supermajority**: adopting a *change* under fallback
  requires ≥60% of participating (FOR+AGAINST) power.
- **Confirming the status quo needs only a simple majority.** Low
  participation should easily *ratify continuity* and never easily produce
  radical change — silence defaults to "keep things as they are."
- The existing 24h intent + cooling-off and public audit stay.

Reference implementation: the guardrails shipped 2026-10-01 in
`adopt-consensus` (60% share + 100 unique voters + `force` override) are the
v1 of this — the vote ratifies them and adjusts the numbers.

## 2. Ratcheting voter floor + ratchet quorum

Static quorum bars fight reality forever (5% ≈ 37× record turnout; the seeded
15–25% bars are ~110–180×). Replace the fixed ladder with a **ratchet**:

- Quorum for a proposal type = the greater of a small floor (e.g. 0.5% of
  total quadratic power) and **80% of the trailing median turnout** of that
  type's last 3 votes.
- A **voter floor** (unique wallets) starts at a level that is actually
  achievable (e.g. 50) and **ratchets up automatically** as turnout grows —
  never down.
- Effect: a bar the community can *touch* becomes a target; every success
  raises the next bar. Failure stops being the permanent status.

## 3. Electorate reset at chain migration (the real exit from the dust problem)

The planned **Chain Selection vote → new-chain migration** is the one clean
chance to redefine who "the voters" are:

- At migration, take a **fresh snapshot** on the new chain and consider an
  **active-electorate definition** — e.g. wallets holding ≥ a threshold at
  the new block, and/or opt-in registration verified by a signature, instead
  of "ever-held since 2026-06."
- Options to debate (none decided): activity window (did anything in the
  last N months), minimum balance, registration-based, or hybrid.
- Keep the old snapshot permanently published for the historical record, but
  stop letting dead dust positions define participation forever.
- Sequencing note: this rides the tokenomics rounds (Round 2+), i.e. months
  out — but the **decision framework should be written before the Chain
  Selection vote**, because "what happens to voting power" is part of what
  voters are choosing.

## 4. Community activation — reach the Octopus class now (no vote needed)

~1,400 wallets (1 Kraken, 3 Whales, 30 Dolphins, 326 Sharks, 1,078
Octopuses) hold the concentrated voting power; they are the quorum-makers
for everything. Owner workstream, not code:

- Identify and reach them (snapshot explorer already lists them publicly).
- Give them a reason to care: the migration story, DogeOS early-mover
  positioning (§6), and "you are the quorum" framing in posts.
- Measure: unique voters per vote, per class (the /vote page already shows
  the class breakdown).

## 5. DogeOS — preferred Chain Selection candidate, be early (owner strategy note)

**DogeOS opened its public testnet on 2026-09-30**: a zero-knowledge EVM
rollup on Dogecoin with **DOGE as native gas**, launching alongside 11 apps
(coverage: Altcoin Buzz, Crypto Briefing, Crypto.news). Strategic fit for
$OMNOM:

- **EVM-compatible** — this entire platform stack (wagmi/viem, SIWE,
  RainbowKit, EIP-1191 wallets) is EVM-native; migration effort is mostly
  re-pointing chains and re-issuing a token, not a rewrite. A non-EVM chain
  would be a rebuild.
- **Brand-true**: OMNOM is a Dogecoin-community token; a Dogecoin L2 with
  DOGE gas is the natural home versus a generic chain.
- **Early/first-mover**: being among the first governance/community tokens
  live on DogeOS mainnet is a marketing asset the migration vote can lean on.
- **Risks to disclose to voters**: testnet-stage technology (no mainnet
  track record yet), bridge/rollup security maturity, ecosystem depth, and
  the usual "be first vs be safe" tradeoff. The Chain Selection vote must
  present these honestly alongside other candidates.
- **Sequencing caution**: the Wave 1 Referendum's Question 3, if it passes,
  sets Chain Selection quorum at **25% (≈6,421 avg wallets — ~180× record
  turnout)**, which would freeze this decision until turnout explodes. The
  owner should decide post-referendum whether to fold a quorum adjustment
  (per §2) into the same follow-up vote so DogeOS early entry stays
  reachable.

## Sequencing

1. **2026-11-01** — referendum closes; results published (binding or
   consensus-fallback per the disclosed rule).
2. **First follow-up vote** — ratify §1 (fallback standing rule) + §2
   (ratchet) together; ideally one combined ballot again.
3. **Chain Selection vote** — candidates ballot, DogeOS presented per §5,
   under whatever quorum §2 established.
4. **Tokenomics rounds** — Round 2+ carries the electorate reset (§3).
