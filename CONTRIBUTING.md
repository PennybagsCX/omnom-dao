# Contributing to OMNOMDAO

OMNOMDAO is open source under the MIT License. Contributions are welcome!

## Getting Started

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local` and fill in values
4. Run `npm run dev`

## Development

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Web3:** wagmi v2, RainbowKit v2, viem
- **Database:** Turso (libSQL) in production, in-memory mock in dev

## Before Submitting a PR

1. `npx tsc --noEmit` — zero TypeScript errors
2. `npm run lint` — zero ESLint errors
3. `npx vitest run` — all unit tests pass
4. `npx playwright test` — all e2e tests pass

## Security

- **Never commit `.env.local`** — it contains real secrets
- **Never hardcode API keys, private keys, or tokens** in source files
- The dev mock wallet (`0xac0974...`) is viem's publicly documented test key #0 — it has zero value
- Report security issues privately, not via public issues

## Snapshot Data

Holder snapshot data is sourced from [DBOT-DC/omnom-token](https://github.com/DBOT-DC/omnom-token).
The `holders.json` file is generated from the ever-held master list and should not be edited manually.
