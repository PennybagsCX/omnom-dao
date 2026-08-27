# Deploying OMNOMDAO to `www.omnom.dog/dao`

## Recommended architecture

Use a Vercel project connected to your GitHub repository.

Two supported paths exist:

### Option A — subdomain (`dao.omnom.dog`), recommended

A domain-level subdomain avoids rewriting Next.js asset and API paths. Vercel
supports this directly.

1. Create the GitHub repository.
2. In Vercel, **Add New → Project**, import the repository.
3. Framework preset: **Next.js**.
4. Set production environment variables (below).
5. Deploy.
6. In Vercel → Project → Settings → Domains, add:
   `dao.omnom.dog`
7. In your DNS provider, create:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `dao` | `cname.vercel-dns.com` |

8. Vercel issues the TLS certificate after DNS resolves.

### Option B — path (`www.omnom.dog/dao`)

Vercel does not expose a project-wide “deploy under a path” setting. To serve a
Next.js app under `/dao`, use either:

1. **Reverse proxy path routing** from the existing `www.omnom.dog` host:
   - Proxy `/dao/*` to the Vercel deployment.
   - Strip the `/dao` prefix before forwarding, or configure the app to expect
     the prefix.
   - Preserve `Set-Cookie` and redirects.
2. **Deploy this app as the `www.omnom.dog` site** and use Next.js rewrites to
   route legacy paths under `/dao`. This only works if this project owns the
   whole `www` host.
3. **Configure `basePath` conditionally** for a prefix-aware deployment:

   ```ts
   // next.config.ts
   const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
   const nextConfig: NextConfig = {
     basePath,
     output: "standalone",
     // ...
   };
   ```

   Build with `NEXT_PUBLIC_BASE_PATH=/dao`. Internal Next.js assets and links
   then include `/dao`. Test carefully because hard-coded `/api/...` strings,
   `fetch("/data/...")`, OG URLs, SIWE URI/domain checks, and redirect paths
   must respect the prefix. The current codebase has several such paths and is
   **not yet fully basePath-compatible**.

**I could not complete the live custom-domain deployment myself** because this
workspace is not connected to your Vercel account/domain DNS. The generic
deployment connector can produce a preview, but it cannot configure
`www.omnom.dog` DNS or attach the project to your account permanently.

## Required production variables

Copy `.env.production.example` and set these in Vercel → Settings →
Environment Variables:

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | Production libSQL/Turso database URL |
| `TURSO_AUTH_TOKEN` | Production database token |
| `JWT_SECRET` | At least 32 random characters for session signing |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL (used by SIWE domain checks and metadata) |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID (free at cloud.walletconnect.com) |
| `NEXT_PUBLIC_ADMIN_ADDRESSES` | `0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a` |
| `KV_REST_API_URL` | Vercel KV REST endpoint (recommended) |
| `KV_AUTH_TOKEN` | Vercel KV token |
| `CRON_SECRET` | Shared secret for proposal-finalization cron |
| `RESEND_API_KEY` | Optional transactional email |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | Optional Telegram notifications |

Generate a JWT secret:

```bash
openssl rand -base64 48
```

## Production database migration

After the Vercel project has production variables, run locally with the same
production environment:

```bash
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate
```

This creates the current 11-table schema, including:

- `governance_election`
- `governance_election_ballots`
- `governance_election_ballot_events`

## Snapshot artifact deployment

`public/data/holders.json` is generated from the pinned upstream snapshot and
is gitignored because it is large. Before deploying, run:

```bash
npm run fetch:snapshot
```

The script:

1. Downloads the ever-held CSV.
2. Verifies its SHA-256 against `HASHES.json`.
3. Rebuilds `public/data/holders.json`.
4. Updates `snapshot-metadata.json` and `csv-hash.txt`.

For Vercel, either commit the generated artifact (approximately 7.4 MB, within
Vercel limits) or run the fetch/build step during deployment. The simplest
reliable route is to commit the verified artifact because Vercel's repository
size limit is larger than this file.

## Deployment smoke test

1. `GET /api/v1/health` returns success.
2. `GET /api/v1/governance-vote` returns `phase: OPEN`.
3. `/governance-vote` renders at mobile and desktop widths.
4. `/admin` is visible after signing in with the configured admin wallet.
5. Admin election data shows 25,686 eligible wallets.
6. Admin eligibility and ballot/event CSV exports download.
7. Verify with the admin wallet:
   `0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a`.
   It is present in the ever-held corpus with a maximum historical balance of
   approximately 23.946 billion OMNOM.
8. Check SIWE sign-in with a real wallet.
9. Confirm production nonce/verify flow works after Vercel KV is configured.
10. Run `npm run verify:election` against the production Turso database
    (with `SNAPSHOT_SHA256` set) — all checks must pass.
11. Trigger `/api/v1/cron/finalize` manually with `CRON_SECRET` (curl) — must
    return 200. Confirms the cron-bound route works before relying on Vercel's
    scheduler.

## Scheduled jobs

The `vercel.json` at repo root schedules `POST /api/v1/cron/finalize` every 15
minutes. The handler sweeps ACTIVE proposals whose `voting_ends_at` has passed
and transitions them to PASSED / FAILED / EXPIRED based on the final tally.

For Vercel Hobby tier this is included automatically. Confirm the schedule is
visible at **Project → Settings → Cron Jobs** after the first deploy.

Required environment variable:

| Name | Purpose |
|---|---|
| `CRON_SECRET` | Bearer token; the handler verifies it via `timingSafeEqual`. Generate with `openssl rand -hex 32`. |

Without `CRON_SECRET`, the handler returns 401 and the cron job silently fails.

## Third-party services

| Service | Purpose | Required? | Cost/licensing |
|---|---|---|---|
| Vercel | Hosting | Required | Hobby tier free; Pro paid beyond limits |
| GitHub | Source and snapshot data | Required | Free/public repository |
| Turso/libSQL | Governance database | Required for production | Free developer tier; paid at scale |
| Vercel KV | Nonces and rate limiting | Strongly recommended | Free/limited tier |
| WalletConnect Cloud | Mobile/hardware wallet relay | Required for WalletConnect wallets | Free project ID |
| Resend | Email notifications | Optional | Free tier, then paid |
| Telegram Bot API | Telegram notifications | Optional | Free |
| RainbowKit, wagmi, viem, React, Next.js | Application libraries | Included | Open source |
| `DBOT-DC/omnom-token` | Snapshot corpus | Required | Public data repository |

## Remaining user actions

1. Push this project to GitHub.
2. Import it into Vercel.
3. Set production environment variables.
4. Create and migrate the production Turso database.
5. Create Vercel KV and copy its connection variables.
6. Get a real WalletConnect project ID.
7. Choose Option A (`dao.omnom.dog`) or fully implement/test Option B
   (`/dao` basePath).
8. Add DNS records.
9. Run the deployment smoke test above.
10. Start the 14-day election.
