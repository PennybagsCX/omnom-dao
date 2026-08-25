# $OMNOM Tokenomics Options — Community Governance Reference

> **Purpose:** This document presents every viable tokenomics model for post-Dogechain $OMNOM, so holders can make informed decisions through DAO governance votes. Each option is evaluated on fairness, complexity, value creation, community engagement, security, and implementation time.

---

## 1. Current State

### Supply & Burn Details

| Metric | Value |
|---|---|
| **Token Standard** | DRC-20 (Dogechain) |
| **Total Minted** | ~100% of max supply |
| **Burned by Vitalik** | 68.9% of total supply |
| **Remaining Circulating** | ~31.1% across all holders |
| **Current Utility** | None (speculative / meme asset) |
| **Snapshot Date** | June 7, 2026 (Dogechain sunset) |

### Holder Distribution (Post-Burn)

| Tier | Count | Holdings | Share of Remaining |
|---|---|---|---|
| 🐋 **Whales** (≥1%) | 4 | ≥1% each | ~4–6% combined |
| 🐬 **Dolphins** (≥0.01%) | 322 | 0.01–1% each | ~20–30% combined |
| 🐟 **Fish** (<0.01%) | 25,105 | <0.01% each | ~65–75% combined |
| **Total Holders** | **25,431** | — | **100%** |

### Key Facts

- **Dogechain sunset** after the June 7 snapshot means holders must migrate or lose access.
- Vitalik's 68.9% burn created extreme scarcity — only ~31.1% remains.
- Distribution is **heavily retail-dominated**: 25,105 fish holders represent ~99% of unique addresses but hold a majority of remaining supply.
- 4 whale wallets hold concentrated positions that could influence governance.

---

## 2. Option A: Pure Migration (1:1 Airdrop)

### Description

The simplest path. Every holder receives tokens on the new chain at a **1:1 ratio** based on the June 7 snapshot. No burns, no staking, no new mechanics. $OMNOM simply lives on a new blockchain with the same distribution.

### Mechanics

- Snapshot taken at block X on Dogechain (June 7, 2026).
- Smart contract on target chain reads Merkle tree of eligible addresses.
- Holders claim tokens via a dApp — unclaimed tokens remain in a dead wallet after a 12-month claim window.
- Total supply on new chain = 31.1% of original max supply.

### Pros

- **Zero complexity** — fastest to implement (2–4 weeks).
- **Maximum fairness** — everyone gets exactly what they had.
- **Lowest risk** — no economic experiments that could go wrong.
- **Clear governance** — snapshot is objective, no subjective allocations.
- **Legal safety** — simple airdrop, no securities-like features.

### Cons

- **No value creation** — token has no utility beyond being tradable.
- **No engagement driver** — holders claim and forget.
- **Price pressure** — whales may dump immediately on new DEX.
- **No treasury** — no funding for community initiatives.
- **Meme decay** — without new utility, hype fades post-migration.

### Rating

| Dimension | Score (1–5) |
|---|---|
| Fairness | ★★★★★ |
| Simplicity | ★★★★★ |
| Value Creation | ★☆☆☆☆ |
| Community Engagement | ★☆☆☆☆ |
| Security | ★★★★★ |
| Implementation Time | ★★★★★ (Fastest) |

---

## 3. Option B: Deflationary Burn Model

### Description

Every transaction on the new chain burns a percentage of tokens. Over time, supply decreases, creating scarcity pressure. Holders vote on the burn rate.

### Mechanics

- **Burn rates under consideration:**
  - **0.5%** — Gentle burn, ~5 years to halve circulating supply.
  - **1.0%** — Moderate burn, ~2.5 years to halve.
  - **2.0%** — Aggressive burn, ~1.2 years to halve.
- Burn applied to both buys and sells.
- Burned tokens sent to a verifiable dead address (e.g., `0xdead...0000`).
- Migration: 1:1 airdrop + burn mechanic active from genesis.

### Pros

- **Built-in scarcity** — supply decreases with activity, theoretically supporting price.
- **Anti-dump** — selling costs tokens, discouraging panic sells.
- **Simple to implement** — one smart contract modifier.
- **Transparent** — burn rate and dead address are on-chain and verifiable.
- **Speculative appeal** — "ultra-deflationary" narrative drives memecoin attention.

### Cons

- **Death spiral risk** — if activity drops, price stagnates while supply still burns. No one transacts → no burn → no scarcity narrative.
- **Sells cost more** — sellers lose extra tokens, which can feel punitive.
- **Tax evasion perception** — some DEXes/wallets flag transfer-tax tokens as scams.
- **Liquidity drain** — LP tokens lose value as underlying tokens burn, weakening the pool.
- **No utility** — still just a token that burns; doesn't fund anything.
- **Whale advantage** — whales transact less frequently (HODL), so burn disproportionately affects small active traders.

### Rating

| Dimension | Score (1–5) |
|---|---|
| Fairness | ★★★☆☆ |
| Simplicity | ★★★★☆ |
| Value Creation | ★★★☆☆ |
| Community Engagement | ★★☆☆☆ |
| Security | ★★★★★ |
| Implementation Time | ★★★★☆ |

### Burn Rate Comparison

| Burn Rate | Tokens Burned per 1M tx volume | Time to Halve (31.1% → 15.5%) | Selling Friction |
|---|---|---|---|
| 0.5% | 5,000 | ~5 years (est.) | Minimal |
| 1.0% | 10,000 | ~2.5 years (est.) | Noticeable |
| 2.0% | 20,000 | ~1.2 years (est.) | High |

---

## 4. Option C: Staking & DAO Treasury

### Description

Holders stake $OMNOM to participate in governance. Staked tokens earn a share of treasury revenue. The treasury is funded by a percentage of initial supply reserved at genesis.

### Mechanics

- **Treasury allocation:** 5–15% of total migrated supply locked in a DAO treasury contract.
- **Staking:** Holders lock $OMNOM in a staking contract to receive:
  - Voting power (1 token = 1 vote, or quadratic for fairness).
  - Yield from treasury (funded by partnerships, NFT sales, or a small % of new emissions).
- **Governance:** Stakers vote on treasury spending — marketing, development, community events, partnerships.
- **Lock periods:** Flexible (no lock), 30-day, 90-day, 1-year — longer locks earn higher yield multipliers.
- **Migration:** Treasury tokens come from an equal percentage reduction of all holders (e.g., 10% haircut for everyone).

### Pros

- **Sustainable engagement** — stakers have ongoing reasons to participate.
- **Community-funded development** — treasury pays for real work, not promises.
- **Anti-dump** — staking removes tokens from circulation.
- **Governance with teeth** — treasury gives DAO real power and accountability.
- **Partnership magnet** — projects want to partner with a funded DAO.
- **Professional credibility** — treasury management signals maturity.

### Cons

- **Complexity** — requires staking contract, treasury contract, governance framework, multi-sig.
- **Treasury haircut** — every holder loses 5–15% to fund the treasury (perceived as unfair by some).
- **Governance attacks** — whales with ≥1% can dominate votes unless quadratic voting is used.
- **Regulatory attention** — staking yields + treasury may attract scrutiny.
- **Implementation time** — 2–3 months minimum.
- **Needs guardrails** — treasury spend limits, timelocks, multi-sig to prevent rug-by-governance.

### Rating

| Dimension | Score (1–5) |
|---|---|
| Fairness | ★★★☆☆ |
| Simplicity | ★★☆☆☆ |
| Value Creation | ★★★★★ |
| Community Engagement | ★★★★★ |
| Security | ★★★☆☆ |
| Implementation Time | ★★☆☆☆ |

### Treasury Size Scenarios

| Allocation | Treasury (of remaining ~31.1%) | Monthly Budget (12mo runway) | Per-Holder Haircut |
|---|---|---|---|
| 5% | ~1.55% of original supply | Spend over 12 months | 5% of each holder's balance |
| 10% | ~3.11% of original supply | Moderate runway | 10% of each holder's balance |
| 15% | ~4.67% of original supply | Strong runway | 15% of each holder's balance |

---

## 5. Option D: Liquidity Pool & DEX Trading

### Description

Establish a liquidity pool on a DEX on the target chain. Pair $OMNOM with a stablecoin (USDC/USDT) or major token (ETH/SOL). Enables price discovery and trading post-migration.

### Mechanics

- **LP creation:** DAO deploys $OMNOM + paired token into a DEX pool (e.g., Uniswap V3, Raydium, Orca).
- **Liquidity sources:**
  - Community LP contributions (holders deposit pairs).
  - Treasury-funded LP (if Option C is also chosen).
  - Team/DAO initial seed liquidity.
- **Price discovery:** Market determines $OMNOM price organically.
- **Migration:** 1:1 airdrop + initial LP seeded by DAO or community.

### Pros

- **Price discovery** — real market price, not speculative OTC.
- **Accessibility** — anyone can buy/sell on-chain.
- **Liquidity = legitimacy** — DEX presence signals the project is alive.
- **Revenue potential** — LP fees can be redirected to treasury.
- **Composable** — other DeFi protocols can integrate $OMNOM.

### Cons

- **Liquidity requirements** — needs meaningful capital (e.g., $50K–$500K in paired token).
- **Dump risk** — whales can sell into thin LP, crashing price.
- **LP rug risk** — if LP tokens aren't locked, they can be withdrawn.
- **Impermanent loss** — LP contributors may lose value if $OMNOM price diverges.
- **DEX dependency** — if the DEX has issues, $OMNOM is untradeable.
- **No utility beyond trading** — still needs other mechanics to drive long-term value.

### Rating

| Dimension | Score (1–5) |
|---|---|
| Fairness | ★★★★☆ |
| Simplicity | ★★★☆☆ |
| Value Creation | ★★★☆☆ |
| Community Engagement | ★★★☆☆ |
| Security | ★★☆☆☆ |
| Implementation Time | ★★★★☆ |

### Liquidity Seeding Options

| Source | Amount (Est.) | Pros | Cons |
|---|---|---|---|
| Community LP event | $10K–$100K | Distributed, fair | Slow, uncertain |
| Treasury seed | $25K–$100K | Fast, reliable | Requires treasury (Option C) |
| External partnership | Variable | No community cost | Dilutes tokenomics |
| DAO bond/IDO | $50K–$500K | Large capital raise | Regulatory risk, complexity |

---

## 6. Option E: Hybrid Model (Recommended Starting Point)

### Description

Combines the best elements of Options A–D: **1:1 Migration + Transaction Burn + Staking/Treasury + DEX Liquidity.** Phased rollout allows the community to activate features incrementally.

### Phase 1: Foundation (Weeks 1–4)

- 1:1 airdrop migration based on June 7 snapshot.
- DEX liquidity pool seeded (community + DAO).
- Basic governance framework deployed (snapshot-based, no staking required yet).

### Phase 2: Scarcity (Weeks 5–8)

- Transaction burn activated (rate determined by community vote).
- Burn dashboard live — community tracks total burned in real-time.

### Phase 3: DAO Treasury (Weeks 9–16)

- Treasury allocation voted on (5–15% range).
- Staking contract deployed — holders can stake for voting power + yield.
- First governance proposals: treasury spending, partnerships, marketing.

### Phase 4: Expansion (Month 5+)

- NFT/integration partnerships (treasury-funded).
- Cross-chain bridge exploration.
- Additional DeFi integrations (lending, bonding curves, etc.).

### Pros

- **Best of all worlds** — migration fairness + burn scarcity + staking engagement + DEX liquidity.
- **Phased approach** — reduces risk by not launching everything at once.
- **Community-driven at every step** — each phase has its own governance vote.
- **Adaptable** — if burn rate causes issues, vote to adjust. If treasury is underutilized, redirect.
- **Professional** — signals to the broader crypto community that $OMNOM is serious.

### Cons

- **Maximum complexity** — most contracts, most moving parts, most governance overhead.
- **Longest timeline** — 4+ months to full implementation.
- **More attack surface** — staking + treasury + LP = more contracts to audit.
- **Higher cost** — smart contract development, audits, infrastructure.
- **Coordination burden** — requires active governance participation to succeed.
- **Treasury haircut still applies** — Option C tradeoff remains.

### Rating

| Dimension | Score (1–5) |
|---|---|
| Fairness | ★★★★☆ |
| Simplicity | ★☆☆☆☆ |
| Value Creation | ★★★★★ |
| Community Engagement | ★★★★★ |
| Security | ★★★☆☆ |
| Implementation Time | ★☆☆☆☆ |

### Why This Is Recommended

The hybrid model doesn't force the community to choose between simplicity and value creation. Phase 1 (pure migration) is identical to Option A — minimal risk, fast delivery. Each subsequent phase is **opt-in via governance vote**. If the community decides burn mechanics aren't worth it, Phase 2 simply doesn't activate. This is a **menu approach**, not a package deal.

---

## 7. Comparison Table

| Dimension | A: Pure Migration | B: Deflationary | C: Staking/Treasury | D: Liquidity Pool | E: Hybrid |
|---|---|---|---|---|---|
| **Fairness** | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ |
| **Simplicity** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ |
| **Value Creation** | ★☆☆☆☆ | ★★★☆☆ | ★★★★★ | ★★★☆☆ | ★★★★★ |
| **Community Engagement** | ★☆☆☆☆ | ★★☆☆☆ | ★★★★★ | ★★★☆☆ | ★★★★★ |
| **Security** | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |
| **Implementation Time** | 2–4 weeks | 3–5 weeks | 2–3 months | 3–5 weeks | 4+ months |
| **Cost** | Low | Low | Medium | Medium | High |
| **Dump Protection** | None | Moderate | Strong | Weak | Strong |
| **Long-term Sustainability** | Low | Low | High | Medium | High |
| **Best For** | Quick exit, minimal risk | Meme/speculative play | Long-term community | Trading access | Ambitious community |

---

## 8. Chain Selection

The target chain matters as much as the tokenomics model. Here's a comparison of viable options:

### Evaluation Criteria

| Chain | Avg. Tx Fee | EVM Compatible | Major DEXes | Community Sentiment | Bridge Maturity | Dogechain Migration Ease |
|---|---|---|---|---|---|---|
| **Base (Coinbase L2)** | ~$0.01–$0.05 | ✅ Yes | Uniswap, Aerodrome | Very positive (retail-friendly) | Good (Base bridge, Stargate) | Standard EVM migration |
| **Arbitrum** | ~$0.05–$0.15 | ✅ Yes | Uniswap, Sushi, GMX | Positive (DeFi-focused) | Excellent (native bridge, Hop) | Standard EVM migration |
| **Solana** | ~$0.00025 | ❌ No (SVM) | Raydium, Orca, Jupiter | Very positive (meme coin hub) | Good (Wormhole, deBridge) | Requires SVM contract rewrite |
| **Dogechain Revival** | ~$0.01 | ✅ Yes | Unknown/limited | Mixed (uncertainty) | N/A | Zero migration (same chain) |
| **Custom L2 (OP Stack)** | ~$0.005–$0.02 | ✅ Yes | Deploy your own | Neutral (unproven) | Bridge built-in | Full control but highest cost |

### Chain Deep Dives

#### Base (Coinbase L2)
- **Best for:** Retail-focused communities, meme tokens, quick DEX launch.
- **Pros:** Coinbase backing, low fees, Aerodrome for deep liquidity, growing ecosystem.
- **Cons:** Relatively new, centralized sequencer.
- **$OMNOM fit:** ★★★★☆ — Strong retail narrative, easy DEX access.

#### Arbitrum
- **Best for:** DeFi-heavy models with staking, treasury, complex smart contracts.
- **Pros:** Most mature L2, deep liquidity, proven governance (Arbitrum DAO).
- **Cons:** Higher fees than Base, more competitive landscape.
- **$OMNOM fit:** ★★★★☆ — Best if going full hybrid model (Option E).

#### Solana
- **Best for:** Pure meme plays, fast trading culture, high throughput.
- **Pros:** Fastest chain, lowest fees, massive meme coin community (BONK, WIF, etc.).
- **Cons:** Not EVM — requires full contract rewrite, different tooling, occasional outages.
- **$OMNOM fit:** ★★★☆☆ — Great for hype, bad for complexity. Good if staying simple.

#### Dogechain Revival
- **Best for:** Zero-cost migration if the chain comes back.
- **Pros:** No migration needed, maintains Dogechain identity.
- **Cons:** Uncertain if/when chain returns. No DEX infrastructure. No security guarantees.
- **$OMNOM fit:** ★★☆☆☆ — Too risky as primary plan. Keep as backup option.

#### Custom L2 (Optimism OP Stack)
- **Best for:** Maximum control, building a $OMNOM-specific ecosystem.
- **Pros:** Full ownership, custom fee mechanics, can embed $OMNOM as gas token.
- **Cons:** $100K+ to launch, requires ongoing maintenance, no existing users.
- **$OMNOM fit:** ★☆☆☆☆ — Overkill for current stage. Maybe a Year 2 consideration.

### Recommendation

**Phase 1: Base or Arbitrum** — EVM compatibility makes migration trivial. Base for retail/meme focus, Arbitrum for DeFi/treasury focus. Community vote decides.

**Do NOT:** Build a custom L2. Do NOT depend on Dogechain revival as a primary plan.

---

## 9. Recommendation Framework

### Multi-Round Governance Structure

Governance should be a series of focused votes, not one massive poll. This prevents voter fatigue and ensures each decision gets proper attention.

#### Round 1: Chain Selection (Week 1)

> "Which blockchain should $OMNOM migrate to?"

- **Options:** Base, Arbitrum, Solana, Abstain
- **Threshold:** Simple majority (>50% of participating tokens)
- **Duration:** 7 days

#### Round 2: Migration Model (Week 2)

> "Should $OMNOM use a pure 1:1 migration or allocate a percentage to a DAO treasury?"

- **Options:** Pure 1:1 (Option A), Treasury allocation (Option C), Abstain
- **Threshold:** Supermajority (>60% of participating tokens)
- **Duration:** 7 days

#### Round 3: Burn Mechanics (Week 3)

> "Should $OMNOM include a transaction burn? If yes, at what rate?"

- **Options:** No burn, 0.5% burn, 1.0% burn, 2.0% burn, Abstain
- **Threshold:** Simple majority (>50% of participating tokens)
- **Duration:** 7 days

#### Round 4: Treasury & Staking (Week 4)

> *If Round 2 approved treasury:* "What percentage of supply goes to the DAO treasury, and what should staking yield be based on?"

- **Treasury:** 5%, 10%, 15%
- **Yield source:** Transaction fees, partnerships, emissions, or combination
- **Threshold:** Supermajority (>60%) for treasury size; simple majority for yield source
- **Duration**: 7 days

#### Round 5: Liquidity Strategy (Week 5)

> "How should the initial DEX liquidity pool be funded?"

- **Options:** Community LP event, Treasury seed, External partnership, DAO bond/IDO, Combination
- **Threshold:** Simple majority (>50%)
- **Duration:** 7 days

#### Round 6: Implementation Audit (Ongoing)

> After deployment, an ongoing governance process for:
- Adjusting burn rates
- Treasury spending proposals
- Smart contract upgrades
- Partnership approvals

### Voting Thresholds

| Decision Type | Threshold | Rationale |
|---|---|---|
| Chain selection | >50% (simple majority) | Low-stakes, need clear direction |
| Treasury allocation | >60% (supermajority) | Affects everyone's holdings |
| Burn rate | >50% (simple majority) | Adjustable if wrong |
| Constitution / charter | >67% (2/3 majority) | Foundational, hard to change |
| Smart contract upgrade | >60% + 24hr timelock | Security-sensitive |
| Treasury spend (per proposal) | >50% + daily cap | Prevents drain attacks |

### Voter Eligibility

- Based on June 7, 2026 Dogechain snapshot.
- No token needed to *view* proposals (transparent governance).
- Minimum 1 $OMNOM to vote (prevents Sybil from zero-balance wallets).
- **Quorum:** Minimum 5% of total supply must participate for a vote to be valid.

---

## 10. Open Questions

These are decisions the community **must** make — this document cannot answer them alone:

### Supply & Migration
- [ ] Should unclaimed tokens after the 12-month window be burned or added to the treasury?
- [ ] Should there be a vesting schedule for whale wallets (>1% holdings) post-migration?
- [ ] What happens to $OMNOM tokens on Dogechain after migration — should the old chain tokens be officially deprecated?

### Governance
- [ ] **Quadratic vs. linear voting?** Quadratic voting (1 token = √votes) prevents whale dominance but is more complex.
- [ ] **Delegation:** Should holders be able to delegate their voting power to trusted community members?
- [ ] **Minimum quorum:** Is 5% of total supply the right threshold, or should it be higher/lower?
- [ ] **Off-chain vs. on-chain voting?** Snapshot (off-chain, free) vs. Tally (on-chain, costs gas)?

### Treasury & Staking
- [ ] **Who controls the treasury multi-sig?** How many signers, and who are they?
- [ ] **Treasury investment strategy:** Stablecoins only? Multi-asset? Degen plays?
- [ ] **Staking lock periods:** Should there be mandatory minimums, or fully flexible?
- [ ] **Yield source:** Where does staking yield actually come from? (Must be sustainable, not inflationary Ponzi.)

### Burn Mechanics
- [ ] **Buy + sell burn, or sell-only?** Buy burns punish buyers; sell-only is more standard.
- [ ] **Burn exceptions:** Should contract interactions (staking, governance) be exempt from burn?
- [ ] **Burn cap:** Should there be a minimum circulating supply below which burns stop?

### Chain & Technical
- [ ] **Final chain selection:** Base, Arbitrum, or Solana? (Community vote.)
- [ ] **Smart contract audit:** Who performs it? How is it funded?
- [ ] **Bridge provider:** How do users actually move tokens? (Native bridge, third-party, or custom?)
- [ ] **Withdrawal from old chain:** What's the UX for claiming on the new chain?

### Brand & Community
- [ ] **Token name:** Stay "$OMNOM" or rebrand?
- [ ] **NFT integration:** Should the DAO issue NFTs for governance badges, staking tiers, or community membership?
- [ ] **Social treasury:** Should a portion of funds be earmarked for community events, contests, and content creation?
- [ ] **Partnership philosophy:** Should $OMNOM partner with other DAOs, meme projects, or stay independent?

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **DRC-20** | Token standard on Dogechain (similar to ERC-20 on Ethereum). |
| **Merkle Tree** | Cryptographic proof structure used to verify snapshot eligibility without exposing all addresses. |
| **LP (Liquidity Provider)** | User who deposits paired tokens into a DEX pool to enable trading. |
| **Quadratic Voting** | Voting system where cost per vote increases quadratically, reducing whale influence. |
| **Timelock** | Delay between a governance vote passing and execution, allowing community review. |
| **Multi-sig** | Wallet requiring multiple signers to authorize transactions (e.g., 3-of-5). |
| **Impermanent Loss** | Value LPs lose when deposited token prices diverge from deposit ratio. |
| **OP Stack** | Open-source toolkit for building Ethereum Layer 2 rollups (used by Optimism, Base, etc.). |

---

*Document version: 1.0*
*Last updated: June 2026*
*Status: Draft — pending community review*
*Next step: Community discussion → Round 1 governance vote*
