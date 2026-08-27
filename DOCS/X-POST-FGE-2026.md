# OMNOM DAO — Foundational Governance Election Launch Announcement

**Status**: Ready to publish on T-0 (2026-08-29 00:00 UTC)
**Author**: OMNOM DAO core team
**Domain**: https://dao.omnom.dog

---

## Long-Form Single Post (X Premium — ≤ 2000 chars)

> 🗳️ **The OMNOM DAO Foundational Governance Election opens today.**
>
> For 14 days — **Aug 29 → Sep 12** — every $OMNOM holder (25,686 wallets at block 59,922,100) decides how this DAO governs itself. Each eligible wallet casts exactly one ballot. No plutocracy, no proxies — one wallet, one vote. The winning choice becomes the voting math for every proposal after today.
>
> **What's live at dao.omnom.dog:**
> 🔐 SIWE sign-in via RainbowKit (MetaMask, Rabby, Brave, WalletConnect)
> 🪪 Frozen snapshot — 7 tiers (Kraken → Seahorse), every eligible wallet pre-verified
> 🗳️ Gasless ballots, editable until close, full audit trail
> 💬 Threaded comments + reactions on every proposal
> 📊 Live tally on every active proposal
> 🛡️ HSTS + CSP, fail-closed rate limits, public audit log of admin actions
> 📜 Zod-validated inputs on every endpoint
>
> **Timeline**
> • T-7d (Aug 22): Turso prod migrated, snapshot hash pinned
> • T-3d (Aug 26): Playwright sweep at 5 viewports, admin-wallet smoke
> • T-0  (Aug 29): Election opens at 00:00 UTC
> • T+7d (Sep 5): Mid-election transparency report
> • T+14d (Sep 12): Election closes — winning math locks in
>
> **Why this matters:** foundational means precedent. The math you pick shapes every vote that follows.
>
> Vote: https://dao.omnom.dog/governance-vote
> Docs: https://dao.omnom.dog/faq
>
> Built on Next.js 16, Turso, Wagmi v2 — deployed to Vercel. 100% free / open source.
>
> $OMNOM 🐕🗳️

---

## Thread Version (15 tweets)

### 1/15 🧵
**The OMNOM DAO Foundational Governance Election opens today.**

For 14 days — Aug 29 → Sep 12 — every $OMNOM holder decides how this DAO governs itself.

25,686 eligible wallets. One ballot each. No proxies. No plutocracy. The choice you make shapes every vote that follows. 🗳️

### 2/15
**The four choices on the ballot:**

• Linear token voting — 1 token = 1 vote (whale-friendly)
• One-wallet-one-vote — equal voice for every holder (egalitarian)
• Tiered voting — 7 cohorts, cross-cohort required (balanced)
• Quadratic — √balance as voting power (anti-plutocratic)

Pick deliberately. Foundational votes set precedent.

### 3/15
**What's live at dao.omnom.dog right now:**

🔐 SIWE sign-in via RainbowKit (MetaMask, Rabby, Brave, WalletConnect)
🪪 Frozen snapshot — 7 tiers (Kraken → Seahorse)
🗳️ Gasless ballots, editable until close
💬 Threaded comments + reactions
📊 Live tally on every active proposal

### 4/15
**Snapshot integrity:**

The electorate is frozen at block 59,922,100 (2026-06-07). Every eligible wallet is pre-verified against the ever-held master list.

Source: DBOT-DC/omnom-snapshot @ 2c38af77
Total: 25,686 wallets
Distribution: 1 Kraken / 3 Whales / 30 Dolphins / 326 Sharks / 1,078 Octopuses / 1,701 Crabs / 22,547 Seahorses

SHA-256 pinned. Audit-able. Immutable.

### 5/15
**Security:**

🛡️ HSTS preload + CSP
🛡️ Fail-closed rate limiting (KV-backed)
🛡️ Admin wallet pinned: 0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a
🛡️ Public audit log of every admin action
🛡️ Zod-validated inputs on every endpoint

Known limitation: single-admin (multisig in roadmap). Documented at /security-architecture.

### 6/15
**How the ballot works:**

1. Connect wallet → sign SIWE message
2. Verify you're in the snapshot (instant lookup)
3. Pick your choice (Quadratic / 1W1V / Tiered / Linear)
4. Sign ballot → recorded in immutable audit trail

You can change your vote as many times as you want before Sep 12. Final ballot = last signed choice.

### 7/15
**Timeline (already executed):**

✅ T-7d — Turso prod migrated, snapshot SHA pinned
✅ T-3d — Playwright sweep at 5 viewports, admin smoke test
🔴 T-0  — Election opens today (00:00 UTC)
📅 T+7d — Mid-election transparency report
📅 T+14d — Election closes; winning math locks in

### 8/15
**Why this matters:**

Foundational means precedent.

The math you pick shapes how every proposal after Sep 12 is decided. The treasury. The guidelines. The technical direction. The tokenomics.

Whoever votes (or doesn't) sets the rules for every vote that follows.

Pick deliberately.

### 9/15
**What we built (the engineering side):**

• Next.js 16 App Router + React 19
• Turso (libSQL) for relational data
• Wagmi v2 + viem v2 + RainbowKit v2
• Tiptap WYSIWYG editor (markdown serialised)
• Server-side snapshot verification (SHA-256 pinned)
• 36 unit/integration tests + Playwright E2E
• Deploy: Vercel (Edge proxy + Node API routes)

### 10/15
**What we deliberately did NOT build:**

❌ Token-weighted voting for this election (1W1V by design)
❌ Snapshot.org as primary (CSV-anchored snapshot more defensible)
❌ On-chain execution (dead-chain snapshot; advisory governance)
❌ Multisig (single-admin acknowledged; hardware wallet custody)
❌ Gas fees (gasless ballots via SIWE)

Advisory first. On-chain once we have a live chain + multisig.

### 11/15
**After the election:**

T+15d — Winning math applied to `proposal_templates`
T+15d — Self-serve proposal creation unlocked for verified holders
T+16d — Public audit published (CSV + IPFS)
T+16d — Tagged release `election-final-<date>`

### 12/15
**For builders:**

We're open-sourcing the entire platform at the end of the election. Frozen snapshot, gasless ballots, audit-logged admin, threaded comments — all of it.

If you're launching a DAO on a dead-chain snapshot, this is the template. If you're running governance on a live chain, the audit-log + rate-limit primitives are reusable.

### 13/15
**For holders:**

Three steps:

1. Go to https://dao.omnom.dog/governance-vote
2. Connect your wallet (MetaMask, Rabby, Brave, WalletConnect)
3. Sign the SIWE message, verify, pick your choice

That's it. ~90 seconds.

### 14/15
**For skeptics:**

You're right to be skeptical. Single-admin, off-chain, advisory. We get it.

The mitigations:
• Public audit log of every admin action
• SHA-256 pinned snapshot (no roll-back)
• Append-only ballot events (no silent ballot changes)
• Hardware wallet custody of admin key
• Public CI on every commit

Multisig + on-chain execution are the v2 roadmap. v1 ships today.

### 15/15
**Vote:**

https://dao.omnom.dog/governance-vote

**Docs:**
https://dao.omnom.dog/faq
https://dao.omnom.dog/snapshot-explorer

**Audit:**
https://dao.omnom.dog/audit-log

$OMNOM 🐕🗳️

---

## Image / Visual Suggestions

For the announcement tweet (and pinned tweet), attach one of:

1. **Hero banner** — 1200×675 with title "Foundational Governance Election", OMNOM DAO logo, dates "Aug 29 → Sep 12", and "25,686 eligible wallets"
2. **Vote tally preview** — Live screenshot of `/governance-vote` UI with placeholder tallies (refresh after a few hours)
3. **Architecture diagram** — Simple block diagram: Wallet → SIWE → Snapshot → Ballot → Audit Log → Tally

Recommended: option #1 (hero banner) for the single-post; option #3 for tweet 9/15.

---

## Hashtag Strategy

Primary:
- `$OMNOM` (always capitalized with $)
- `#DAO` `#Governance` `#FoundationalElection`
- `#Web3` `#DeFi` `#Snapshot`

Optional (for specific audiences):
- `#CryptoTwitter` `#CT`
- `#DAOVoting` `#OnChainGovernance`

---

## Posting Cadence

- **T-0 (Aug 29 00:00 UTC)** — Main thread (post #1 through #15 as a single thread)
- **T+1d (Aug 30)** — Reminder: "24h in, X% turnout, here's how to vote"
- **T+7d (Sep 5)** — Mid-election transparency report (turnout, tier breakdown, no PII)
- **T+13d (Sep 11)** — Final reminder: "Last 24 hours to vote"
- **T+14d (Sep 12)** — Results announcement + winner + post-election timeline

---

## Cross-Platform Variants

- **Mirror.xyz / Paragraph** — Long-form essay expanding on tweet 9/15 + 10/15 (architecture + deliberate omissions)
- **Telegram** — Pin the single-post variant + a Telegram-specific deep-link to the election page
- **Discord** — Channel announcement + AMA thread pinned for 24h
- **Farcaster** — Cast using the thread, frame the live tally from the API

---

## Notes

- Replace "today" / "Aug 29" placeholders with concrete timestamps on T-0
- The admin wallet address (0x22F4194F…) is public and can be cited verbatim
- The 25,686 figure is verified in the live snapshot — never round
- All URLs use the production domain (`dao.omnom.dog`); localhost or preview URLs are not acceptable