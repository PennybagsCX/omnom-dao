<div align="center">

# 🐶 OMNOM DAO — Documentation

### Snapshot-based, off-chain governance for $OMNOM token holders

</div>

---

> **OMNOM DAO** is a community-driven governance platform built for $OMNOM token holders following the Dogechain sunset. Using a trustless snapshot of holdings taken at block **59,922,100**, the platform enables transparent, off-chain advisory governance where every token captured at snapshot equals one vote. Built with **Next.js 15 + React 19 + TypeScript**, deployed on Vercel with a Turso (libSQL) database, OMNOM DAO preserves holder voice and coordinates the community's next chapter.

<div align="center">

| | |
|:---:|:---|
| 🟡 **Brand Gold** | `#FFD700` |
| 🟣 **Brand Purple** | `#8B5CF6` |
| ⚫ **Dark Background** | `#000000` / `#0A0A0A` (per `globals.css`) |

</div>

---

## 📑 Quick Navigation

| Document | Description | Audience | Reading Time |
|:---|:---|:---|:---:|
| [📄 Project Overview](./PROJECT_OVERVIEW.md) | What OMNOM DAO is, mission/vision, personas, holder classes, token summary, roadmap snapshot, success metrics. | All stakeholders | ~10 min |
| [🗳️ Governance Mechanics](./GOVERNANCE_MECHANICS.md) | Snapshot as source of truth, voting power (v1 linear / v2 quadratic), proposal types & thresholds, lifecycle, delegation, anti-whale safeguards, moderation, tokenomics voting framework. | Governance participants, developers | ~25 min |
| [🏗️ Technical Architecture](./TECHNICAL_ARCHITECTURE.md) | Next.js architecture, system components, SIWE auth flow, database schema, API reference, snapshot system, security architecture, smart contract strategy, deployment. | Developers | ~30 min |
| [🛠️ Contributor Onboarding](./CONTRIBUTOR_ONBOARDING.md) | Prerequisites, environment setup, project structure, development workflow, coding standards, testing, deployment. | New developers / contributors | ~15 min |

---

## 🧭 Documentation Framework (Diátaxis)

This documentation suite follows the [**Diátaxis**](https://diataxis.fr/) framework, organizing content by purpose into four quadrants. Each suite document maps to a primary quadrant:

<div align="center">

| Document | Diátaxis Quadrant | Purpose |
|:---|:---|:---|
| [Project Overview](./PROJECT_OVERVIEW.md) | **Explanation** — *Understanding* | Why OMNOM DAO exists and how it works conceptually |
| [Governance Mechanics](./GOVERNANCE_MECHANICS.md) | **Reference** — *Information* | Authoritative specs for governance rules and thresholds |
| [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) | **Reference** — *Information* | Authoritative technical reference for the system |
| [Contributor Onboarding](./CONTRIBUTOR_ONBOARDING.md) | **Tutorial / How-To** — *Learning / Doing* | Step-by-step guides to start contributing |

</div>

---

## 🔖 Recommended Reading Paths

Choose the path that matches your role:

### 👩‍💻 New Developer
> Start coding fast, then deepen your understanding.

[`Contributor Onboarding`](./CONTRIBUTOR_ONBOARDING.md) ➡️ [`Technical Architecture`](./TECHNICAL_ARCHITECTURE.md) ➡️ [`Governance Mechanics`](./GOVERNANCE_MECHANICS.md) ➡️ [`Project Overview`](./PROJECT_OVERVIEW.md)

### 🗳️ Governance Participant / Token Holder
> Understand your rights and how to participate.

[`Project Overview`](./PROJECT_OVERVIEW.md) ➡️ [`Governance Mechanics`](./GOVERNANCE_MECHANICS.md) ➡️ *(Technical Architecture — optional)*

### 📋 Product Manager / Stakeholder
> Grasp the vision, rules, and technical scope.

[`Project Overview`](./PROJECT_OVERVIEW.md) ➡️ [`Governance Mechanics`](./GOVERNANCE_MECHANICS.md) ➡️ [`Technical Architecture`](./TECHNICAL_ARCHITECTURE.md)

### 🔒 Auditor / Security Reviewer
> Dive deep into the system and trace back to source documents.

[`Technical Architecture`](./TECHNICAL_ARCHITECTURE.md) ➡️ [`Governance Mechanics`](./GOVERNANCE_MECHANICS.md) ➡️ [`Source Documents`](#📚-source-document-index)

---

## 📚 Source Document Index

These seven documents live in the project root and serve as the canonical source material for the suite.

| Document | Description | Lines |
|:---|:---|:---:|
| [`../PRD.md`](../PRD.md) | Product Requirements — features, scope, user stories, acceptance criteria | ~850 |
| [`../DESIGN.md`](../DESIGN.md) | Technical & UX Design — architecture, flows, component design *(implementation truth)* | ~1,891 |
| [`../DATA-MODEL.md`](../DATA-MODEL.md) | Type definitions, DB schema, API types *(implementation truth)* | ~1,148 |
| [`../ROADMAP.md`](../ROADMAP.md) | 16-week phased implementation plan | ~375 |
| [`../TOKENOMICS-OPTIONS.md`](../TOKENOMICS-OPTIONS.md) | Five tokenomics model options with chain comparison analysis | ~512 |
| [`../UI-WIREFRAMES.md`](../UI-WIREFRAMES.md) | ASCII wireframes for key screens *(incomplete)* | ~174 |
| [`../WALLET-FLOW.md`](../WALLET-FLOW.md) | SIWE authentication flow, Merkle proofs, security design | ~896 |

---

## 📐 Documentation Conventions

### Versioning
All suite documents are versioned **Draft v1.0.0**, dated **June 2026**. Docs are versioned alongside the codebase and updated with every change.

### Conflict Resolution Policy
When documents disagree, precedence is:

1. **[`../DESIGN.md`](../DESIGN.md)** and **[`../DATA-MODEL.md`](../DATA-MODEL.md)** → **Implementation truth** (what the code actually does)
2. **[`../PRD.md`](../PRD.md)** → *Aspirational* (what the product intends)

> ⚠️ **Conflicts:** Where a suite doc and a source doc conflict, the source doc wins. Suite doc conflicts are marked with ⚠️.
>
> 💡 **Tips:** Helpful context and best-practice notes are marked with 💡.

### Callout Conventions

| Symbol | Meaning |
|:---:|:---|
| ⚠️ | Conflict, caveat, or breaking change — read carefully |
| 💡 | Tip, recommendation, or best practice |
| ℹ️ | Informational note / context |
| 📌 | Status or important policy |

### Proposing Changes
Documentation is community-maintained. To propose a change:
1. Open a pull request against the relevant file.
2. Update the changelog / last-updated date in the modified document.
3. Cross-link any related source documents.

---

## 🃏 Project Snapshot — Facts Card

<div align="center">

| | |
|:---|:---|
| 🪙 **Token Contract** | `0xe3fcA919883950c5cD468156392a6477Ff5d18de` (DRC-20 on Dogechain) |
| 📸 **Snapshot Block** | `59,922,100` |
| 📅 **Snapshot Date** | June 7, 2026 23:59:58 UTC |
| 👥 **Holders Captured** | 25,686 (ever-held) |
| 🔥 **Supply Burned** | 68.9% *(burned by Vitalik)* |
| 🦑 **Krackens** | 1 |
| 🐋 **Whales** | 3 |
| 🐬 **Dolphins** | 30 |
| 🦈 **Sharks** | 326 |
| 🐙 **Octopuses** | 1,078 |
| 🦀 **Crabs** | 1,701 |
| 🦄 **Seahorses** | 22,547 |
| 🛠️ **Tech Stack** | Next.js 15, React 19, TypeScript, RainbowKit v2, wagmi v3, viem, Turso (libSQL), Vercel |
| 🚀 **Deployment** | Vercel |
| ⚙️ **Governance** | v1: off-chain, advisory, linear voting (1 token = 1 vote) — **no smart contracts** |
| 📆 **Dogechain Sunset** | June 7, 2026 |

</div>

---

## 💬 Community & Support

| Resource | Link |
|:---|:---|
| 📨 **Telegram** | *Community group — see project root README for invite link* |
| 🤖 **Bot** | *Governance notification bot — configured in deployment* |
| 🔍 **Block Explorer** | Dogechain explorer — search contract `0xe3fcA919883950c5cD468156392a6477Ff5d18de` |

> 💡 **Need help?** Open an issue in the repository or reach out in the Telegram group. For technical questions, check [`Technical Architecture`](./TECHNICAL_ARCHITECTURE.md) first.

---

## 📋 Document Status

| Document | Version | Status | Review State |
|:---|:---:|:---:|:---:|
| [Project Overview](./PROJECT_OVERVIEW.md) | Draft v1.0.0 | 🟡 Draft | 🔍 Under Review |
| [Governance Mechanics](./GOVERNANCE_MECHANICS.md) | Draft v1.0.0 | 🟡 Draft | 🔍 Under Review |
| [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) | Draft v1.0.0 | 🟡 Draft | 🔍 Under Review |
| [Contributor Onboarding](./CONTRIBUTOR_ONBOARDING.md) | Draft v1.0.0 | 🟡 Draft | 🔍 Under Review |

---

<div align="center">

### 🐾 OMNOM DAO

**Last updated:** June 2026 · **Version:** Draft v1.0.0

📜 These docs are **community-maintained**. Contributions welcome.

[⬅️ Back to Repository Root](../)

</div>
