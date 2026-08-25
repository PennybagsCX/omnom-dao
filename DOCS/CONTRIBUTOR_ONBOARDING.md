---
title: "OMNOM DAO — Contributor Onboarding Guide"
description: "Step-by-step onboarding for developers joining the OMNOM DAO governance platform: environment setup, project structure, workflow, coding standards, testing, and deployment."
version: "Draft v1.0.0"
date: "2026-06"
status: "Draft — Pending Community Review"
category: "How-To / Tutorial"
audience: "New developers and contributors to the OMNOM DAO platform"
---

# OMNOM DAO — Contributor Onboarding Guide

| Field | Value |
|---|---|
| **Version** | Draft v1.0.0 |
| **Date** | June 2026 |
| **Status** | ![Status: Draft](https://img.shields.io/badge/status-Draft%20%E2%80%94%20Pending%20Review-yellow) |
| **Document Type** | Contributor Onboarding (How-To + Tutorial) |
| **Stack** | Next.js 15 · React 19 · TypeScript · Turso · Vercel |
| **Related Docs** | [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md), [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md), [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) |

> **TL;DR** — This guide takes you from zero to a running local development environment for OMNOM DAO, the snapshot-based, off-chain governance platform for $OMNOM token holders. In roughly **30–45 minutes** you will clone the repo, install dependencies, wire up environment variables, provision a free Turso database and Vercel KV store, build the holder snapshot, and be ready to ship your first pull request.

Welcome aboard! 👋 Whether you're a seasoned Web3 engineer or a Web2 developer curious about decentralized governance, your contributions directly shape the future of **25,431 $OMNOM holders** left without a chain after the Dogechain sunset. This platform is their voice — and your code is how they speak. Read on, follow the steps, and don't hesitate to reach out in the community channels listed at the end.

---

## Table of Contents

1. [Welcome & Project Introduction](#1-welcome--project-introduction)
2. [Prerequisites](#2-prerequisites)
3. [Development Environment Setup](#3-development-environment-setup)
4. [Project Structure Walkthrough](#4-project-structure-walkthrough)
5. [Development Workflow](#5-development-workflow)
6. [Coding Standards & Conventions](#6-coding-standards--conventions)
7. [Testing Guidelines](#7-testing-guidelines)
8. [Authentication & Wallet Testing](#8-authentication--wallet-testing)
9. [Database Development](#9-database-development)
10. [Design System & UI Guidelines](#10-design-system--ui-guidelines)
11. [Deployment & CI/CD](#11-deployment--cicd)
12. [Contributing to Governance Logic](#12-contributing-to-governance-logic)
13. [Roadmap & Where to Help](#13-roadmap--where-to-help)
14. [Communication & Community](#14-communication--community)
15. [Glossary & Quick Reference](#15-glossary--quick-reference)
16. [Cross-References](#16-cross-references)

---

## 1. Welcome & Project Introduction

**OMNOM DAO** is a **snapshot-based, off-chain governance platform** built with **Next.js 15 + React 19 + TypeScript**. It gives every verified $OMNOM token holder a transparent, stake-weighted voice in their community's future — no smart contracts, no gas fees, no live blockchain required. Identity is proven via **SIWE (EIP-4361) message signing**, and voting power is anchored to a single immutable token-holding snapshot captured at **Block 59,922,100**.

**Why contributors matter.** This is a community-driven, open-source project (MIT-licensed). The core team is small; the roadmap is ambitious (six phases spanning sixteen weeks). Every contribution — whether a bug fix, a UI polish, a new test, or a governance feature — directly improves the democratic tooling that holders rely on.

**What you can work on.** There is something for every skill level:

- **Frontend** — React components, dashboard UI, charts, accessibility (WCAG 2.1 AA), dark-mode polish
- **Backend** — API routes (`app/api/v1/...`), Turso queries, SIWE verification, rate limiting
- **Web3/Auth** — SIWE flow, wallet connection (RainbowKit + wagmi), JWT session handling
- **Data/Infra** — snapshot build pipeline (CSV → JSON), caching (Vercel KV), CI/CD, deployment
- **Docs & Tooling** — documentation, test coverage, developer experience

> 💡 **New here?** Start with [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) for the big picture, then read [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md) to understand the rules your code will enforce. Come back here when you're ready to set up your environment.

---

## 2. Prerequisites

### Required Skills

| Skill | Level | Notes |
|---|---|---|
| **TypeScript** | Intermediate | Strict mode is enabled; no `any` without justification |
| **React** | Intermediate | Function components, hooks; React 19 features welcome |
| **Next.js (App Router)** | Basics | Familiarity with Server Components, API routes, file-based routing |
| **SQL / Databases** | Basics | You'll write parameterized queries against Turso (libSQL/SQLite) |
| **Web3 / Wallet concepts** | Basics | Understanding of EVM addresses, message signing, SIWE concepts |
| **Git & GitHub** | Intermediate | Branching, PRs, conventional commits |

### Tools Needed

| Tool | Version | How to get it |
|---|---|---|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) (use LTS) — verify with `node --version` |
| **pnpm** *(preferred)* | 9+ | `npm install -g pnpm` (npm works too, but pnpm is our standard) |
| **Git** | any recent | [git-scm.com](https://git-scm.com/) |
| **Code editor** | — | VS Code recommended (install the ESLint + Prettier extensions) |
| **MetaMask** (or any EVM wallet) | latest | [metamask.io](https://metamask.io/) — needed to test the SIWE login flow locally |
| **Turso CLI** | latest | `brew install tursodatabase/tap/turso` (macOS) — see [setup](#33-set-up-the-turso-database) |

### Accounts Needed (all free)

| Account | Purpose | Where |
|---|---|---|
| **GitHub** | Fork, clone, open PRs | [github.com](https://github.com) |
| **Vercel** | Deployment & preview environments | [vercel.com](https://vercel.com) (Hobby/free plan) |
| **Turso** | Hosted SQLite database | [turso.tech](https://turso.tech) (free tier) |
| **WalletConnect Cloud** | WalletConnect project ID for RainbowKit | [cloud.walletconnect.com](https://cloud.walletconnect.com) (create a Project → get `Project ID`) |

> 💡 **No paid accounts required.** The entire stack runs on free tiers for local and even production development.

---

## 3. Development Environment Setup

> ⏱️ **Estimated time:** 30–45 minutes (most of it is account provisioning and the snapshot build).

### 3.1 Clone the Repository

```bash
# Clone via HTTPS (or SSH if you have keys set up)
git clone https://github.com/OMNOM-DAO/omnom-dao.git
cd omnom-dao

# If you plan to contribute, fork first, then clone your fork
# git clone https://github.com/<your-username>/omnom-dao.git
git remote add upstream https://github.com/OMNOM-DAO/omnom-dao.git
```

Verify your default branch is `main`:

```bash
git branch --show-current   # → main
```

### 3.2 Install Dependencies

We standardize on **pnpm**:

```bash
pnpm install
```

If you prefer npm:

```bash
npm install
```

> ⚠️ **Do not mix pnpm and npm lockfiles.** Pick one and stick with it. The repository ships a `pnpm-lock.yaml`; prefer pnpm unless a maintainer says otherwise.

### 3.3 Set Up the Turso Database

Turso is our hosted SQLite (libSQL) provider. The free tier is more than enough.

```bash
# 1. Install the Turso CLI (macOS / Linux)
brew install tursodatabase/tap/turso

# 2. Sign in (opens a browser)
turso auth login

# 3. Create a database
turso db create omnom-dao-dev

# 4. Get your database URL
turso db show omnom-dao-dev --url
#   → libsql://omnom-dao-dev-<your-handle>.turso.io

# 5. Create an auth token
turso db tokens create omnom-dao-dev
#   → eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9... (long token string)
```

**Run the schema/migrations** to create all 7 tables (users, proposals, votes, comments, notifications, proposal_templates, + supporting indexes):

```bash
# Ensure you are in the package root (where the migration scripts live)
pnpm db:migrate
# or, if no npm script exists yet:
# turso db shell omnom-dao-dev < ./db/schema.sql
```

> 💡 **Inspect your database** at any time with the Turso shell: `turso db shell omnom-dao-dev`. Then run `.tables` or `.schema proposals`. The schema is defined in [`DATA-MODEL.md`](../DATA-MODEL.md) and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) §5.

### 3.4 Set Up Vercel KV (or Local Alternative)

Vercel KV powers session cache and rate limiting. For local development you have two options:

**Option A — Use Vercel KV directly (recommended for parity with prod):**

```bash
# Install the Vercel CLI and link your project
npm install -g vercel
vercel login
vercel link            # link this folder to your Vercel project

# Create a KV store
vercel kv create omnom-kv-dev

# Pull the resulting env vars into your local shell
vercel env pull .env.local
```

**Option B — Use a local Redis-compatible store for offline dev:**

Install a local Redis (e.g., via `brew install redis && brew services start redis`) and point your env vars at `redis://127.0.0.1:6379`. The `@vercel/kv` client works against any Redis-compatible endpoint.

### 3.5 Configure Environment Variables

Create a `.env.local` file in the project root. **Never commit this file.**

```bash
cp .env.example .env.local   # if an example is provided
```

Fill in `.env.local` with the values obtained above:

```bash
# ── REQUIRED ───────────────────────────────────────────────
# WalletConnect project ID (from cloud.walletconnect.com)
NEXT_PUBLIC_WC_PROJECT_ID="your_walletconnect_project_id_here"

# JWT signing secret — MUST be ≥ 32 characters. Generate one:
#   openssl rand -base64 48
JWT_SECRET="generate_a_long_random_secret_at_least_32_chars_long"

# Turso database connection
TURSO_DATABASE_URL="libsql://omnom-dao-dev-<your-handle>.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."

# ── OPTIONAL ───────────────────────────────────────────────
# Comma-separated list of admin wallet addresses (checksum or lowercase)
NEXT_PUBLIC_ADMIN_ADDRESSES="0xYourWalletAddress,0xAnotherAdminAddress"

# Telegram bot token (for notification testing) — from @BotFather
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=""

# Resend email API key — from resend.com
RESEND_API_KEY=""

# Canonical site URL (used for email/SIWE domain)
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

#### Environment Variable Reference

| Variable | Required | Description | How to obtain |
|---|---|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | ✅ | WalletConnect Cloud project ID for RainbowKit v2 | [cloud.walletconnect.com](https://cloud.walletconnect.com) → New Project |
| `JWT_SECRET` | ✅ | HS256 signing secret for SIWE-issued JWTs (≥ 32 chars) | `openssl rand -base64 48` |
| `TURSO_DATABASE_URL` | ✅ | libSQL database URL | `turso db show <name> --url` |
| `TURSO_AUTH_TOKEN` | ✅ | Turso database access token | `turso db tokens create <name>` |
| `NEXT_PUBLIC_ADMIN_ADDRESSES` | ⬜ | Comma-separated admin wallet addresses | Your own MetaMask address (for local admin testing) |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | ⬜ | Bot token for Telegram notifications | [@BotFather](https://t.me/BotFather) |
| `RESEND_API_KEY` | ⬜ | Resend email API key | [resend.com](https://resend.com) |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | Canonical site URL | `http://localhost:3000` for local |

> ⚠️ **Security:** Never commit `JWT_SECRET`, `TURSO_AUTH_TOKEN`, or any API key. Ensure `.gitignore` contains `.env.local`. The `NEXT_PUBLIC_` prefix exposes a variable to the browser — only use it for non-secret values (project IDs, admin addresses).

### 3.6 Generate the Snapshot Data

The governance engine relies on a static snapshot of token holders, served from `/public/data/`. The build pipeline transforms a source CSV into optimized, hash-verified JSON artifacts.

```bash
# Place the source holder CSV at scripts/data/holders.csv
# (format: address,balance — valid EVM addresses, no duplicates)

# Run the snapshot build pipeline
pnpm snapshot:build
```

**What the pipeline does** (CSV → JSON → hash):

1. **Parse & validate** the CSV — checks for valid EVM addresses, removes duplicates, enforces the expected holder count (**25,431 holders**).
2. **Sort** holders by address.
3. **Build a binary-search index** for O(log n) runtime lookups against `holders.json` (~3.5 MB).
4. **Classify holders** into tiers: 🐋 **whales** (4), 🐬 **dolphins** (322), 🐟 **fish** (the remainder).
5. **Compute a SHA-256 hash** written to `csv-hash.txt` for public verifiability.

Outputs land in `public/data/`:

```text
public/data/
├── holders.json        # ~3.5 MB sorted holder array + index
├── snapshot-map.json   # address → tier mapping
└── snapshot-hash.txt   # SHA-256 hash of the source CSV
```

> 💡 **No real CSV yet?** For local testing you can craft a tiny CSV with your own wallet address (see [§8 Authentication & Wallet Testing](#8-authentication--wallet-testing)).

### 3.7 Run the Dev Server

```bash
pnpm dev
# or: npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3.8 Verify the App Is Running

Run through this quick smoke test:

1. **Page loads** — the homepage renders with the OMNOM gold/purple dark theme.
2. **Connect wallet** — click "Connect Wallet", select MetaMask, approve the connection (RainbowKit modal).
3. **SIWE sign-in** — the SIWE prompt appears; sign the EIP-4361 message in MetaMask. You should land on an authenticated dashboard.
4. **Holder lookup** — if your address is in the local snapshot, your tier (🐋/🐬/🐟) and balance appear.
5. **Admin panel** — if you added your address to `NEXT_PUBLIC_ADMIN_ADDRESSES`, the admin proposal-creation UI is visible.

✅ **If all five pass, your environment is fully set up.** Welcome to the team! 🎉

### 3.9 Troubleshooting Common Setup Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `Error: NEXT_PUBLIC_WC_PROJECT_ID is not defined` | Missing/empty WalletConnect ID | Set it in `.env.local` and restart `pnpm dev` |
| SIWE sign succeeds but you're not authenticated | `JWT_SECRET` is missing or < 32 chars | Generate a ≥ 32-char secret and restart |
| `SQLITE_ERROR: no such table: proposals` | Migrations didn't run | Re-run `pnpm db:migrate` against your Turso DB |
| `holders.json not found` / empty dashboard | Snapshot build not run | Run `pnpm snapshot:build`; verify `public/data/holders.json` exists |
| Wallet connects but no tier shown | Your address isn't in the snapshot | Add your address to the local CSV and rebuild (see [§8](#8-authentication--wallet-testing)) |
| `KV connection refused` | Vercel KV / local Redis not running | Start local Redis, or run `vercel env pull .env.local` |
| Port 3000 already in use | Another process holds the port | `pnpm dev -- -p 3001` or kill the other process |
| `turso auth` fails | Not signed in | `turso auth login` |

---

## 4. Project Structure Walkthrough

The project follows the **Next.js App Router** convention. Here's the layout a contributor should know:

```text
omnom-dao/
├── app/                        # App Router: pages + API routes
│   ├── (auth)/                 # Route groups for auth-gated pages
│   ├── dashboard/              # Authenticated user dashboard
│   ├── proposals/              # Proposal list + detail pages
│   ├── admin/                  # Admin-only proposal management
│   ├── api/
│   │   └── v1/                 # Versioned API routes
│   │       ├── auth/           # SIWE nonce, verify, session endpoints
│   │       ├── proposals/      # CRUD for proposals
│   │       ├── votes/          # Vote submission / change
│   │       ├── comments/       # Comment endpoints
│   │       └── snapshot/       # Public snapshot / hash verification
│   ├── layout.tsx              # Root layout (providers, fonts, theme)
│   ├── page.tsx                # Landing page
│   └── globals.css             # Tailwind + global styles
│
├── components/                 # React components (shadcn/ui based)
│   ├── ui/                     # shadcn/ui primitives (button, card, dialog…)
│   ├── wallet/                 # ConnectButton, SIWE prompt wrappers
│   ├── proposals/              # Proposal cards, vote bars, comment threads
│   └── shared/                 # Layout, navigation, toasts
│
├── lib/                        # Shared utilities (importable from anywhere)
│   ├── db.ts                   # Turso/libSQL client singleton
│   ├── auth.ts                 # SIWE verification + JWT helpers (jose)
│   ├── snapshot.ts             # Snapshot loader + O(log n) binary-search lookup
│   ├── kv.ts                   # Vercel KV client + rate-limit helpers
│   ├── validations.ts          # Zod schemas for API inputs
│   └── utils.ts                # cn(), formatters, address helpers
│
├── public/
│   └── data/                   # Snapshot JSON artifacts (static-served)
│       ├── holders.json        # ~3.5 MB sorted holders + index
│       ├── snapshot-map.json   # address → tier map
│       └── snapshot-hash.txt   # SHA-256 source hash
│
├── scripts/                    # Build & data pipeline scripts
│   ├── build-snapshot.ts       # CSV → JSON → hash pipeline
│   └── data/                   # Source CSVs
│
├── db/                         # Schema + migrations
│   ├── schema.sql              # Full schema (7 tables + indexes)
│   └── migrations/             # Versioned migration files
│
├── DOCS/                       # Project documentation
├── .env.example                # Template for environment variables
├── .env.local                  # Your local secrets (gitignored)
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind v4 config + design tokens
├── tsconfig.json               # TypeScript strict config
├── package.json                # Scripts + dependencies
└── pnpm-lock.yaml              # Lockfile (commit this)
```

### Key Files to Know First

| File | Why it matters |
|---|---|
| [`lib/db.ts`](lib/db.ts) | The Turso client singleton — every database query flows through here |
| [`lib/auth.ts`](lib/auth.ts) | SIWE verification and JWT issuance/verification (jose) |
| [`lib/snapshot.ts`](lib/snapshot.ts) | Loads `holders.json` and performs the binary-search holder lookup |
| [`lib/validations.ts`](lib/validations.ts) | Zod schemas — validate every API input against these |
| [`app/api/v1/auth/`](app/api/v1/auth) | The SIWE flow (nonce → verify → JWT cookie) |
| [`scripts/build-snapshot.ts`](scripts/build-snapshot.ts) | The snapshot build pipeline |
| [`db/schema.sql`](db/schema.sql) | Authoritative database schema |

> 💡 **Read these six files end to end before touching governance logic.** They encode the rules described in [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md).

---

## 5. Development Workflow

### 5.1 Branching Strategy

All work flows through **feature branches** off `main`:

```bash
# Keep your fork in sync
git checkout main
git pull upstream main

# Create a branch with a conventional prefix
git checkout -b feature/proposal-vote-change
git checkout -b fix/siwe-jwt-expiry
git checkout -b docs/onboarding-guide
```

| Prefix | Use for |
|---|---|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation |
| `refactor/` | Code reorganization without behavior change |
| `chore/` | Tooling, deps, configs |

### 5.2 Commit Message Conventions

We use **Conventional Commits**:

```bash
git commit -m "feat(votes): allow vote change until final 12 hours"
git commit -m "fix(auth): refresh JWT cookie on near-expiry requests"
git commit -m "docs: add contributor onboarding guide"
git commit -m "chore(deps): bump wagmi to ^3.1"
```

| Type | Meaning |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Maintenance, tooling, dependencies |
| `test` | Adding or correcting tests |
| `perf` | Performance improvement |

A **scope** in parentheses (e.g., `(votes)`, `(auth)`) is encouraged but optional.

### 5.3 Pull Request Process

1. **Push** your branch to your fork.
2. **Open a PR** against `OMNOM-DAO/omnom-dao:main`.
3. **Fill in the PR template** — link the related issue, describe the change, list testing steps, and note any breaking changes.
4. **Ensure CI passes** — lint, type-check, and tests (see [§7](#7-testing-guidelines)).
5. **Request review** from a maintainer or area owner.
6. **Address feedback** with new commits (avoid force-pushing after review unless asked).
7. **Squash-merge** on approval (maintainers handle this).

> 💡 **Keep PRs small and focused.** A 50-line PR that does one thing well is reviewed and merged faster than a 500-line PR that does five things.

### 5.4 Code Review Guidelines

**For authors:**
- Self-review your diff before requesting review.
- Add screenshots/recordings for any visual change.
- Verify the dev server builds and the relevant feature works locally.

**For reviewers:**
- Be kind and constructive. Review the code, not the person.
- Check: correctness, security (parameterized queries, input sanitization), accessibility, and adherence to [§6 conventions](#6-coding-standards--conventions).
- Approve with explicit ✅; request changes with specific, actionable comments.

---

## 6. Coding Standards & Conventions

### 6.1 TypeScript

- **Strict mode** is enabled in [`tsconfig.json`](tsconfig.json). Respect it.
- **No `any`** without an inline justification comment. Prefer `unknown` + type narrowing, or define a proper type.
- Enable `noUncheckedIndexedAccess` mentally — index accesses may be `undefined`.

```ts
// ❌ Avoid
function process(data: any) { return data.foo; }

// ✅ Prefer
interface Holder { address: string; balance: bigint; }
function process(data: Holder): string { return data.address; }
```

### 6.2 Component Structure

- Use **function components** and hooks. No class components.
- Compose with **shadcn/ui** primitives — don't reinvent buttons/inputs/dialogs.
- One default export per page/component file; co-locate sub-components in a folder when needed.

### 6.3 File Naming

| Artifact | Convention | Example |
|---|---|---|
| Component files | `PascalCase` or kebab-case file → `PascalCase` export | `ProposalCard.tsx` → `ProposalCard` |
| Non-component files | `kebab-case` | `snapshot.ts`, `db.ts` |
| API route folders | `kebab-case` | `app/api/v1/proposals/route.ts` |

### 6.4 Import Ordering

Group imports in this order, separated by blank lines:

```ts
// 1. Node / Next.js built-ins
import { NextResponse } from "next/server";

// 2. External packages
import { createClient } from "@libsql/client";
import { z } from "zod";

// 3. Internal absolute imports (lib/, components/)
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";

// 4. Relative imports
import { ProposalCard } from "./ProposalCard";

// 5. Types
import type { Holder } from "@/lib/types";
```

### 6.5 Styling with Tailwind + shadcn/ui

- **Utility-first.** Compose Tailwind classes directly in JSX.
- Use the `cn()` helper (`@/lib/utils`) to merge conditional classes.
- Prefer **shadcn/ui component composition** over bespoke CSS. Customize via the design tokens in [`tailwind.config.ts`](tailwind.config.ts) (see [§10](#10-design-system--ui-guidelines)).
- Dark mode is the **default** — design for dark backgrounds first.

### 6.6 Error Handling

API routes return a consistent **`ApiResponse` envelope**:

```ts
// Success
return NextResponse.json({
  success: true,
  data: { /* ... */ },
});

// Error
return NextResponse.json(
  {
    success: false,
    error: {
      code: "VOTE_WINDOW_CLOSED",     // machine-readable
      message: "Voting closed for this proposal.",
    },
  },
  { status: 400 }
);
```

| Practice | Requirement |
|---|---|
| Use descriptive **error codes** | `"VOTE_WINDOW_CLOSED"`, not `"ERR_1"` |
| Set correct **HTTP status** | 200, 400, 401, 403, 404, 409, 429, 500 |
| Never leak stack traces to clients | Log server-side, return generic `500` |
| Validate all inputs | Use Zod schemas in [`lib/validations.ts`](lib/validations.ts) |

### 6.7 Security-First Coding

| Rule | Why |
|---|---|
| **Always use parameterized queries** | Prevents SQL injection in Turso/libSQL |
| **Sanitize all user-supplied HTML** | Render markdown/HTML through **DOMPurify** (`dompurify`) |
| **Never expose `JWT_SECRET`** or DB tokens | Keep secrets server-side only |
| **Verify SIWE signatures server-side** | Never trust a client-claimed address |
| **Rate-limit** write endpoints | Via Vercel KV (anti-spam rules in [§12](#12-contributing-to-governance-logic)) |

```ts
// ❌ NEVER — string concatenation in SQL
db.execute(`SELECT * FROM users WHERE address = '${addr}'`);

// ✅ ALWAYS — parameterized
db.execute({ sql: "SELECT * FROM users WHERE address = ?", args: [addr] });
```

---

## 7. Testing Guidelines

> 📌 **Status: Recommended.** No test framework is wired up in the repository yet (as of v1.0.0). We **recommend** the industry-standard Next.js stack below. Contributions that add this scaffolding are highly welcome — see [§13](#13-roadmap--where-to-help).

### 7.1 Recommended Testing Stack

| Tool | Purpose |
|---|---|
| **Vitest** | Unit + integration tests (fast, Jest-compatible API, native ESM/TS) |
| **Playwright** | End-to-end browser tests (wallet connect, SIWE, full vote flow) |
| **@testing-library/react** | Component testing |
| **MSW (Mock Service Worker)** | Mock API routes in component tests |

### 7.2 How to Run Tests

```bash
pnpm test            # run Vitest unit/integration suite (watch mode)
pnpm test:ci         # run once with coverage (for CI)
pnpm test:e2e        # run Playwright E2E suite
```

### 7.3 How to Write Tests

**Mock the Turso client** so tests never hit a real database:

```ts
// __tests__/vote.test.ts
import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
    batch: vi.fn(),
  },
}));

import { submitVote } from "@/lib/votes";
import { db } from "@/lib/db";

describe("submitVote", () => {
  it("inserts a vote with a parameterized query", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
    await submitVote({ proposalId: 1, choice: "for", address: "0xabc" });
    expect(db.execute).toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("?") })
    );
  });
});
```

**Use snapshot fixtures** — commit a tiny `holders.json` fixture under `__fixtures__/` rather than loading the 3.5 MB production snapshot in tests.

### 7.4 Coverage Expectations & CI

- **Target coverage:** ≥ 80% for `lib/` (auth, snapshot, validations).
- **CI integration:** GitHub Actions runs `pnpm test:ci` and `pnpm lint` on every PR. A failing check blocks merge.

### 7.5 Manual Testing Checklist

Before opening a PR that touches auth or governance, verify each of these by hand:

- [ ] **Wallet connect** — RainbowKit modal opens, MetaMask connects, address displays.
- [ ] **SIWE sign** — message signing produces a valid session (`omnom_token` cookie set).
- [ ] **Session persistence** — refresh keeps you logged in (7-day JWT).
- [ ] **Holder lookup** — correct tier and balance render for a known address.
- [ ] **Proposal creation** — admin can create a proposal; non-admin (or under-minimum holder) is rejected.
- [ ] **Vote submission** — a vote records and updates the live tally.
- [ ] **Vote change** — within the final-12h window it's blocked; before that it succeeds.
- [ ] **Rate limiting** — rapid requests trigger `429`.

---

## 8. Authentication & Wallet Testing

The SIWE (Sign-In with Ethereum) flow is the heart of identity in OMNOM DAO. Here's how to test it locally — **without** the full 25,431-holder snapshot.

### 8.1 Add Your Wallet to a Local Snapshot

Create a minimal CSV with your MetaMask address and a balance that lands you in the tier you want to test:

```csv
address,balance
0xYourWalletAddress,5000000000
0xWhaleTestAddress,50000000000
0xFishTestAddress,1000
```

Then rebuild the snapshot:

```bash
pnpm snapshot:build
```

> 💡 **Tier thresholds** (for choosing a test balance): 🐋 **whale** (4 in prod), 🐬 **dolphphin** (322 in prod), 🐟 **fish** (everyone else). Check [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) §6 for exact balance cutoffs and craft your CSV accordingly.

### 8.2 Set Yourself as Admin

Add your address to the admin env var in `.env.local`:

```bash
NEXT_PUBLIC_ADMIN_ADDRESSES="0xYourWalletAddress"
```

Restart `pnpm dev`. You now see the admin proposal-management UI.

### 8.3 Test Different Holder Classes

To exercise each code path, maintain several test addresses and switch your active MetaMask account between them:

| Account | Balance | Tests |
|---|---|---|
| Whale | high | Full proposal creation on **all** categories (Chain Selection, Tokenomics, Technical) |
| Dolphin | mid | Creation on restricted categories; high vote weight |
| Fish | low | Standard vote; restricted-category proposal creation blocked |
| Non-holder | 0 | Should not appear in snapshot; can authenticate but has no voting power |

### 8.4 Testing the SIWE Flow in Detail

1. Ensure `JWT_SECRET` is set (≥ 32 chars) and the auth API routes are reachable.
2. Connect wallet → click "Sign In" → review the **EIP-4361 message** in MetaMask (it should reference your `NEXT_PUBLIC_SITE_URL` domain).
3. Sign → the server verifies via `ecrecover`, checks the nonce, and issues a **7-day JWT** in an `httpOnly`, `Secure`, `SameSite=Strict` cookie named `omnom_token`.
4. Verify the cookie exists (DevTools → Application → Cookies).

> ⚠️ **JWT expiry note:** The PRD mentions 24h while [`DESIGN.md`](../DESIGN.md) and [`WALLET-FLOW.md`](../WALLET-FLOW.md) say 7 days. **7 days is canonical for v1.** If you see 24h anywhere in code, flag it.

---

## 9. Database Development

### 9.1 Interacting with Turso Locally

```bash
# Open an interactive SQL shell
turso db shell omnom-dao-dev

# Run a quick query
turso db shell omnom-dao-dev "SELECT address, created_at FROM users LIMIT 5;"
```

For a GUI, use **[Turso Studio](https://turso.tech/docs/cli/studio)**:

```bash
turso db studio omnom-dao-dev
```

### 9.2 Running Migrations

```bash
pnpm db:migrate          # apply pending migrations
pnpm db:migrate:status   # see what's applied
```

> ⚠️ **Run migrations from the package root**, not from a subdirectory. The migration scripts expect the working directory to be the project root.

### 9.3 Seeding Test Data

Seed the `proposal_templates` table so the admin proposal-creation UI has categories to choose from:

```bash
pnpm db:seed
# or manually:
turso db shell omnom-dao-dev < ./db/seed-templates.sql
```

The **7 tables** you'll work with:

| Table | Holds |
|---|---|
| `users` | Verified holders (address, display name, created_at) |
| `proposals` | Governance proposals (title, body, category, status, deadlines) |
| `votes` | Individual votes (**UNIQUE** per user+proposal) |
| `comments` | Discussion threads on proposals |
| `notifications` | Email + Telegram notification records |
| `proposal_templates` | Reusable proposal category templates |
| *(snapshot artifacts)* | Static JSON in `public/data/` (not a table) |

Full schema: [`DATA-MODEL.md`](../DATA-MODEL.md) and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) §5.

---

## 10. Design System & UI Guidelines

### 10.1 Colors

| Token | Hex | Usage |
|---|---|---|
| **Primary gold** | `#FFD700` | CTAs, highlights, brand accent |
| **Secondary purple** | `#8B5CF6` | Secondary actions, links |
| **Background deep** | `#0F0F23` | Page background (dark-mode default) |
| **Background surface** | `#1A1A2E` | Cards, panels, modals |
| **Success green** | `#10B981` | Confirmations, "For" votes |
| **Danger red** | `#EF4444` | Errors, "Against" votes, destructive actions |

### 10.2 Typography

| Font | Use |
|---|---|
| **Inter** | Body text, UI labels |
| **JetBrains Mono** | Wallet addresses, balances, numbers (prevents layout shift) |

### 10.3 Component Library

We use **shadcn/ui** (Radix primitives + Tailwind). Add new components via the CLI:

```bash
pnpm dlx shadcn@latest add dialog
```

Compose shadcn primitives rather than writing raw form controls.

### 10.4 Dark Mode

Dark mode is the **default** and only fully-supported theme in v1. Always design against `#0F0F23` / `#1A1A2E` backgrounds. Light mode is a **post-v1** consideration.

### 10.5 Accessibility (WCAG 2.1 AA)

Accessibility is a **first-class requirement**, audited in Phase 4. For every UI contribution:

- All interactive elements are **keyboard reachable** with visible focus states.
- Use **semantic HTML** and ARIA only when a native element won't suffice.
- Maintain **color-contrast ratios** ≥ 4.5:1 for text (the palette above is tuned for this).
- Provide **accessible names** for icon-only buttons (e.g., `aria-label`).

### 10.6 Brand Emojis & Animation

- **Holder-tier emojis** are part of the brand: 🐋 **whale**, 🐬 **dolphin**, 🐟 **fish**. Use them consistently in tier badges.
- Use **framer-motion** for motion (page transitions, success states like `react-confetti` on proposal pass). Keep animations subtle and respect `prefers-reduced-motion`.

> 💡 Full design spec: [`DESIGN.md`](../DESIGN.md) and [`UI-WIREFRAMES.md`](../UI-WIREFRAMES.md).

---

## 11. Deployment & CI/CD

### 11.1 How Vercel Deployment Works

The app deploys to **Vercel (Hobby/free plan)** as static/ISR pages plus serverless Node.js API routes.

- **Push to `main`** → triggers a **production deployment**.
- **Open/update a PR** → triggers a **preview deployment** with a unique URL for review.
- Each deployment automatically wires the environment variables configured in the Vercel dashboard.

### 11.2 Environment Variables in Vercel

Configure production and preview environment variables in the **Vercel dashboard** (Project → Settings → Environment Variables). Mirror the same set as your [`.env.local`](#35-configure-environment-variables), but:

- Set `NEXT_PUBLIC_SITE_URL` to your real production domain for the prod environment.
- Keep `JWT_SECRET` and `TURSO_AUTH_TOKEN` in **Production** and **Preview** scopes only (never **Development**-visible if the dashboard is shared).

### 11.3 Preview Deployments on PRs

Every PR gets a live preview URL. **Use it in your PR description** so reviewers can test the change without checking out your branch locally. Vercel KV and Turso credentials attach automatically from the Preview environment scope.

### 11.4 Production Deploy Process

1. PR approved + CI green.
2. Squash-merge into `main`.
3. Vercel auto-builds and promotes to production.
4. Smoke-test the live site (wallet connect, SIWE, a sample proposal).
5. If a rollback is needed, use **Vercel → Instant Rollback** to the previous deployment.

---

## 12. Contributing to Governance Logic

Governance code is **high-stakes** — bugs can disenfranchise holders or corrupt vote tallies. Read these rules before touching proposals, votes, or delegation.

### 12.1 The Proposal Lifecycle

Proposals move through defined states (Draft → Active → voting window open/closed → Finalized). Respect the state machine exactly as documented in [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md). Never allow a transition that skips a state.

### 12.2 Vote Constraints

- **One vote per user per proposal.** Enforced by a **`UNIQUE` constraint** on the `votes` table (user_id + proposal_id). Rely on the DB constraint as the source of truth, not just application logic.
- **Vote changes allowed until the final 12 hours** of a proposal. After that, votes are locked.

### 12.3 Proposal Creation Rules

| Rule | Detail |
|---|---|
| **Minimum holding** | Tier-dependent. **Dolphin+** required for *Chain Selection*, *Tokenomics*, and *Technical* categories. Any verified holder may create other proposal types. |
| **Anti-spam: rate limit** | **24 hours** between proposals by the same user; **max 3 per week**. |
| **Comment rate limit** | **30 seconds** between comments; **2,000-character** cap. |
| **Duplicate detection** | Fuzzy duplicate via **Levenshtein distance ≤ 3** is rejected. |

### 12.4 Delegation Rules

Delegation (Phase 3) lets a holder transfer voting weight to another holder. When implementing:

- A delegator's weight transfers to the delegatee for the duration of a proposal.
- Prevent **circular delegation** (A→B→A) at write time.
- Recompute effective voting power at vote-cast time, not lazily.

> ⚠️ **Rate-limit all write endpoints** via Vercel KV. Anti-spam is enforced both in application code and at the DB-constraint level — defense in depth.

> 💡 Deep dive: [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md) for rules, [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) for implementation.

---

## 13. Roadmap & Where to Help

The roadmap spans **six phases over sixteen weeks**. Here's where high-impact contributions land:

| Phase | Timeline | Focus | High-value contribution areas |
|---|---|---|---|
| **P0 — Foundation** | wk 1–2 | Scaffolding, snapshot CSV→JSON, design system, CI/CD | Snapshot pipeline hardening, CI workflow setup, design-token wiring |
| **P1 — MVP Verify & View** | wk 3–5 | Wallet connect, SIWE, dashboard, admin proposals | SIWE edge cases, dashboard components, admin UI |
| **P2 — Govern** | wk 6–9 | Full proposal lifecycle, real-time vote counting, comments | Vote-tally performance, comment threading, fuzzy-duplicate logic |
| **P3 — Engage** | wk 10–12 | Email + Telegram notifications, display names, delegation | Notification delivery, delegation engine |
| **P4 — Scale** | wk 13–16 | Analytics, snapshot verification, WCAG audit, load test (1K users), security audit | Accessibility fixes, load-test harness, public snapshot hash verification |
| **P5 — Future** | post-16 | PWA, Snapshot v2, Tally on-chain voting, multi-chain, quadratic voting, SDK | Research spikes, prototypes |

**Where to start:**

- **New contributors** → P0/P1 "good first issue" labels, docs improvements, test scaffolding (see [§7](#7-testing-guidelines)).
- **Experienced contributors** → P2 governance logic, P4 security/accessibility audits, snapshot verification.
- **Check open issues** on the GitHub repo for tasks tagged `good-first-issue`, `help-wanted`, and phase-specific labels.

Full roadmap: [`ROADMAP.md`](../ROADMAP.md).

---

## 14. Communication & Community

| Channel | Purpose |
|---|---|
| **Telegram group** | [t.me/omnomtoken_dc](https://t.me/omnomtoken_dc) — community discussion & support |
| **Telegram bot** | [@DBOT_DC_BOT](https://t.me/DBOT_DC_BOT) — automated notifications (Phase 3) |
| **GitHub Issues** | Bug reports, feature requests, task tracking |

### How to Ask Questions

1. **Search existing issues/docs first.** Someone may have already answered.
2. **Be specific:** include what you're trying to do, what you expected, what happened, and relevant logs/commands.
3. Use GitHub Discussions for "how do I…" questions; reserve Issues for actionable bugs/features.

### Code of Conduct

Be respectful, inclusive, and constructive. We follow standard open-source community norms: assume good intent, give credit, and welcome contributors of all experience levels. Harassment or discrimination is not tolerated.

### Reporting Bugs & Security Issues

- **Bugs:** open a GitHub Issue with reproduction steps, environment details, and screenshots.
- **Security vulnerabilities:** **DO NOT open a public issue.** Report privately to the core team via the repository's **security advisory** feature (GitHub → Security → Report a vulnerability) or DM a core maintainer in Telegram. See the security reporting process for coordinated disclosure timelines.

> ⚠️ **Public disclosure of a security flaw before a fix is deployed can harm all 25,431 holders. Always report privately first.**

---

## 15. Glossary & Quick Reference

### Glossary

| Term | Definition |
|---|---|
| **SIWE** | Sign-In with Ethereum (EIP-4361) — off-chain message signing for wallet-based authentication |
| **Snapshot** | A frozen, point-in-time record of token balances (captured at Block 59,922,100) used as the source of voting power |
| **Turso** | Hosted libSQL/SQLite database used for all mutable state (users, proposals, votes, etc.) |
| **Vercel KV** | Redis-compatible key-value store for session cache and rate limiting |
| **Quorum** | Minimum participation threshold required for a proposal to be considered valid |
| **Quadratic voting** | A voting scheme (P5 future) where cost scales with the square of votes, reducing whale dominance |
| **Delegation** | Transferring your voting weight to another verified holder (Phase 3) |
| **Holder tiers** | 🐋 Whale / 🐬 Dolphin / 🐟 Fish — balance-based classification affecting proposal rights |
| **DRC-20** | Token standard on Dogechain (now sunset) to which $OMNOM belongs |
| **JWT** | JSON Web Token (HS256 via `jose`) issued after SIWE; stored in `omnom_token` cookie (7-day expiry) |
| **ISR** | Incremental Static Regeneration — Next.js hybrid rendering used for snapshot pages |

### Command Cheat Sheet

| Command | Action |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server (http://localhost:3000) |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest (watch) |
| `pnpm test:ci` | Run tests once with coverage |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm snapshot:build` | Build the holder snapshot (CSV → JSON → hash) |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Seed test data (proposal_templates) |
| `turso db shell <name>` | Open an interactive SQL shell |
| `turso db studio <name>` | Open Turso Studio (GUI) |
| `turso db show <name> --url` | Print the database URL |
| `turso db tokens create <name>` | Create an auth token |
| `vercel env pull .env.local` | Pull Vercel env vars locally |
| `vercel kv create <name>` | Create a KV store |

### Environment Variables Cheat Sheet

| Variable | Required | Scope |
|---|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | ✅ | Public |
| `JWT_SECRET` | ✅ | Server |
| `TURSO_DATABASE_URL` | ✅ | Server |
| `TURSO_AUTH_TOKEN` | ✅ | Server |
| `NEXT_PUBLIC_ADMIN_ADDRESSES` | ⬜ | Public |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | ⬜ | Public* |
| `RESEND_API_KEY` | ⬜ | Server |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | Public |

\* Token is public-exposed in v1 by design (bot is read-only); review this if the bot gains privileged actions.

---

## 16. Cross-References

| Document | Location | Purpose |
|---|---|---|
| **Project Overview** | [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | Mission, personas, holder tiers, roadmap |
| **Governance Mechanics** | [`GOVERNANCE_MECHANICS.md`](GOVERNANCE_MECHANICS.md) | Proposal lifecycle, vote rules, delegation |
| **Technical Architecture** | [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) | System design, data flows, schema, security |
| **Product Requirements** | [`../PRD.md`](../PRD.md) | Requirements and feature specs |
| **Design Spec** | [`../DESIGN.md`](../DESIGN.md) | Visual design, components, themes |
| **Roadmap** | [`../ROADMAP.md`](../ROADMAP.md) | Six-phase delivery plan |
| **Wallet Flow** | [`../WALLET-FLOW.md`](../WALLET-FLOW.md) | SIWE + wallet interaction details |
| **Data Model** | [`../DATA-MODEL.md`](../DATA-MODEL.md) | Database schema and relationships |

---

> 🐋 **You're ready.** Clone, build, and ship. The 25,431 holders of $OMNOM are counting on what you build next. Welcome to OMNOM DAO.
