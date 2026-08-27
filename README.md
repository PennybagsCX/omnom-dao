# $OMNOM DAO — Governance Platform

**Off-chain, snapshot-based governance for $OMNOM token holders.**

OMNOM DAO is a Next.js 16 (App Router) monolith that performs fully off-chain,
advisory governance against a **frozen token-holding snapshot** (Dogechain block
59,922,100, captured 2026-06-07). Because Dogechain is sunset, there are no live
smart contracts and no on-chain interactions — identity is proven via **SIWE
(EIP-4361)** message signing, verified server-side, then cross-referenced
against the immutable snapshot via O(log n) binary search.

> This repository contains the **Phase 0 Foundation** scaffold.

---

## 📚 Documentation (source of truth)

All architecture, design, and data-model decisions live in the `DOCS/` folder
and the root specs. **Read these first** — they supersede any conflicting
convention:

| Document | Purpose |
| --- | --- |
| [`DOCS/TECHNICAL_ARCHITECTURE.md`](./DOCS/TECHNICAL_ARCHITECTURE.md) | System architecture, data flows, security model |
| [`DOCS/CONTRIBUTOR_ONBOARDING.md`](./DOCS/CONTRIBUTOR_ONBOARDING.md) | Dev setup, workflow, coding standards |
| [`DOCS/GOVERNANCE_MECHANICS.md`](./DOCS/GOVERNANCE_MECHANICS.md) | Proposal lifecycle, vote rules |
| [`DOCS/PROJECT_OVERVIEW.md`](./DOCS/PROJECT_OVERVIEW.md) | Product context, personas |
| [`DATA-MODEL.md`](./DATA-MODEL.md) | Canonical TypeScript types + SQLite DDL |
| [`DESIGN.md`](./DESIGN.md) | Visual design system, UX, page specs |
| [`PRD.md`](./PRD.md) · [`ROADMAP.md`](./ROADMAP.md) · [`WALLET-FLOW.md`](./WALLET-FLOW.md) | Product / roadmap / SIWE flow |

---

## 🧱 Tech Stack

Next.js 15 · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui ·
RainbowKit v2 · wagmi v3 · viem · TanStack Query · Turso (libSQL) · Vercel KV ·
jose (JWT) · Zod · Vitest · Playwright.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   fill in NEXT_PUBLIC_WC_PROJECT_ID, JWT_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

# 3. Fetch the frozen snapshot (pinned commit) and verify SHA-256
npm run fetch:snapshot

# 4. Run the dev server
npm run dev          # → http://localhost:3000
```

### Database setup (requires a Turso database)

```bash
npm run db:migrate   # creates the 7 tables + indexes
npm run db:seed      # seeds the 6 proposal_templates
```

---

## 📜 Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (standalone output) |
| `npm run lint` | ESLint (Next.js + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` strict type check |
| `npm test` | Vitest unit/integration suite |
| `npm run test:e2e` | Playwright E2E suite |
| `npm run fetch:snapshot` | Fetch pinned snapshot CSVs + build `data/holders.json` |
| `npm run verify:election` | Post-deploy smoke: election row + snapshot pin |
| `npm run db:migrate` | Apply Turso schema migrations |
| `npm run db:seed` | Seed proposal_templates + foundational governance election row |

---

## 🗂️ Project Structure

```
src/
  app/            # App Router: layout, pages, api/
  components/
    ui/           # shadcn/ui primitives
    layout/       # site header / footer
    wallet/       # wallet connection components
  config/         # wagmi / RainbowKit config
  lib/            # db, auth, snapshot, utils, validators, constants
  types/          # all TypeScript types (mirrors DATA-MODEL.md)
  middleware.ts
public/
  data/           # snapshot build artifacts (metadata, csv hash)
scripts/
  fetch-snapshot.sh       # Pinned DBOT-DC/omnom-snapshot fetcher
  migrate.ts              # Turso/libSQL schema migrations
  seed-db.ts              # proposal_templates + foundational election row
  verify-election.ts      # Post-deploy smoke test
  data/snapshot.sample.csv
data/
  holders.json            # server-only; gitignored, traced into API lambdas
vercel.json               # Cron schedule for /api/v1/cron/finalize
```

---

## 🔐 Security Notes

- **Never commit secrets.** `.env.local` is gitignored.
- All Turso queries use **parameterized statements**.
- User-supplied HTML/Markdown is sanitized with **DOMPurify** before render.
- JWTs are HS256, stored in `httpOnly` + `Secure` + `SameSite=Strict` cookies.
- The snapshot is an **immutable static asset** sealed with a SHA-256 hash.

---

## 📄 License

MIT © OMNOM DAO Core Team
