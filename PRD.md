# $OMNOM DAO Governance Platform — Product Requirements Document

---

## Document Metadata

| Field | Value |
|---|---|
| **Document Title** | $OMNOM DAO Governance Platform — PRD |
| **Version** | 1.0.0 |
| **Author** | $OMNOM Community / DBOT-DC |
| **Date** | June 23, 2026 |
| **Status** | Draft — Pending Community Review |
| **Classification** | Public |
| **Repository** | `DBOT-Vault-Final/02-Projects/omnom-dao/` |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Goals](#2-vision--goals)
3. [Problem Statement](#3-problem-statement)
4. [Target Users (Personas)](#4-target-users-personas)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Holder Verification Flow](#7-holder-verification-flow)
8. [Voting Mechanism Design](#8-voting-mechanism-design)
9. [Proposal Types & Lifecycle](#9-proposal-types--lifecycle)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Success Metrics](#11-success-metrics)
12. [Open Questions](#12-open-questions)
13. [Appendix: Snapshot Data & References](#13-appendix-snapshot-data--references)

---

## 1. Executive Summary

The $OMNOM DAO Governance Platform is a **snapshot-based, off-chain governance interface** that empowers $OMNOM token holders to collectively decide the future of their community after the Dogechain sunset. With the chain no longer operational as of June 7, 2026, the platform operates entirely on a point-in-time snapshot (Block 59,922,100) capturing **25,431 holder addresses** and their balances — providing a trustless, verifiable anchor of legitimacy without requiring a live blockchain.

This platform is the critical next step for the $OMNOM community. Vitalik Buterin's public burn of **68.9% of total supply** elevated the project's visibility and meme-cultural significance, but it also concentrated the remaining supply among a small group of holders. The platform must balance the reality of that distribution (a single 🦑 Kraken holding 68.9%; the top 4 wallets — 1 kraken + 3 🐋 Whales — holding ~87.2% of circulating supply) with a governance system that feels fair, transparent, and inviting to every holder — from the largest to the smallest. All verification is **read-only**; no private keys are stored, no transactions are initiated, and no gas fees are required.

---

## 2. Vision & Goals

### Product Vision Statement

> *"A permanent, community-owned governance home for every $OMNOM holder — where your voice scales with your stake, every decision is transparent, and the snapshot is the single source of truth."*

### Primary Goals

- **Holder Empowerment** — Give every verified $OMNOM holder a direct, meaningful say in the project's direction, from chain migration strategy to treasury decisions.
- **Transparent Governance** — All proposals, votes, and results are publicly auditable. No backroom deals; everything happens on-chain (metaphorically) with full transparency.
- **Community-Driven Decisions** — Remove centralized decision-making. The community votes, and the platform executes the collective will. Major decisions (chain relaunch, token migration, dissolution) require formal governance.

### Secondary Goals

- **Education & Onboarding** — Many holders are first-time DAO participants. The platform should educate as much as it governs: explain what a proposal is, how voting works, and why quorum matters.
- **Community Growth** — Attract new observers and interested parties by making governance open and accessible, turning $OMNOM's sunset narrative into a relaunch story.
- **Historical Preservation** — Maintain an immutable record of the $OMNOM community's decisions as the project navigates its post-sunset future.

### What Success Looks Like

**At 6 months:**
- 30%+ of snapshot holders have verified their wallets on the platform
- At least 3 proposals have gone through the full lifecycle (Draft → Active → Closed)
- First major community decision (chain selection or token migration path) is ratified with binding vote
- Telegram group engagement has increased by 25% attributable to governance activity
- Zero critical security incidents

**At 12 months:**
- 50%+ of snapshot holders verified
- Proposal participation rate consistently above 15% of verified holders
- Clear roadmap decision adopted and being executed by the community
- Platform recognized as a model for post-chain-sunset DAO governance
- Delegation system active with at least 10% of supply delegated

---

## 3. Problem Statement

### Dogechain Sunset

On June 7, 2026, Dogechain (chain ID 2000) announced its sunset. All $OMNOM tokens (DRC-20, contract `0xe3fcA919883950c5cD468156392a6477Ff5d18de`, 18 decimals) became effectively frozen — holders still *own* their tokens, but the chain they live on is shutting down. This leaves 25,431 holders with a valuable community asset and no infrastructure to govern its future.

### No Governance Mechanism

There is currently **no formal mechanism** for $OMNOM holders to:
- Signal their preferences on next steps (relaunch on a new chain, migrate to a different token standard, or dissolve)
- Vote on treasury/resource allocation
- Propose and debate ideas in a structured way
- Verify their holdings against an authoritative record

Decisions are currently made informally in the Telegram group (`t.me/omnomtoken_dc`), which is opaque, unstructured, and excludes holders who aren't active in chat.

### The Trust Problem

Who has the authority to decide $OMNOM's future? Without governance, it defaults to whoever is loudest in chat or whoever controls the deployer wallet. The **snapshot** is the answer: a cryptographic, timestamped, on-chain record of who held what at Block 59,922,100 (June 7, 2026 23:59:58 UTC). The platform must use this snapshot as its **sole source of truth** for holder verification.

### The Whale Problem

After Vitalik's burn, the supply distribution is heavily skewed. The single kraken holds 68.9%; the top four wallets (1 kraken + 3 whales) hold ~87.2% of circulating supply:

| Tier | Emoji | Threshold | Count | Share |
|---|---|---|---|---|
| **Kraken** | 🦑 | ≥ 10% of supply | 1 | ~69% |
| **Whale** | 🐋 | ≥ 1% and < 10% | 3 | ~18% |
| **Dolphin** | 🐬 | ≥ 0.1% and < 1% | 30 | ~6% |
| **Shark** | 🦈 | ≥ 0.01% and < 0.1% | 326 | ~6% |
| **Octopus** | 🐙 | ≥ 0.001% and < 0.01% | 1,078 | ~4% |
| **Crab** | 🦀 | ≥ 0.0001% and < 0.001% | 1,701 | ~2% |
| **Seahorse** | 🦄 | < 0.0001% | 22,547 | ~8% |

**Total ever-held wallets:** 25,686. "Fish" is a deprecated legacy enum value (still present in ≤7-day-old JWTs; maps to Seahorse rank; never newly assigned).

Any voting system must acknowledge this reality. Pure token-weighted voting means 4 addresses can outvote 25,000. The platform must surface this tension honestly and implement mechanisms (quorum requirements, delegation, optional quadratic elements) to make governance feel legitimate to all participants.

---

## 4. Target Users (Personas)

### Persona 1: "Whale Watcher" 🐋

- **Name:** Marcus
- **Demographics:** 30-45, software engineer or crypto fund allocator, holds ≥1% of circulating $OMNOM supply
- **Goals:**
  - Protect the value of his significant $OMNOM position
  - Influence major decisions (chain migration, tokenomics)
  - Monitor voting activity and whale sentiment
  - Delegate votes if unable to participate directly
- **Pain Points:**
  - Concerned about governance being manipulated by Sybil attacks or fake wallets
  - Wants to ensure quorum is meaningful, not just whale-driven
  - Needs clear documentation of proposals before committing votes
- **Technical Proficiency:** High — comfortable with MetaMask, signing messages, understanding EVM mechanics
- **Success Means:** Feeling confident that governance outcomes reflect legitimate holder sentiment and that his significant stake translates to proportional influence without enabling tyranny

### Persona 2: "Community Dolphin" 🐬

- **Name:** Priya
- **Demographics:** 22-35, active in crypto Telegram communities, holds ≥ 0.1% and < 1% of $OMNOM supply
- **Goals:**
  - Participate in proposals and feel heard
  - Stay connected to the $OMNOM community's direction
  - Learn about DAO governance through hands-on participation
  - Earn trust in the community through thoughtful contributions
- **Pain Points:**
  - Intimidated by complex governance UIs
  - Unsure if her vote "matters" given whale dominance
  - Doesn't always have time to read full proposals — needs summaries
  - May hold tokens on an exchange and not have direct wallet access
- **Technical Proficiency:** Medium — has used MetaMask, understands the basics of signing messages, may need guidance
- **Success Means:** Voting on at least one proposal per month, feeling her voice contributes to outcomes, and building reputation in the community

### Persona 3: "Seahorse First-Timer" 🦄

- **Name:** Jordan
- **Demographics:** 18-30, college student or early-career, holds < 0.0001% of $OMNOM supply, may have been "airdropped" or bought small amount on a whim
- **Goals:**
  - Find out if their $OMNOM tokens are "worth anything"
  - Participate in at least one vote to feel included
  - Understand what happened to Dogechain and what it means for their tokens
- **Pain Points:**
  - May not remember which wallet holds their OMNOM
  - Overwhelmed by crypto jargon (snapshot, quorum, delegation)
  - Might not have MetaMask installed
  - Low motivation to engage unless the community feels welcoming
- **Technical Proficiency:** Low to Medium — may have used a custodial wallet or exchange, unfamiliar with wallet signing
- **Success Means:** Successfully connecting their wallet, seeing their balance, and casting at least one vote without frustration

### Persona 4: "Lost Wallet Holder" 🔍

- **Name:** Sergei
- **Demographics:** 25-40, long-time crypto participant, holds $OMNOM but has **lost access** to the wallet containing their tokens
- **Goals:**
  - Verify that their address is in the snapshot
  - Understand what options exist for recovering or claiming holdings
  - Monitor governance decisions that could affect their tokens
- **Pain Points:**
  - Cannot sign messages with the wallet (lost seed phrase, forgot password)
  - Needs to search by address rather than connect wallet
  - May be emotionally invested — feels left behind by the sunset
- **Technical Proficiency:** Medium — knows their address, understands the concept, but can't execute transactions
- **Success Means:** Finding their address in the snapshot, understanding what governance decisions are being made, and having a clear path (if any) to reclaim their voice

### Persona 5: "New Observer" 👀

- **Name:** Alex
- **Demographics:** 20-35, crypto enthusiast or researcher, **does NOT hold $OMNOM** but is interested in the project's post-sunset governance experiment
- **Goals:**
  - Browse proposals and discussions publicly
  - Understand how a post-sunset DAO works
  - Evaluate whether to acquire $OMNOM tokens (if a migration path emerges)
  - Follow the project's narrative
- **Pain Points:**
  - Needs transparency into governance without being a holder
  - Wants to understand the context (who burned what, why the chain sunset)
  - May want to participate in non-binding polls or discussions
- **Technical Proficiency:** High — researcher/developer who understands blockchain concepts
- **Success Means:** Being able to read all proposals, vote results, and community discussions without barriers, and gaining enough context to form an informed opinion about the project

---

## 5. User Stories

### Epic 1: Wallet Connection & Verification

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E1-US1 | As a **Seahorse First-Timer**, I want to connect my wallet with a single click, so that I can verify my $OMNOM holdings without confusion. | Given the user clicks "Connect Wallet", When the Web3 modal appears, Then MetaMask, WalletConnect, Coinbase Wallet, and Phantom are all listed as options; the connection completes within 5 seconds on a standard connection. |
| E1-US2 | As a **Lost Wallet Holder**, I want to search for my address manually, so that I can check if I'm in the snapshot without connecting a wallet. | Given the user enters a valid 0x address in the search bar, When the search completes, Then the platform displays: balance at snapshot, rank, holder class, and date of snapshot — all without requiring wallet connection. |
| E1-US3 | As a **Community Dolphin**, I want to sign a message to prove wallet ownership, so that I can unlock voting rights without spending gas. | Given a connected wallet, When the platform requests a signature, Then the message is human-readable ("Verify ownership of wallet [0x...] for $OMNOM DAO at [timestamp]"), NO transaction is broadcast, and the signature completes in <3 seconds. |
| E1-US4 | As a **Whale Watcher**, I want to see a detailed breakdown of my verification status, so that I can confirm the exact balance and rank the snapshot records. | Given a verified whale, When the verification completes, Then the dashboard shows: exact token balance (18-decimal precision), circulating supply percentage, holder rank (#N of 25,686), holder class (🐋), and voting power multiplier. |
| E1-US5 | As a **Seahorse First-Timer**, I want to see a friendly "Not Found" screen if my wallet isn't in the snapshot, so that I understand why and what to do next. | Given a connected wallet not in the snapshot, When verification completes, Then the platform displays: a clear message ("Your wallet was not found in the June 7, 2026 snapshot"), an explanation of the snapshot date/block, a link to Blockscout to verify manually, and a link to the Telegram group for help. |
| E1-US6 | As a **Community Dolphin**, I want to disconnect my wallet, so that I can connect a different one or browse privately. | Given a connected wallet, When the user clicks "Disconnect", Then the session is cleared, all personal data is hidden, and the platform returns to the public view. No residual session data persists after page reload. |
| E1-US7 | As a **New Observer**, I want to browse the platform without connecting a wallet, so that I can explore proposals before deciding to participate. | Given an unconnected visitor, When they navigate the platform, Then all proposals, discussions, and vote results (with the exception of individual holder balances) are visible and accessible. |
| E1-US8 | As a **Whale Watcher**, I want the verification process to use my original Dogechain address, so that my snapshot balance is correctly attributed. | Given a wallet that held OMNOM on Dogechain, When connected via the same address, Then the platform resolves the address against the snapshot CSV and displays the correct balance regardless of current chain state. |

### Epic 2: Holder Dashboard

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E2-US1 | As a **Whale Watcher**, I want to see my total balance, holder class, and voting power at a glance, so that I can quickly understand my governance weight. | Given a verified holder, When the dashboard loads, Then a hero card displays: token balance, holder class badge (🦑🐋🐬🦈🐙🦀🦄), global rank, voting power (tokens × delegation bonus), and % of circulating supply. |
| E2-US2 | As a **Community Dolphin**, I want to see my voting history, so that I can track which proposals I've supported and my participation rate. | Given a verified holder with past votes, When the dashboard loads, Then a "My Votes" section lists all past votes with: proposal title, vote cast (For/Against/Abstain), timestamp, and whether the proposal passed. |
| E2-US3 | As a **Seahorse First-Timer**, I want an onboarding checklist on my dashboard, so that I know what steps to take to fully participate. | Given a newly verified holder, When the dashboard loads, Then an onboarding widget shows: ✅ Wallet Connected, ✅ Verified Holder, ☐ Cast First Vote, ☐ Set Display Name, ☐ Enable Notifications — with clickable links to each action. |
| E2-US4 | As a **Whale Watcher**, I want to see delegation status, so that I can manage who I've delegated votes to or who has delegated to me. | Given a holder with active delegations, When the dashboard loads, Then a delegation panel shows: outgoing delegations (address, tokens delegated, option to revoke) and incoming delegations (total delegated voting power). |
| E2-US5 | As a **Community Dolphin**, I want a quick-link to "Active Proposals" from my dashboard, so that I never miss a vote. | Given any logged-in holder, When the dashboard loads, Then a prominent card shows "Active Proposals" with count and a "Vote Now" CTA linking to the proposals page. |
| E2-US6 | As a **Lost Wallet Holder**, I want to see community-wide snapshot statistics, so that I can understand the holder distribution even without being verified. | Given an unverified visitor, When they view the dashboard, Then aggregate stats display: total holders (25,686), total supply, 7-tier distribution breakdown, and top proposal by participation. |
| E2-US7 | As a **Seahorse First-Timer**, I want educational tooltips explaining each dashboard metric, so that I learn governance concepts as I explore. | Given any dashboard view, When the user hovers/taps on any metric (voting power, quorum, delegation), Then a tooltip appears with a plain-language explanation and a "Learn More" link to the governance docs. |

### Epic 3: Proposal Browsing & Discovery

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E3-US1 | As a **New Observer**, I want to browse all proposals without logging in, so that I can understand the issues being decided. | Given an unauthenticated visitor, When they navigate to `/proposals`, Then all proposals are listed with title, status, vote counts, and time remaining. Full proposal detail is readable. |
| E3-US2 | As a **Community Dolphin**, I want to filter proposals by status, type, and recency, so that I can quickly find what matters to me. | Given any user on the proposals page, When they apply filters, Then proposals re-filter in real-time with options for: Status (Draft/Active/Closed/Passed/Failed), Type (Chain Selection/Tokenomics/Treasury/etc.), and Sort (Newest/Most Popular/Closing Soon). |
| E3-US3 | As a **Whale Watcher**, I want to search proposals by keyword, so that I can find specific topics or referenced addresses. | Given any user, When they type in the search bar, Then results update live, matching against proposal title, description, and comments. Results display with relevance ranking. |
| E3-US4 | As a **Seahorse First-Timer**, I want a "TL;DR" summary on each proposal, so that I can understand the gist without reading a wall of text. | Given a proposal with a description >500 characters, When the proposal detail loads, Then a collapsed "TL;DR" section appears at the top, written by the proposer, limited to 280 characters. |
| E3-US5 | As a **Community Dolphin**, I want to see discussion threads on proposals, so that I can read arguments before voting. | Given any proposal, When the detail page loads, Then a comments section supports threaded replies, with: author display name, holder class badge, timestamp, and upvote/downvote on comments. |
| E3-US6 | As a **New Observer**, I want to see vote distributions visually, so that I can gauge community sentiment at a glance. | Given any proposal (active or closed), When the detail page loads, Then a visual bar chart shows: For (% and token count), Against (% and token count), Abstain (% and token count) — with real-time updates for active proposals. |
| E3-US7 | As a **Whale Watcher**, I want to see who voted and how, so that I can audit governance outcomes for legitimacy. | Given a closed proposal, When the detail page loads, Then a "Votes" tab lists all voters with: display name, holder class, token weight, and vote choice. Privacy toggle allows voters to hide their individual vote (weight still counts). |
| E3-US8 | As a **Community Dolphin**, I want to bookmark proposals, so that I can revisit them later when I have time to vote. | Given a logged-in user, When they click "Bookmark" on a proposal, Then the proposal appears in their "Saved" section on the dashboard, accessible from any device. |

### Epic 4: Proposal Creation

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E4-US1 | As a **Community Dolphin**, I want to create a proposal using a template, so that I can structure my ideas professionally without starting from scratch. | Given a verified holder, When they click "Create Proposal", Then template options appear: Chain Selection, Tokenomics Change, Treasury Allocation, Community Guideline, Technical Spec, General Discussion. Selecting a template pre-fills the form structure. |
| E4-US2 | As a **Whale Watcher**, I want to set a custom voting period and quorum threshold, so that I can calibrate the proposal's governance requirements. | Given a proposer filling out the form, When they reach "Voting Settings", Then they can set: voting period (72h / 7d / 14d from defaults) and quorum (% of total supply, minimum 5%, maximum 50%). System warns if settings deviate significantly from defaults. |
| E4-US3 | As a **Seahorse First-Timer**, I want clear character limits and preview before submitting, so that I don't make formatting mistakes. | Given a proposer filling the form, When they type in any field, Then a live character counter appears (Title: max 120 chars, TL;DR: max 280 chars, Description: max 10,000 chars). A "Preview" button renders the proposal as it will appear to voters. |
| E4-US4 | As a **Community Dolphin**, I want to save a draft and continue later, so that I don't lose work if I can't finish in one session. | Given a proposer with unsaved changes, When they click "Save Draft", Then the proposal is persisted to their account, accessible from the dashboard. Drafts auto-save every 30 seconds. |
| E4-US5 | As a **Whale Watcher**, I want to attach links and references to my proposal, so that I can provide supporting evidence. | Given a proposer filling the description, When they paste a URL, Then the system auto-detects links and renders them as clickable. Markdown formatting is supported (headers, bold, lists, code blocks, images via URL). |
| E4-US6 | As a **Seahorse First-Timer**, I want to see what happens after I submit (the review process), so that I know what to expect. | Given a proposer about to submit, When they click "Submit for Review", Then a confirmation modal explains: "Your proposal will enter Pending Review status. Moderators will review within 48 hours. You'll be notified when it goes live." |
| E4-US7 | As a **Whale Watcher**, I want to edit my proposal after submission (before voting begins), so that I can refine it based on community feedback. | Given a proposal in Draft or Pending Review status, When the proposer clicks "Edit", Then they can modify any field. Changes are logged with a visible "Edited [timestamp]" badge and a revision history accessible to voters. |
| E4-US8 | As a **Community Dolphin**, I want to understand minimum requirements for creating proposals, so that I don't waste time on an attempt that will be rejected. | Given a user viewing the Create Proposal page, When the page loads, Then a requirements card clearly states: must be verified holder, minimum holding of [X] $OMNOM (TBD — see Open Questions), and any other prerequisites. |

### Epic 5: Voting

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E5-US1 | As a **Community Dolphin**, I want to cast a vote (For/Against/Abstain) with one click, so that I can participate quickly and confidently. | Given a verified holder on an active proposal, When they select a vote option and click "Cast Vote", Then a confirmation modal shows: vote choice, voting power being cast, and "This action cannot be changed." On confirm, the vote is recorded with a signature. |
| E5-US2 | As a **Whale Watcher**, I want to see the impact of my vote before casting, so that I can make an informed decision. | Given a whale viewing an active proposal, When they hover over a vote option, Then a preview shows: "Your vote would represent X% of the current tally" and "Y% of total voting power." |
| E5-US3 | As a **Seahorse First-Timer**, I want to understand what For/Against/Abstain means, so that I don't vote incorrectly. | Given any voter on an active proposal, When the voting interface loads, Then each option has a tooltip: "For = Support this proposal," "Against = Oppose this proposal," "Abstain = Participate without affecting outcome (counts toward quorum)." |
| E5-US4 | As a **Whale Watcher**, I want to change my vote before the proposal closes, so that I can revise my position if new information emerges. | Given a voter who has already cast, When they view the proposal, Then a "Change Vote" button appears (available until voting closes). Changing requires a new signature confirmation. |
| E5-US5 | As a **Community Dolphin**, I want to see real-time vote updates after I cast, so that I know the current state of the proposal. | Given a voter who just cast, When they return to the proposal, Then vote tallies update live (poll every 10 seconds, optimistic UI updates). A toast notification confirms "Vote recorded successfully." |
| E5-US6 | As a **Seahorse First-Timer**, I want to receive a reminder if an important proposal is about to close and I haven't voted, so that I don't miss deadlines. | Given a verified holder with notifications enabled, When an active proposal has <24 hours remaining and the user hasn't voted, Then a notification is sent via configured channel (Telegram/email). |
| E5-US7 | As a **Whale Watcher**, I want to vote with delegated tokens, so that if others have delegated to me, their weight is included. | Given a holder with incoming delegations, When they vote, Then the voting power display includes both their own tokens AND delegated tokens. The vote receipt shows a breakdown. |
| E5-US8 | As a **Lost Wallet Holder**, I want to see which proposals I would have been eligible to vote on, so that I understand what I'm missing. | Given an unverified user searching their address, When they view the dashboard, Then a section shows "Proposals Your Holdings Could Vote On" with a message about wallet recovery and delegation options. |

### Epic 6: Profile & Settings

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E6-US1 | As a **Community Dolphin**, I want to set a display name, so that I'm identifiable in proposals and comments instead of just a 0x address. | Given a verified holder, When they navigate to Settings, Then they can set a unique display name (3-30 chars, alphanumeric + underscores). Display name appears on proposals, comments, and the voter list. |
| E6-US2 | As a **Whale Watcher**, I want to toggle privacy settings for my votes and holdings, so that I can control what's publicly visible. | Given a verified holder, When they navigate to Privacy Settings, Then toggles exist for: "Show my holdings publicly" (default: ON), "Show my individual votes" (default: ON), "Show in voter rankings" (default: ON). Each toggle has clear explanation. |
| E6-US3 | As a **Seahorse First-Timer**, I want to connect multiple wallets, so that if my $OMNOM is spread across addresses, all holdings count toward my voting power. | Given a verified holder, When they click "Add Wallet" in Settings, Then they can connect additional addresses. Each address is verified against the snapshot independently. Voting power aggregates across all linked addresses. |
| E6-US4 | As a **Community Dolphin**, I want to manage notification preferences, so that I only receive alerts that matter to me. | Given a verified holder, When they navigate to Notifications, Then they can toggle: Telegram DMs, Email, In-App. Granular controls for: New Proposals, Proposal Closing Soon, Vote Results, Delegation Changes, Comments on My Proposals. |
| E6-US5 | As a **Whale Watcher**, I want to manage delegations from a settings page, so that I can bulk-update delegation in one place. | Given a holder with delegations, When they navigate to Delegations, Then a table shows all incoming/outgoing delegations with: address (masked), amount, date set, and Revoke/Edit actions. |
| E6-US6 | As a **New Observer**, I want to view any public holder's profile, so that I can see their governance participation record. | Given a public profile, When a visitor clicks on a display name, Then the profile shows: holder class badge, number of proposals created, votes cast, participation rate, and public voting history (if privacy allows). |

### Epic 7: Notifications & Alerts

| ID | User Story | Acceptance Criteria |
|---|---|---|
| E7-US1 | As a **Community Dolphin**, I want to receive a Telegram notification when a new proposal goes live, so that I can review and vote promptly. | Given a holder with Telegram notifications enabled, When a proposal transitions to Active status, Then a message is sent to their Telegram via @DBOT_DC_BOT containing: proposal title, TL;DR, type, voting deadline, and a deep link to vote. |
| E7-US2 | As a **Seahorse First-Timer**, I want an in-app notification bell, so that I don't need to enable external channels to stay informed. | Given any logged-in holder, When they receive a notification, Then a bell icon in the nav bar shows an unread count badge. Clicking opens a dropdown with all recent notifications, sorted by timestamp. |
| E7-US3 | As a **Whale Watcher**, I want to receive alerts when a proposal is about to close without reaching quorum, so that I can rally community participation. | Given a holder with alerts enabled, When an active proposal has <24 hours remaining and quorum is not met, Then an alert is sent: "⚠️ Proposal [Title] may not reach quorum. [X]% needed, [Y]% current." |
| E7-US4 | As a **Community Dolphin**, I want to receive results when a proposal closes, so that I know the outcome even if I didn't vote. | Given a holder with results notifications enabled, When a proposal transitions to Closed/Passed/Failed, Then a notification includes: proposal title, final vote counts, quorum status, and a link to the full results. |
| E7-US5 | As a **Whale Watcher**, I want to be notified if someone delegates tokens to me, so that I'm aware of increased responsibility. | Given a holder with delegation alerts enabled, When a new incoming delegation is confirmed, Then a notification shows: delegator address (masked), token amount, and a link to manage delegations. |
| E7-US6 | As a **Seahorse First-Timer**, I want a weekly digest email summarizing DAO activity, so that I can catch up even if I miss individual notifications. | Given a holder with email enabled, When the weekly digest fires (configurable day/time), Then an email includes: new proposals this week, active proposals closing soon, passed/failed results, and participation statistics. |

---

## 6. Functional Requirements

### FR-1: Wallet Connection

- **FR-1.1** Support **MetaMask** (browser extension and mobile app) via `window.ethereum` provider injection.
- **FR-1.2** Support **WalletConnect** v2 via QR code scanning and deep linking for mobile wallets.
- **FR-1.3** Support **Coinbase Wallet** via Coinbase Wallet SDK and WalletConnect fallback.
- **FR-1.4** Support **Phantom** wallet (important for future multi-chain support).
- **FR-1.5** Wallet connection must persist across page navigation (session-based, cleared on disconnect or tab close).
- **FR-1.6** If a user's wallet provider changes (e.g., MetaMask is installed after initial visit), the connection modal must detect and offer the new provider.
- **FR-1.7** Connection must support **multiple simultaneous wallets** linked to a single profile.
- **FR-1.8** If wallet connection fails, a retry mechanism with clear error messages must be provided (timeout after 60 seconds).

### FR-2: Snapshot Verification

- **FR-2.1** The snapshot data source is a **CSV file** containing all 25,431 holder addresses and their balances at Block 59,922,100 (June 7, 2026 23:59:58 UTC).
- **FR-2.2** The CSV must be **hash-verified** on platform startup against a known SHA-256 checksum published in the platform's repository and on-chain (Dogechain transaction reference).
- **FR-2.3** Verification flow: backend receives a signed message, extracts the Ethereum address, performs a **case-insensitive lookup** against the snapshot CSV.
- **FR-2.4** Three possible outcomes:
  - **Verified Holder:** address found in snapshot → return balance, rank, class
  - **Not Found:** address not in snapshot → return friendly message with Blockscout link
  - **Error:** signature invalid, network failure, or timeout → return error message with retry option
- **FR-2.5** The lookup must complete in **<500ms** for any single address (indexed database, not linear CSV scan).
- **FR-2.6** The snapshot data must be **immutable** — no modifications after deployment. Any updates require a new platform deployment with explicit changelog.
- **FR-2.7** Public API endpoint for address lookup (no auth required) for third-party integrations.

### FR-3: Holder Dashboard

- **FR-3.1** Display **exact token balance** from snapshot (18-decimal precision, formatted to human-readable values).
- **FR-3.2** Display **holder rank** (e.g., "#347 of 25,686").
- **FR-3.3** Display **holder class badge** (7-tier model):
  - 🦑 **Kraken:** ≥ 10% of total supply
  - 🐋 **Whale:** ≥ 1% and < 10% of total supply
  - 🐬 **Dolphin:** ≥ 0.1% and < 1% of total supply
  - 🦈 **Shark:** ≥ 0.01% and < 0.1% of total supply
  - 🐙 **Octopus:** ≥ 0.001% and < 0.01% of total supply
  - 🦀 **Crab:** ≥ 0.0001% and < 0.001% of total supply
  - 🦄 **Seahorse:** < 0.0001% of total supply
- **FR-3.4** Display **voting power** (see FR-5 for calculation method).
- **FR-3.5** Display **voting history** (proposals voted on, choices made, timestamps).
- **FR-3.6** Display **participation rate** (votes cast / proposals eligible to vote on).
- **FR-3.7** Show **onboarding checklist** for new users with completion tracking.
- **FR-3.8** Show **delegation summary** (incoming and outgoing, with management links).
- **FR-3.9** Aggregate dashboard for public view showing community-wide statistics.

### FR-4: Proposal System

- **FR-4.1** **Create:** Verified holders can create proposals using templates or from scratch. Minimum holding threshold TBD (see Open Questions).
- **FR-4.2** **Edit:** Proposers can edit proposals in Draft or Pending Review status. All edits are logged with timestamps.
- **FR-4.3** **Comment:** Any verified holder can comment on proposals. Comments support Markdown formatting and threaded replies.
- **FR-4.4** **Vote:** Verified holders can cast one vote per proposal (For/Against/Abstain). Vote changes allowed any time while voting is open (until voting closes).
- **FR-4.5** **Delegate:** Holders can delegate their voting power to any other verified holder. Delegation is revocable at any time.
- **FR-4.6** **Moderate:** Moderators can flag, hide, or remove spam/abusive comments and proposals. Actions are logged.
- **FR-4.7** **Search:** Full-text search across proposal titles, descriptions, and comments.
- **FR-4.8** **Filter:** By status, type, date range, and proposer.
- **FR-4.9** **Sort:** By newest, most votes, closing soon, most comments.
- **FR-4.10** **Bookmark:** Holders can save proposals for later reference.

### FR-5: Voting Mechanism

> **Recommendation: Quadratic-Token Voting (QTV) with configurable base weights.**

The voting mechanism is the single most consequential design decision for this platform. After thorough analysis of the supply distribution, we recommend a **hybrid approach** that balances influence proportionality with anti-whale safeguards:

- **Base voting power = sqrt(token_balance) × 10⁹** (normalized so that even Seahorse holders have meaningful votes)
- This means:
  - A Whale with 10,000,000 tokens gets voting power of **~3,162**
  - A Dolphin with 100,000 tokens gets voting power of **~316**
  - A Shark with 10,000 tokens gets voting power of **~100**
  - A Seahorse with 1,000 tokens gets voting power of **~31.6**
  - A Seahorse with 100 tokens gets voting power of **~10**
- **Delegated tokens are NOT square-rooted** — they transfer voting power directly (prevents delegation gaming)
- **Quorum = 20% of total supply** (in raw tokens, not voting power) must participate for a result to be binding. If quorum is not met, the proposal is marked "Failed — Quorum Not Met."
- **Pass threshold = 60% of voting power cast** must be "For" (simple majority is insufficient given whale concentration)

**Rationale:**
- Pure 1-token-1-vote gives the top 4 wallets (1 kraken + 3 whales) absolute control (~87.2% of supply). This is mathematically democratic but practically oligarchic.
- Pure one-person-one-vote gives 22,547 Seahorses ~99.98% of votes, which may not align with the economic interests of the project.
- Quadratic voting preserves the *direction* of token-weighted influence (whales still have the most power) while dramatically compressing the ratio (from 100,000:1 to ~1,000:1). A coalition of sharks/dolphins can meaningfully challenge a whale.

**See Section 8 for full analysis and comparison.**

### FR-6: Proposal Lifecycle

| State | Description | Allowed Actions | Duration |
|---|---|---|---|
| **Draft** | Proposer is writing the proposal. Visible only to proposer. | Edit, Delete, Submit for Review | Unlimited |
| **Pending Review** | Submitted, awaiting moderator approval. Visible to all as "Under Review." | Moderator: Approve, Reject (with reason). Proposer: Edit, Withdraw | Max 7 days (auto-reject if not reviewed) |
| **Active** | Open for voting. Visible to all. | Vote, Comment, Delegate | 72 hours (default) / 7 days / 14 days |
| **Closed** | Voting period ended. Results final. | View results, Comment (read-only discussion continues) | Permanent |
| **Passed** | Sub-status of Closed. Quorum met, threshold exceeded. | Execute (if applicable), Archive | Permanent |
| **Failed** | Sub-status of Closed. Either quorum not met or threshold not reached. | Archive, Proposer may create revised proposal | Permanent |
| **Expired** | Sub-status of Closed. Proposal was Active but a motion to extend was not passed. | Archive | Permanent |

### FR-7: User Profiles

- **FR-7.1** Each verified holder has a **public profile** at `/profile/[address]` or `/profile/[display-name]`.
- **FR-7.2** Profile fields: display name (required, unique), wallet address (auto, masked), holder class badge, join date (first verification), bio (optional, max 500 chars).
- **FR-7.3** Privacy controls: holders can toggle visibility of voting history, holdings, and voter list presence.
- **FR-7.4** Governance stats: proposals created, votes cast, participation rate, reputation score (based on constructive contributions).
- **FR-7.5** Linked wallets: if a holder has connected multiple addresses, all are shown (balance aggregated, individual addresses hidden unless user opts in).

### FR-8: Notifications

- **FR-8.1** **Telegram integration:** Via @DBOT_DC_BOT — user sends `/start` to bot, bot generates a unique code, user enters code on platform to link. Messages sent for: new proposals, closing reminders, results.
- **FR-8.2** **Email integration:** Optional, requires email address in profile settings. Confirm-opt-in with verification email.
- **FR-8.3** **In-app notifications:** Bell icon in navigation with unread count badge and notification dropdown.
- **FR-8.4** **Notification types:** New Proposal, Proposal Closing Soon (<24h), Vote Results, Delegation Received/Revoked, Comment on My Proposal, Moderator Action on My Proposal.
- **FR-8.5** Users must be able to configure which notification types go to which channel (e.g., Telegram for urgent, email for weekly digest).

### FR-9: Search & Filtering

- **FR-9.1** **Proposal search:** Full-text search indexed on title, description, TL;DR, and comments. Results ranked by relevance, filterable by status/type.
- **FR-9.2** **Address search:** Any user can search for a 0x address to view public profile and snapshot data.
- **FR-9.3** **Holder directory:** Browseable list of verified holders (with privacy respect), sortable by balance, rank, participation rate.
- **FR-9.4** **Tag system:** Proposals can be tagged (e.g., #chain-migration, #tokenomics, #treasury) for categorization and discovery.

### FR-10: Admin & Moderation

- **FR-10.1** **Moderator role:** Assigned to trusted community members (initially: core team). Can approve/reject proposals, hide comments, flag abuse.
- **FR-10.2** **Admin role:** Full platform control. Can assign moderators, update platform settings, publish announcements.
- **FR-10.3** **Spam prevention:** Rate limits on proposal creation (max 3 per week per holder), comment rate limits, and automatic spam detection (duplicate content, known spam patterns).
- **FR-10.4** **Appeals process:** Moderated actions can be appealed by the affected user. Appeals are reviewed by admins.
- **FR-10.5** **Audit log:** All moderator and admin actions are logged with timestamp, actor, action, and target. Log is publicly viewable.
- **FR-10.6** **Initial moderator list:** TBD by community consensus (likely: original $OMNOM deployer, active Telegram admins, Vitalik-recognized contributors).

---

## 7. Holder Verification Flow

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    HOLDER VERIFICATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

STEP 1: User clicks "Connect Wallet" (prominent CTA in header)
         │
         ▼
STEP 2: Web3 Modal Opens
         ├── MetaMask (detected if installed)
         ├── WalletConnect (QR code / deep link)
         ├── Coinbase Wallet
         └── Phantom
         │
         ▼
STEP 3: User selects wallet provider and connects
         │
         ▼
STEP 4: Platform displays: "Sign a message to prove ownership"
         │
         │  Message text (EIP-4361 / SIWE format):
         │
         │  "Verify ownership of wallet 0xABC...123 for
         │   $OMNOM DAO Governance Platform.
         │   Timestamp: 2026-06-23T12:00:00Z
         │   This does NOT transfer any tokens or cost gas."
         │
         ▼
STEP 5: User signs message in their wallet (NO transaction, NO gas)
         │
         ▼
STEP 6: Signature sent to backend
         │
         ├── Backend recovers signer address from signature
         ├── Performs case-insensitive lookup against snapshot DB
         │
         ▼
STEP 7: Three possible outcomes:
         │
         ├── ✅ VERIFIED HOLDER
         │   ├── Show balance from snapshot
         │   ├── Show rank (#N of 25,431)
         │   ├── Show class badge (🐋/🐬/🐟)
         │   ├── Calculate and display voting power
         │   ├── Redirect to Holder Dashboard
         │   └── Store session (JWT, expires in 24h, renewable)
         │
         ├── ❌ NOT FOUND
         │   ├── Display friendly message:
         │   │   "Your wallet was not found in the $OMNOM snapshot
         │   │    taken on June 7, 2026 at Block 59,922,100."
         │   ├── Explain: tokens may be on a different address,
         │   │   may have been acquired after the snapshot, or
         │   │   the wallet was not connected to Dogechain
         │   ├── Provide link to Blockscout to verify manually:
         │   │   https://dogechain.blockscout.com/address/0x...
         │   ├── Offer "Try Another Wallet" button
         │   ├── Offer "Search by Address" option
         │   └── Link to Telegram for help
         │
         └── ⚠️ ERROR
             ├── Display error message with reason
             ├── Offer "Retry" button
             └── If persistent, link to Telegram support
```

### Critical Design Principles

- **Read-Only:** The platform NEVER requests a transaction. Only message signing (EIP-4361 / SIWE). No gas fees, no token transfers.
- **No Private Keys:** The platform never receives, stores, or transmits private keys. Only signed messages.
- **Session Security:** Authenticated sessions use JWT tokens with 24-hour expiry. Refresh via re-signing.
- **Multi-Wallet:** Users can link multiple addresses to aggregate holdings for voting power.
- **Privacy-First:** Verification status is private by default. Users opt-in to public display.

---

## 8. Voting Mechanism Design

### Comparison of Voting Systems

| Criteria | 1-Token-1-Vote | Quadratic Voting | One-Person-One-Vote | **Recommended: Hybrid QTV** |
|---|---|---|---|---|
| **Whale influence** | 🐋 3 whales = ~18% of supply (~87.2% circulating with kraken) | 🐋 3 whales = ~40% of effective votes | 🐋 3 whales = 0.012% of votes | 🐋 3 whales = ~35-45% of effective votes |
| **Shark influence** | 🦈 326 holders = ~6% of supply | 🦈 326 holders = ~25% of effective votes | 🦈 326 holders = ~1.3% of votes | 🦈 326 holders = ~25% of effective votes |
| **Seahorse influence** | 🦄 22,547 holders = ~8% of supply | 🦄 22,547 holders = ~20% of effective votes | 🦄 22,547 holders = ~98.7% of votes | 🦄 22,547 holders = ~20% of effective votes |
| **Economic alignment** | ✅ High — voting scales with stake | ⚠️ Medium — diluted but directional | ❌ Low — decoupled from holdings | ✅ High — direction preserved, ratio compressed |
| **Anti-plutocracy** | ❌ None | ✅ Significant | ✅ Total | ✅ Moderate to Strong |
| **Sybil resistance** | ✅ High (tokens cost money) | ⚠️ Moderate (splitting wallets reduces power) | ❌ None (splitting = more votes) | ✅ High (sqrt + delegation rules prevent gaming) |
| **Complexity** | ✅ Simple | ⚠️ Medium — needs explanation | ✅ Simple | ⚠️ Medium — needs good UX |
| **Legitimacy perception** | ⚠️ "Whales decide everything" | ✅ "Everyone's voice matters" | ⚠️ "Small holders override economics" | ✅ "Influence proportional but not absolute" |

### Recommended System: Hybrid Quadratic-Token Voting (QTV)

**Formula:**
```
voting_power = floor(sqrt(raw_token_balance / 10^18)) × voting_multiplier

where:
  - raw_token_balance = tokens held at snapshot (18 decimals)
  - voting_multiplier = 1.0 (base), adjustable per proposal type by governance
```

**Example Distribution:**

| Holder | Raw Balance | Voting Power (QTV) | Share of Total Voting Power |
|---|---|---|---|
| 🦑 Kraken #1 | ~44,630,000,000 | 211,235 | ~44% |
| 🐋 Whale #2 | ~5,470,000,000 | 73,960 | ~15% |
| 🐋 Whale #3 | ~5,280,000,000 | 72,660 | ~15% |
| 🐋 Whale #4 | ~1,030,000,000 | 32,090 | ~7% |
| 🐬 All Dolphins (30) | ~80,000,000 total | ~8,944 each | ~6% total |
| 🦈 All Sharks (326) | ~90,000,000 total | ~1,660 each | ~6% total |
| 🦄 All Seahorses (22,547) | ~320,000,000 total | ~119 each | ~7% total |

*(Approximate figures for illustration — exact distribution requires snapshot analysis)*

**Anti-Whale Safeguards:**

1. **Quorum requirement:** 20% of total supply must participate (in raw tokens, not voting power) for results to be binding. Whales alone can meet this, but it ensures the decision has broad economic backing.
2. **Supermajority threshold:** 60% of voting power cast must be "For." Prevents 51% whale coalitions from forcing narrow wins.
3. **Delegation transparency:** All delegations are public. Whale-to-whale delegation is tracked and surfaced.
4. **Time-lock on delegation:** New delegations take effect after a 24-hour delay (prevents last-minute delegation swaps).
5. **Proposal veto:** If 30% of unique holders (by count, not tokens) vote "Against," a cooling-off period of 7 days is triggered before the proposal can be re-submitted.

**Voting Period Options:**

| Proposal Type | Default Voting Period | Minimum | Maximum |
|---|---|---|---|
| Chain Selection | 7 days | 7 days | 14 days |
| Tokenomics Change | 7 days | 7 days | 14 days |
| Treasury Allocation | 72 hours | 72 hours | 7 days |
| Community Guideline | 72 hours | 72 hours | 7 days |
| Technical Specification | 72 hours | 72 hours | 7 days |
| General Discussion | 72 hours | 72 hours | 7 days |

**Delegation Rules:**

- Any verified holder can delegate 100% of their voting power to any other verified holder.
- Partial delegation (e.g., delegate 50% of power) is NOT supported in v1 (complexity concern).
- Delegators retain the right to override and vote directly on any proposal (overrides delegation for that specific proposal).
- Delegations are publicly visible and logged.
- Revocation is instant (no time-lock on revocation, only on new delegation).
- Maximum incoming delegations per address: 500 (to prevent single points of failure and spam).

---

## 9. Proposal Types & Lifecycle

### Proposal Types

| Type | Description | Quorum Required | Voting Period | Who Can Create | Vote Required to Pass |
|---|---|---|---|---|---|
| **Chain Selection** | Vote on which blockchain to migrate/relaunch on (e.g., Ethereum L2, Solana, new L1) | 25% of total supply | 7 days (min) | Verified holders with ≥0.01% supply | 60% supermajority |
| **Tokenomics Change** | Modify supply, distribution, burning, or staking mechanisms | 25% of total supply | 7 days (min) | Verified holders with ≥0.01% supply | 60% supermajority |
| **Treasury/Resource Allocation** | Allocate community resources (funds, developer bounties, marketing budget) | 15% of total supply | 72 hours (min) | Any verified holder | Simple majority (>50%) |
| **Community Guideline** | Establish or modify community rules, codes of conduct, or processes | 10% of total supply | 72 hours (min) | Any verified holder | Simple majority (>50%) |
| **Technical Specification** | Approve technical designs, smart contract changes, or infrastructure decisions | 15% of total supply | 72 hours (min) | Verified holders with ≥0.01% supply | 60% supermajority |
| **General Discussion** | Non-binding polls, sentiment checks, community feedback | 5% of total supply | 72 hours (min) | Any verified holder | Simple majority (>50%) |

### Proposal Lifecycle — State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │◄────────────────────┐
                    └──────┬──────┘                     │
                           │ Submit for Review          │ Edit
                    ┌──────▼──────┐                     │
                    │  PENDING    │─────────────────────┘
                    │   REVIEW    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │ Approve    │             │ Reject
              ▼            │             ▼
        ┌──────────┐      │      ┌──────────────┐
        │  ACTIVE  │      │      │   REJECTED   │
        └────┬─────┘      │      └──────────────┘
             │            │
             │ Voting     │
             │ period     │
             │ ends       │
             │            │
    ┌────────┼────────┐   │
    ▼        ▼        ▼   │
┌───────┐ ┌──────┐ ┌──────┴───┐
│PASSED │ │FAILED│ │ EXPIRED  │
└───────┘ └──────┘ └──────────┘
    │        │
    │        └──────► May be revised and re-submitted
    │
    └──────► Executed (if applicable) / Archived
```

### Proposal Templates

Each proposal type has a pre-structured template:

**Chain Selection Template:**
- **Target Chain:** (e.g., "Base (Coinbase L2)")
- **Rationale:** (Why this chain? What are the benefits?)
- **Technical Feasibility:** (Has anyone confirmed bridge/contract compatibility?)
- **Risks:** (Known risks of this choice)
- **Migration Plan:** (High-level steps, timeline)
- **Alternatives Considered:** (Other chains evaluated)

**Treasury Allocation Template:**
- **Amount Requested:** (in $OMNOM or USD equivalent)
- **Recipient:** (address or entity)
- **Purpose:** (What will the funds be used for?)
- **Deliverables:** (What will be produced/delivered)
- **Timeline:** (When will deliverables be completed)
- **Accountability:** (How will the community verify completion)

### Who Can Create Proposals

| Proposal Type | Minimum Holding | Rationale |
|---|---|---|
| Chain Selection | ≥0.01% supply (🦈 Shark+) | High-impact decisions should be proposed by stakeholders |
| Tokenomics Change | ≥0.01% supply (🦈 Shark+) | Economic decisions require meaningful stake |
| Treasury Allocation | Any verified holder | Community should be able to propose resource needs freely |
| Community Guideline | Any verified holder | Inclusive governance for community norms |
| Technical Specification | ≥0.01% supply (🦈 Shark+) | Technical proposals need some domain credibility |
| General Discussion | Any verified holder | Lowest barrier for sentiment gathering |

---

## 10. Non-Functional Requirements

### NFR-1: Security

| Requirement | Specification |
|---|---|
| **Wallet Interaction** | Read-only. Only message signing (SIWE). No `eth_sendTransaction`, no `eth_signTransaction`. Connection audit logged. |
| **Key Management** | Zero private key handling. Platform never requests, stores, or transmits private keys or seed phrases. |
| **Authentication** | JWT-based sessions with 24-hour expiry. Tokens signed with HMAC-SHA256 using a 256-bit secret, rotated weekly. |
| **Snapshot Integrity** | CSV hash verified on every deployment. Database immutable (append-only). Admin cannot modify snapshot data. |
| **Input Sanitization** | All user input sanitized against XSS, SQL injection, and Markdown injection. CSP headers enforced. |
| **Rate Limiting** | API rate limits: 100 req/min per IP, 20 req/min per authenticated user. Proposal creation: max 3/week. Comment: max 30/day. |
| **DDoS Protection** | Cloudflare or equivalent CDN with DDoS mitigation. Auto-scaling during high-traffic events. |
| **Audit Trail** | All state changes (votes, proposals, moderation actions) logged with actor, timestamp, and IP hash. Public audit log viewable by all. |

### NFR-2: Performance

| Requirement | Specification |
|---|---|
| **Page Load Time** | <3 seconds for initial page load (First Contentful Paint) on 3G connection. |
| **API Response Time** | <200ms for p95 of all API calls. Snapshot lookup: <500ms. |
| **Concurrent Users** | Support 25,000 concurrent viewers during active voting periods without degradation. |
| **Real-Time Updates** | Vote tallies update within 10 seconds of a new vote being cast (WebSocket or SSE). |
| **Database Performance** | Snapshot lookup indexed. Query time <50ms for address lookup. |
| **Asset Optimization** | All assets served via CDN. Images WebP-optimized. JS bundle <200KB gzipped (initial load). |
| **Caching** | Proposal list and snapshot stats cached with 60-second TTL. Cache-invalidation on write operations. |

### NFR-3: Accessibility

| Requirement | Specification |
|---|---|
| **WCAG Compliance** | WCAG 2.1 Level AA compliance across all pages. |
| **Keyboard Navigation** | Full keyboard navigability. Tab order logical. Focus indicators visible. |
| **Screen Reader** | All interactive elements have ARIA labels. Charts have text alternatives. |
| **Color Contrast** | Minimum 4.5:1 contrast ratio for all text. No information conveyed by color alone. |
| **Responsive Design** | Mobile-first design. Fully functional on screens 320px–2560px wide. |
| **Dark Mode** | Native dark mode support with system preference detection and manual toggle. |
| **Font Scaling** | UI remains functional at 200% font size without horizontal scrolling. |
| **Language** | English (v1). Architecture supports i18n for future translations. |

### NFR-4: Availability

| Requirement | Specification |
|---|---|
| **Uptime SLA** | 99.9% uptime during active voting periods (max 43 minutes downtime/month). 99.5% overall. |
| **Deployment** | Zero-downtime deployments. Blue-green deployment strategy. Rollback capability within 5 minutes. |
| **Monitoring** | Health checks every 30 seconds. Automated alerting to on-call if uptime drops below threshold. |
| **Backup** | Daily automated database backups. Snapshot CSV stored in 3 redundant locations. |
| **Incident Response** | Documented runbooks for common failure modes. Maximum 30-minute response time for P1 incidents. |

### NFR-5: Scalability

| Requirement | Specification |
|---|---|
| **Snapshot Data** | 25,431 addresses indexed in a relational database (PostgreSQL) with full-text search capability. |
| **Proposal Storage** | Designed for 1,000+ proposals per year without performance degradation. |
| **Comment Threads** | Support 10,000+ comments per proposal without pagination issues. |
| **User Growth** | Architecture supports scaling to 100,000+ verified users without major refactoring. |
| **Geographic Distribution** | CDN-backed static assets. API servers in at least 2 regions (US, EU). |
| **Database Scaling** | Read replicas for query-heavy operations. Write throughput sufficient for 100 votes/second. |

---

## 11. Success Metrics

### Primary KPIs

| Metric | Target (60 days) | Target (6 months) | Target (12 months) | Measurement Method |
|---|---|---|---|---|
| **Holder Verification Rate** | 15% (3,815 holders) | 30% (7,629 holders) | 50% (12,716 holders) | Unique addresses verified / 25,431 total |
| **Proposal Participation Rate** | 10% of verified holders vote on first proposal | 15% sustained across proposals | 20% sustained | Votes cast / Verified holders, per proposal |
| **Voter Turnout (Quorum)** | Meet 20% quorum on first major proposal | Meet quorum on 80%+ of proposals | Meet quorum on 90%+ of proposals | Total voting power participation / Required quorum |
| **DAU During Active Votes** | 500 | 2,000 | 5,000 | Unique authenticated daily visitors during active voting |
| **MAU** | 1,000 | 5,000 | 10,000 | Unique authenticated monthly visitors |
| **Time to First Vote** | <48 hours (median) | <24 hours (median) | <12 hours (median) | Time from verification to first vote cast |

### Secondary KPIs

| Metric | Target | Measurement Method |
|---|---|---|
| **Proposal Creation Rate** | 2-4 proposals per week after launch | Proposals submitted per 7-day period |
| **Comment Engagement** | Average 5+ comments per proposal | Comments per proposal |
| **Delegation Adoption** | 10% of supply delegated by month 6 | Total delegated voting power / Total supply |
| **Notification Opt-In Rate** | 40% of verified holders enable Telegram notifications | Telegram-linked accounts / Verified holders |
| **Telegram Group Growth** | 25% increase in active members attributable to governance | Telegram member count change vs. launch baseline |
| **Proposal Quality Score** | Average 3.5/5 community rating | Community upvotes on proposals (non-binding feedback) |
| **Error Rate** | <1% of verification attempts result in errors | Errors / Total verification attempts |
| **Mobile Usage** | >40% of sessions from mobile devices | Mobile sessions / Total sessions |

### Leading Indicators (Week 1-4 Post-Launch)

- Number of wallets connected per day (target: 50/day average)
- Average time spent on proposals page (target: 3+ minutes)
- Bounce rate (target: <50%)
- Telegram deep-link click-through rate from proposal notifications
- Support ticket volume (target: <10/day, most issues resolvable via self-service)

---

## 12. Open Questions

> *The following items require community input, discussion, or decisions before they can be finalized in the platform specification.*

### Q1: Minimum Holding to Create Proposals

**Current proposal:** 🦈 Shark+ (≥0.01% supply) for high-impact types, any verified holder for low-impact types.
**Needs:** Community vote on whether this threshold is appropriate. Some Seahorse holders may feel excluded from proposal creation. Alternative: any verified holder can create any type, but Shark+ proposals get "Priority Review" status.

### Q2: Non-Holder Viewing Permissions

**Current proposal:** Non-holders can view all proposals, results, and discussions but cannot vote, comment, or create proposals.
**Needs:** Should non-holders be allowed to comment? Some argue this enables broader community engagement; others worry about spam. Consider a "verified commenter" vs. "guest commenter" distinction.

### Q3: Telegram Deep Linking for Notifications

**Current proposal:** @DBOT_DC_BOT sends notifications with deep links (`https://omnom.dao/proposal/[id]`) that open in Telegram's in-app browser.
**Needs:** Confirm @DBOT_DC_BOT has API capacity for this. Determine if we need a dedicated governance bot vs. extending DBOT. Also: should the bot support inline voting (vote directly from Telegram)?

### Q4: Snapshot Dispute Resolution

**Current proposal:** No dispute mechanism in v1 — the snapshot is treated as immutable truth.
**Needs:** What happens if a holder claims their snapshot balance is incorrect? Possible approaches: (a) "trust the snapshot" with Blockscout verification link, (b) formal dispute process with moderator review and on-chain proof, (c) community vote to override. This has significant implications for governance legitimacy.

### Q5: Multi-Wallet Aggregation Rules

**Current proposal:** Users can link multiple wallets and aggregate holdings for voting power.
**Needs:** Should there be a maximum number of wallets per user? How do we prevent abuse (linking wallets that aren't theirs)? Require signature from each wallet independently.

### Q6: Proposal Execution Mechanism

**Current proposal:** v1 is purely off-chain — passed proposals are advisory, not auto-executed.
**Needs:** For future versions, should passed proposals trigger on-chain actions (e.g., if the token migrates, should the governance contract automatically initiate migration)? This depends entirely on which chain is selected in Q7.

### Q7: Chain Selection Timing

**Current proposal:** The first major governance vote should be chain selection.
**Needs:** What's the timeline? Should we vote within 30 days of platform launch? Should there be a "temperature check" (non-binding poll) before a formal vote? What happens if no chain achieves 60% supermajority?

### Q8: Whale Transparency Requirements

**Current proposal:** All votes are public (with privacy toggle).
**Needs:** Should whale votes be *required* to be public? Some whales may want privacy. But transparency of whale voting behavior is critical for community trust. Consider: votes are public by default, whales can opt out, but opting out triggers a public notification ("Whale #2 voted privately on Proposal #7").

### Q9: Governance Token vs. Snapshot Token

**Current proposal:** Governance is based purely on the snapshot — no new token.
**Needs:** If the community migrates to a new chain with a new token, does governance switch to the new token? What about holders who held at snapshot but don't migrate? Their governance rights would be frozen on the old chain. This needs a clear policy.

### Q10: Emergency Decisions

**Current proposal:** No emergency decision mechanism in v1.
**Needs:** What if a critical time-sensitive decision arises (e.g., a chain offers a migration window that closes in 48 hours)? Consider an "emergency proposal" type with 24-hour voting and 35% quorum, triggerable by 3+ Whale/Kraken signatures or a moderator vote.

---

## 13. Appendix: Snapshot Data & References

### Snapshot Details

| Field | Value |
|---|---|
| **Blockchain** | Dogechain (Chain ID: 2000) |
| **Token Standard** | DRC-20 |
| **Contract Address** | `0xe3fcA919883950c5cD468156392a6477Ff5d18de` |
| **Decimals** | 18 |
| **Snapshot Block** | 59,922,100 |
| **Snapshot Timestamp** | June 7, 2026 23:59:58 UTC |
| **Total Holders** | 25,686 (ever-held) |
| **Total Supply (at snapshot)** | ~64,734,666,666 OMNOM (pre-burn) |
| **Burned by Vitalik** | 68.9% of total supply (Kraken alone) |
| **Circulating Supply (post-burn)** | ~31.1% of total supply |

### Holder Distribution (7-Tier Model)

| Tier | Threshold | Count | Est. % of Circulating Supply |
|---|---|---|---|
| 🦑 Kraken | ≥ 10% of supply | 1 | ~69% |
| 🐋 Whale | ≥ 1% and < 10% | 3 | ~18% |
| 🐬 Dolphin | ≥ 0.1% and < 1% | 30 | ~6% |
| 🦈 Shark | ≥ 0.01% and < 0.1% | 326 | ~6% |
| 🐙 Octopus | ≥ 0.001% and < 0.01% | 1,078 | ~4% |
| 🦀 Crab | ≥ 0.0001% and < 0.001% | 1,701 | ~2% |
| 🦄 Seahorse | < 0.0001% | 22,547 | ~8% |

### Top Holders (Post-Burn)

| Rank | Address | Est. Holdings | Notes |
|---|---|---|---|
| #1 | `0x...dead` (burn) | 68.9% of total | Vitalik's public burn |
| #2 | Exchange/CEX address | ~8.47% | Likely distributed across exchange users |
| #3 | Large holder | TBD | Individual or entity |
| #4 | Large holder | TBD | Individual or entity |

### Community Links

- **Telegram Group:** [t.me/omnomtoken_dc](https://t.me/omnomtoken_dc)
- **Telegram Bot:** [@DBOT_DC_BOT](https://t.me/DBOT_DC_BOT)
- **Blockscout (Dogechain):** `https://dogechain.blockscout.com/`
- **Token Contract:** `0xe3fcA919883950c5cD468156392a6477Ff5d18de`

### Key Dates

| Event | Date |
|---|---|
| Dogechain sunset announcement | June 7, 2026 |
| Snapshot taken | June 7, 2026 23:59:58 UTC |
| Vitalik burn transaction | Pre-sunset (exact date TBD from on-chain data) |
| PRD v1.0 | June 23, 2026 |
| Platform target launch | Q3 2026 (TBD) |
| First governance vote | TBD (post-launch, within 30-60 days) |

---

*This PRD is a living document. It will be updated as community input is received, technical constraints are validated, and the $OMNOM governance experiment evolves. All changes will be tracked in version history.*

**Document End — PRD v1.0.0**
