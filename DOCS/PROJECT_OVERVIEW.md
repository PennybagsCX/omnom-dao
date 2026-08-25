---
title: "OMNOM DAO — Project Overview"
description: "High-level project overview of the $OMNOM DAO snapshot-based governance platform: origin, mission, personas, holder tiers, roadmap, and success metrics."
version: "Draft v1.0.0"
date: "2026-06"
status: "Draft — Pending Community Review"
category: "Explanation"
audience: "All contributors, community members, and observers"
---

# OMNOM DAO — Project Overview

| Field | Value |
|---|---|
| **Version** | Draft v1.0.0 |
| **Date** | June 2026 |
| **Status** | ![Status: Draft](https://img.shields.io/badge/status-Draft%20%E2%80%94%20Pending%20Review-yellow) |
| **Document Type** | High-Level Project Overview (Explanation) |
| **Implementation Truth** | [`DESIGN.md`](../DESIGN.md) / [`DATA-MODEL.md`](../DATA-MODEL.md) |

> **TL;DR** — OMNOM DAO is a snapshot-based, off-chain governance platform that gives the **25,431 holders** of $OMNOM (a DRC-20 token frozen after the Dogechain sunset on June 7, 2026) a transparent, stake-weighted voice in their project's future. After Vitalik Buterin publicly burned **68.9%** of total supply, the remaining holders were left with no live chain and no governance mechanism. This platform anchors legitimacy in a single immutable snapshot taken at **Block 59,922,100** — no smart contracts, no gas fees, no transactions — just verified identity and collective decision-making. All governance is **advisory** in v1; proposals that pass express community will rather than auto-executing on-chain.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Background & Origin](#2-project-background--origin)
3. [Mission, Vision & Core Values](#3-mission-vision--core-values)
4. [Target Audience & Personas](#4-target-audience--personas)
5. [Platform at a Glance](#5-platform-at-a-glance)
6. [Holder Classification System](#6-holder-classification-system)
7. [Token Summary](#7-token-summary)
8. [Roadmap Snapshot](#8-roadmap-snapshot)
9. [Success Metrics](#9-success-metrics)
10. [Community & Resources](#10-community--resources)
11. [Open Decisions (Abridged)](#11-open-decisions-abridged)
12. [Document Cross-References](#12-document-cross-references)

---

## 1. Executive Summary

**What it is.** OMNOM DAO is a **snapshot-based, off-chain governance interface** that lets $OMNOM token holders collectively decide the future of their community after the Dogechain sunset. It operates entirely against a frozen, point-in-time snapshot of token balances — no live blockchain is required.

**Why it exists.** On **June 7, 2026**, Dogechain (chain ID 2000) announced its sunset. The chain is no longer operational, leaving every $OMNOM holder's tokens effectively frozen. Vitalik Buterin's public burn of **68.9% of total supply** concentrated the remaining circulating supply among a small group and heightened the need for legitimate, transparent coordination. Prior to this platform, decisions were made informally and opaquely in Telegram chat.

**What it enables.** The platform gives every verified holder — from the largest whale to the smallest fish — a direct, stake-weighted say in major decisions (chain migration, tokenomics, treasury). It turns $OMNOM's sunset narrative into a community-owned relaunch story, with the snapshot as the single, cryptographic source of truth.

---

## 2. Project Background & Origin

### The Dogechain Sunset

$OMNOM is a **DRC-20** token originally deployed on **Dogechain (chain ID 2000)**. On **June 7, 2026**, Dogechain announced its sunset; the blockchain is now **no longer live**. Holders still *own* their tokens, but the chain they live on has shut down — leaving 25,431 holders with a valuable community asset and no infrastructure to govern its future.

### The Snapshot

Before the chain went dark, a cryptographic, timestamped snapshot was captured as the authoritative record of who held what:

| Attribute | Value |
|---|---|
| **Block Number** | `59,922,100` |
| **Timestamp** | June 7, 2026 — 23:59:58 UTC |
| **Unique Holder Addresses** | `25,431` |
| **Contract** | `0xe3fcA919883950c5cD468156392a6477Ff5d18de` |
| **Decimals** | 18 |

This snapshot is the platform's **sole source of truth** for holder verification and voting power. It is immutable and never mutated after finalization.

### The Burn Event

Vitalik Buterin publicly burned **68.9% of total supply**, which simultaneously elevated the project's visibility and meme-cultural significance *and* concentrated remaining supply among a small group of holders. The platform must therefore honestly navigate a heavily skewed distribution (see [§6](#6-holder-classification-system)).

### Why Off-Chain Governance

With no live blockchain, on-chain governance is impossible. The platform deliberately operates **off-chain**:

- **No smart contracts are deployed** by the governance platform.
- **No transactions are initiated**, no gas is required, no private keys are stored.
- All verification is **read-only** against the frozen snapshot.

> ⚠️ **Design principle (v1):** Governance is **entirely off-chain and advisory**. Proposals that pass express the community's collective will; they are **not** auto-executed. This is the implementation baseline per [`DESIGN.md`](../DESIGN.md). Whether and how to bind future decisions to on-chain execution is a post-launch question (Phase 5 / P5 Future).

---

## 3. Mission, Vision & Core Values

### Mission

> *"A permanent, community-owned governance home for every $OMNOM holder — where your voice scales with your stake, every decision is transparent, and the snapshot is the single source of truth."*

### Guiding Principles

1. **🔍 Transparency** — All proposals, votes, and results are publicly auditable. No backroom deals; every decision is visible to every holder.
2. **👥 Community Ownership** — No centralized decision-maker. The community proposes, debates, and decides; the platform surfaces the collective will.
3. **⚖️ Stake-Weighted Voice** — Voting power scales with verified holdings (1 token = 1 vote in v1), while mechanisms like quorum and delegation keep governance feeling legitimate across the full distribution.
4. **🪨 Snapshot as Truth** — The frozen snapshot at Block 59,922,100 is the immutable, cryptographic anchor of legitimacy. It cannot be rewritten or gamed.
5. **🌱 Accessibility & Education** — Many holders are first-time DAO participants. The platform educates as much as it governs — explaining proposals, quorum, and voting mechanics — so that the smallest holder can participate as confidently as the largest.

---

## 4. Target Audience & Personas

The platform serves five distinct personas, from large-scale technical holders to non-holding observers.

| # | Persona | Holder Class | Supply Threshold | Technical Proficiency | Description |
|---|---|---|---|---|---|
| 1 | 🐋 **Whale Watcher** (Marcus) | Whale | ≥ 1.00% | High | Software engineer or crypto fund allocator protecting a large position and steering major decisions (chain migration, tokenomics). |
| 2 | 🐬 **Community Dolphin** (Priya) | Dolphin | 0.01–1.00% | Medium | Engaged community member balancing influence with fairness; active in Telegram governance discussion. |
| 3 | 🐟 **Fish First-Timer** (Jordan) | Fish | < 0.01% | Low / Medium | First-time DAO participant needing clear education, low friction, and confidence to cast a first vote. |
| 4 | 🔍 **Lost Wallet Holder** (Sergei) | (Any) | (Any) | Medium | Holds $OMNOM but has lost wallet access — needs a transparent, empathetic path to understand their status and options. |
| 5 | 👀 **New Observer** (Alex) | Non-holder | n/a | Variable | Researcher or enthusiast evaluating the project; needs open, readable governance to assess legitimacy. |

> Class emojis (🐋🐬🐟) are part of the OMNOM brand identity and are used consistently across personas, holder tiers, and the UI.

---

## 5. Platform at a Glance

The platform is a single web application that lets the community **verify, view, vote, delegate, and discuss** — all anchored to the frozen snapshot. No deep technical detail here; see [`TECHNICAL_ARCHITECTURE.md`](./TECHNICAL_ARCHITECTURE.md) for internals.

At a high level, the platform enables holders to:

- **🔗 Verify holdings** — Connect a wallet and cryptographically prove ownership against the snapshot (read-only, no gas, no transactions).
- **👁️ View proposals** — Browse active, upcoming, and closed proposals with full context and live results.
- **🗳️ Cast votes** — Vote on proposals with power proportional to verified balance (v1).
- **🤝 Delegate** — Entrust voting power to a trusted community member (roadmap Phase 2/P2→P3).
- **💬 Discuss** — Engage in structured proposal discussion before and during voting.
- **🔔 Stay informed** — Receive notifications about proposals that affect your holdings.
- **📊 See your standing** — View your verified balance, rank, holder class, and voting power on a personal dashboard.

> All of the above runs on free-tier infrastructure and works on mobile-first (60%+ of crypto users are on mobile). No private keys are ever stored.

---

## 6. Holder Classification System

After the burn, supply distribution is heavily skewed. Every holder is assigned to one of three tiers based on their percentage of total supply. In v1, class badges are **cosmetic and social only** — all holders vote proportionally to balance (1 token = 1 vote).

| Class | Emoji | Threshold | Holders | Approx. Share of Circulating Supply |
|---|---|---|---|---|
| **Whale** | 🐋 | ≥ 1.00% of supply | **4** | ~77% |
| **Dolphin** | 🐬 | 0.01–1.00% of supply | **322** | ~15% |
| **Fish** | 🐟 | < 0.01% of supply | **25,105** | ~8% |
| **Total** | — | — | **25,431** | **100%** |

> ⚠️ **Open decision — voting power & class modifiers.** [`PRD.md`](../PRD.md) frames this distribution as a problem requiring mechanisms (quorum, delegation, optional quadratic elements) to stay legitimate. [`DESIGN.md`](../DESIGN.md) defines the **v1 baseline: all classes vote at 1× balance-weighted power; badges are cosmetic.** Quadratic voting is deferred to v2.0. See [§11](#11-open-decisions-abridged) and [`GOVERNANCE_MECHANICS.md`](./GOVERNANCE_MECHANICS.md).

---

## 7. Token Summary

| Attribute | Value |
|---|---|
| **Token** | $OMNOM |
| **Standard** | DRC-20 |
| **Chain (origin)** | Dogechain (chain ID 2000) — **sunset, not operational** |
| **Contract Address** | `0xe3fcA919883950c5cD468156392a6477Ff5d18de` |
| **Decimals** | 18 |
| **Vitalik Burn** | 68.9% of total supply (publicly burned) |
| **Remaining Circulating Supply** | ≈ 31.1% of total (post-burn) |
| **Holder Addresses (snapshot)** | 25,431 |

### Utility

$OMNOM currently has **no inherent utility** — it is speculative / meme-cultural in origin. **Governance via the snapshot is its new utility**: verified holdings confer stake-weighted voting power on the OMNOM DAO platform. Any future utility (e.g., on a migrated chain) is itself a matter for community governance.

> ⚠️ **Source clarification.** Token supply and burn figures are stated as percentages across source docs. Exact absolute token counts are defined in [`DATA-MODEL.md`](../DATA-MODEL.md) (`totalSupply` field) and should be cited from there when precise wei values are needed.

---

## 8. Roadmap Snapshot

A 16-week phased build, followed by a post-launch future track. The full task breakdown lives in [`ROADMAP.md`](../ROADMAP.md); this table is a one-line summary per phase.

| Phase | Name | Weeks | One-Line Goal |
|---|---|---|---|
| **P0** | Foundation | 1–2 | Project scaffolding, snapshot data processing, design system, CI/CD. |
| **P1** | MVP — Verify & View | 3–5 | Wallet connect + SIWE verification, holder dashboard, admin proposal creation, proposal viewing. |
| **P2** | Govern — Propose & Vote | 6–9 | Public proposal lifecycle, stake-weighted voting, quorum, results. |
| **P3** | Engage — Notify & Connect | 10–12 | Notifications, delegation, discussion, community touchpoints. |
| **P4** | Scale — Analytics & Trust | 13–16 | Analytics, audit hardening, performance, trust/legitimacy tooling. |
| **P5** | Future | Post-launch | PWA, on-chain voting, multi-chain, quadratic voting, SDK. |

---

## 9. Success Metrics

The platform's success is measured by holder participation and the maturation of real decision-making.

| Horizon | Metric | Target |
|---|---|---|
| **6 months** | Snapshot holders verified on the platform | **≥ 30%** |
| **6 months** | First major community decision ratified | **Achieved** (e.g., chain selection or token migration path) |
| **12 months** | Snapshot holders verified on the platform | **≥ 50%** |

> These targets frame the transition from informal Telegram governance to verified, structured, auditable decision-making. Full qualitative/quantitative targets (proposal throughput, participation rate, delegation share, security incidents) are detailed in [`PRD.md`](../PRD.md) §11 (Success Metrics).

---

## 10. Community & Resources

| Resource | Location |
|---|---|
| **Telegram Group** | [t.me/omnomtoken_dc](https://t.me/omnomtoken_dc) |
| **Telegram Bot** | `@DBOT_DC_BOT` |
| **Blockscout Explorer** | [dogechain.blockscout.com](https://dogechain.blockscout.com) |
| **Governance Platform** | _(deployment URL TBD — see [`DESIGN.md`](../DESIGN.md))_ |
| **Documentation Hub** | [`/DOCS`](.) (this folder) |

### Documentation Suite

| Document | Purpose |
|---|---|
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | This document — high-level overview. |
| [`GOVERNANCE_MECHANICS.md`](./GOVERNANCE_MECHANICS.md) | Voting math, quorum, proposal lifecycle, delegation. |
| [`TECHNICAL_ARCHITECTURE.md`](./TECHNICAL_ARCHITECTURE.md) | Stack, system architecture, data flow, security. |
| [`CONTRIBUTOR_ONBOARDING.md`](./CONTRIBUTOR_ONBOARDING.md) | How to set up, develop, and contribute. |

---

## 11. Open Decisions (Abridged)

Several governance parameters are intentionally **left to the community** to decide through the platform itself. These are not engineering unknowns — they are policy choices that should be ratified by holders, not imposed.

- **Voting math** — Pure token-weighted (1 token = 1 vote) is the **v1 baseline**. Whether to adopt quorum tiers, delegation, or **quadratic voting** is pending community vote.
- **Tokenomics model** — Post-sunset economic design (migration, reissuance, dissolution) is undecided. See [`TOKENOMICS-OPTIONS.md`](../TOKENOMICS-OPTIONS.md) for candidate models.
- **Chain migration** — Whether and where to relaunch $OMNOM (and on what standard) is the single most consequential open decision.
- **On-chain binding** — v1 governance is advisory only. Whether/how to bind future decisions to on-chain execution is a Phase 5 (P5) question.

> ⚠️ **When sources conflict, the implementation truth is [`DESIGN.md`](../DESIGN.md) / [`DATA-MODEL.md`](../DATA-MODEL.md).** [`PRD.md`](../PRD.md) is aspirational product intent. Anything marked as a v1 baseline in DESIGN/Data-Model supersedes aspirational language in the PRD.

For the full mechanics, thresholds, and rationale, see [`GOVERNANCE_MECHANICS.md`](./GOVERNANCE_MECHANICS.md).

---

## 12. Document Cross-References

**Within the `/DOCS` suite:**

- 📄 [`GOVERNANCE_MECHANICS.md`](./GOVERNANCE_MECHANICS.md) — how voting, quorum, and proposals actually work.
- 🏗️ [`TECHNICAL_ARCHITECTURE.md`](./TECHNICAL_ARCHITECTURE.md) — tech stack, system architecture, and security.
- 🤝 [`CONTRIBUTOR_ONBOARDING.md`](./CONTRIBUTOR_ONBOARDING.md) — contributor setup and contribution flow.

**Back to source documents (repo root):**

- 📋 [`../PRD.md`](../PRD.md) — Product Requirements Document (aspirational).
- 🎨 [`../DESIGN.md`](../DESIGN.md) — Technical & UX Design (**implementation truth**).
- 🗄️ [`../DATA-MODEL.md`](../DATA-MODEL.md) — Data Model & Schema Reference (**implementation truth**).
- 🗺️ [`../ROADMAP.md`](../ROADMAP.md) — Full implementation roadmap.
- 💰 [`../TOKENOMICS-OPTIONS.md`](../TOKENOMICS-OPTIONS.md) — Candidate tokenomics models.
- 🔑 [`../WALLET-FLOW.md`](../WALLET-FLOW.md) — Wallet connection & SIWE flow detail.
- 🖼️ [`../UI-WIREFRAMES.md`](../UI-WIREFRAMES.md) — UI wireframes.

---

> *OMNOM DAO — turning a chain sunset into a community-owned relaunch, one verified vote at a time.*
