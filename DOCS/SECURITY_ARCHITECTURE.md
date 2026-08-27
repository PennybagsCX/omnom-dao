# $OMNOM DAO — Security Architecture

> **Definitive reference** for the security design, threat model, and hardening measures implemented in the $OMNOM DAO governance platform.

**Version:** 1.0.0
**Last updated:** July 2026
**Status:** Canonical
**Audience:** Developers, security reviewers, and platform operators

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [P0 Hardening (Critical)](#2-p0-hardening-critical)
3. [P1 Hardening (Important)](#3-p1-hardening-important)
4. [Authentication & Session Security](#4-authentication--session-security)
5. [Vote Integrity](#5-vote-integrity)
6. [Snapshot Integrity](#6-snapshot-integrity)
7. [Rate Limiting](#7-rate-limiting)
8. [Admin Transparency](#8-admin-transparency)
9. [Known Limitations](#9-known-limitations)
10. [File Reference](#10-file-reference)

---

## 1. Threat Model

### 1.1 Attack Vectors Analyzed

| Vector | Severity | Mitigation Status |
|---|---|---|
| Double voting | Critical | ✅ DB UNIQUE constraint |
| Replay attacks | High | ✅ Single-use nonce |
| Snapshot tampering | Critical | ✅ SHA-256 verification at startup |
| Rate-limit bypass during KV outage | High | ✅ Fail-closed on critical routes |
| Quorum bypass | High | ✅ Automatic finalization with enforcement |
| Admin capture / single-admin risk | Medium-High | ⚠️ Mitigated via audit log; multi-admin deferred |
| Vote buying / bribery | High (structural) | ⚠️ Inherent to off-chain governance; commit-reveal proposed for v2 |
| Sybil attack (future QTV) | Medium (future) | ⚠️ Identity layer needed before QTV activation |
| Session hijacking | Low | ✅ httpOnly + Secure + SameSite=Strict |
| API abuse / DDoS | Medium | ✅ Multi-layer rate limiting |
| Delegation cartel | Low (v1) / Medium (future) | ✅ Informational-only in v1; cap planned for v2 |

### 1.2 Trust Model

The platform operates with a **single-admin trust model** in v1:

- **Admin** (configured via `NEXT_PUBLIC_ADMIN_ADDRESSES`): gates proposals from Pending Review → Active. All admin actions are publicly logged.
- **Snapshot**: the immutable source of truth for all balances. SHA-256 verified at startup.
- **Server**: trusted to accurately record votes and compute tallies. All results are publicly auditable.
- **Users**: prove wallet ownership via SIWE; one vote per address enforced at DB level.

---

## 2. P0 Hardening (Critical)

### 2.1 Proposal Finalization with Quorum + Supermajority Enforcement

**Problem:** The `quorum_achieved` field was computed and stored on every vote, but no code path enforced it — proposals could "pass" with any participation level.

**Solution:** `src/lib/proposal-finalize.ts`

- When a proposal's voting window ends, the finalization service evaluates:
  1. **Quorum check**: `(For + Against + Abstain) / totalSupply × 100 ≥ quorumRequired`
  2. **Threshold check**:
     - Supermajority types (CHAIN_SELECTION, TOKENOMICS_CHANGE, TECHNICAL): `For / (For + Against) ≥ 0.60`
     - Simple majority types (TREASURY, GUIDELINE, GENERAL): `For > Against`
- **Transition rules:**
  - Quorum not met → `EXPIRED`
  - Quorum met, threshold not met → `FAILED`
  - Quorum met, threshold met → `PASSED`
- **Trigger mechanisms:**
  - Cron endpoint: `POST /api/v1/cron/finalize` (authenticated via `CRON_SECRET`)
  - Lazy evaluation: when GET `/api/v1/proposals/[id]` or the votes route is accessed after the window closes
- Result notifications are dispatched to all verified holders.

### 2.2 Snapshot File Integrity (SHA-256)

**Problem:** `holders.json` was loaded and parsed without verifying its integrity against the embedded hash. A tampered file (deploy compromise, supply-chain attack, corruption) would silently corrupt all governance.

**Solution:** `src/lib/snapshot.ts` → `loadArtifact()`

- Computes `SHA-256(raw file bytes)` and compares against `metadata.csvHash`
- **Production**: hash mismatch → FATAL — refuses to load, returns empty artifact, logs critical error. Governance is disabled.
- **Development**: hash mismatch → WARNING — loads anyway with console warning (dev convenience before hashes are generated).
- `isSnapshotIntegrityVerified()` exported for health-check endpoints.

### 2.3 Fail-Closed Rate Limiting

**Problem:** `rate-limit.ts` failed **open** (allowed all requests) when Vercel KV was unavailable. A production KV outage would strip all abuse protection.

**Solution:** `src/lib/rate-limit.ts` → `checkRateLimit()` now accepts `failClosed` parameter

- `failClosed = true`: when KV is unavailable or errors, requests are **DENIED**
- Applied to: vote casting, proposal creation, delegation management
- `failClosed = false` (default): legacy behavior — allows requests (used for read-only and non-critical routes)
- In development, fail-closed is bypassed to keep the dev loop usable

---

## 3. P1 Hardening (Important)

### 3.1 Per-User Vote-Cast Rate Limit

**Problem:** The vote endpoint (`/api/v1/proposals/[id]/votes`) had no rate limit beyond the IP-level API limit. While the UNIQUE constraint prevents duplicate votes, there was no protection against API-level abuse.

**Solution:** Added `userActionBucket("vote", address)` rate limit (10 attempts per 5 minutes, fail-closed).

### 3.2 Admin Action Audit Log

**Problem:** Admin actions (proposal approvals/rejections) were not publicly logged, creating an opacity risk especially in a single-admin model.

**Solution:** `src/lib/audit-log.ts` + `GET /api/v1/audit-log`

- New `audit_log` table records: actor address, action type, target, details, timestamp
- Every `POST /proposals/[id]/approve` and `POST /proposals/[id]/reject` writes to the audit log
- Public endpoint: `GET /api/v1/audit-log?page=1&pageSize=50` — no auth required
- Mock DB support added (table in `mock-data.ts`, mapping in `mock-db.ts`)

---

## 4. Authentication & Session Security

| Measure | Implementation | File |
|---|---|---|
| Wallet verification | SIWE (EIP-4361) with `personal_sign` | `src/app/api/v1/verify/route.ts` |
| Signature verification | viem `recoverMessageAddress` (EIP-191) | `src/lib/auth.ts` |
| Nonce generation | 16-byte crypto-random, hex-encoded | `src/lib/auth.ts` → `generateNonce()` |
| Nonce storage | Vercel KV, 5-min TTL, single-use | `src/lib/auth.ts` → `consumeNonce()` |
| Session token | HS256 JWT via `jose`, 7-day lifetime | `src/lib/session.ts` |
| Cookie security | httpOnly, Secure (prod), SameSite=Strict | `src/lib/session.ts` |
| Absolute session cap | 90 days max regardless of activity | `src/lib/constants.ts` |
| Rate limit: nonce | 5 per address per 5 min | `src/app/api/v1/nonce/route.ts` |
| Rate limit: verify | 10 per IP per 5 min | `src/app/api/v1/verify/route.ts` |
| Failed verification logging | IP + claimed address (no signature data) | `src/lib/auth.ts` |

**Anti-DoS design:** Signature is verified BEFORE the nonce is consumed. This prevents an attacker from burning a victim's nonce by submitting a garbage signature for their address (login-DoS).

---

## 5. Vote Integrity

| Guarantee | Mechanism | File |
|---|---|---|
| One vote per address | DB UNIQUE(proposal_id, voter_address) | `votes/route.ts` + DB schema |
| Immutable voting power | Frozen at cast time from snapshot | `votes/route.ts` |
| Vote window enforcement | Server-side timestamp check | `votes/route.ts` → `loadContext()` |
| Vote change restriction | While proposal is ACTIVE only | `votes/route.ts` → PUT handler |
| Real-time tally | Denormalized counts recomputed on every vote | `votes/route.ts` |
| Quorum tracking | Computed + stored on every vote cast | `votes/route.ts` |
| Finalization enforcement | Quorum + threshold check at close | `proposal-finalize.ts` |
| Vote rate limit | 10 per user per 5 min, fail-closed | `votes/route.ts` |

---

## 6. Snapshot Integrity

| Property | Implementation |
|---|---|
| Immutability | Static JSON file, never mutated at runtime |
| Load-time verification | SHA-256(file) === metadata.csvHash |
| Production behavior | Mismatch → refuse to load (governance disabled) |
| Dev behavior | Mismatch → warning logged, file loaded |
| Lookup performance | O(log n) binary search on pre-sorted addresses |
| Graceful degradation | Load failure → empty artifact (governance non-functional but app doesn't crash) |

---

## 7. Rate Limiting

| Route | Bucket | Limit | Fail-Closed? |
|---|---|---|---|
| All API (per IP) | `rl:api:ip:{ip}` | 60/min | No |
| `/api/v1/nonce` | `rl:nonce:{addr}` | 5 / 5 min | No |
| `/api/v1/verify` | `rl:api:ip:{ip}` | 10 / 5 min | No |
| Proposal creation | `rl:proposals:{addr}` | 3 / 7 days | **Yes** |
| Vote casting | `rl:vote:{addr}` | 10 / 5 min | **Yes** |
| Comments | `rl:comment:{addr}` | 30 / day | No |

---

## 8. Admin Transparency

| Measure | Status |
|---|---|
| Admin addresses from env var | `NEXT_PUBLIC_ADMIN_ADDRESSES` |
| Proposal approval logged | ✅ Audit log entry with timestamp + actor |
| Proposal rejection logged | ✅ Audit log entry with reason + actor |
| Public audit log endpoint | `GET /api/v1/audit-log` |
| Admin cannot cast votes for users | ✅ Not in any route handler |
| Admin cannot alter vote counts | ✅ No admin route touches vote data |
| Admin cannot change active proposal | ✅ Only DRAFT/PENDING_REVIEW editable |

---

## 9. Known Limitations

1. **Single-admin model** — One person gates proposals. Mitigated by public audit log, but a single point of trust/failure.
2. **No commit-reveal voting** — Votes are visible in real-time, enabling potential coercion/bribery observation.
3. **Linear voting (v1)** — 4 wallets hold ~87% of power. Quadratic voting proposed for v2 but requires identity verification for Sybil safety.
4. **Informational delegation** — Delegation does not transfer voting power in v1.
5. **No multi-sig admin** — Admin control is not distributed across multiple signers.
6. **Off-chain governance** — Outcomes are advisory, not auto-executed.
7. **No vote receipts** — Holders cannot independently verify their vote was recorded beyond the API response.

---

## 10. File Reference

| Component | File |
|---|---|
| Proposal finalization | `src/lib/proposal-finalize.ts` |
| Cron finalize endpoint | `src/app/api/v1/cron/finalize/route.ts` |
| Snapshot integrity | `src/lib/snapshot.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Audit log service | `src/lib/audit-log.ts` |
| Audit log endpoint | `src/app/api/v1/audit-log/route.ts` |
| Auth + SIWE | `src/lib/auth.ts` |
| Session JWT | `src/lib/session.ts` |
| Vote route | `src/app/api/v1/proposals/[id]/votes/route.ts` |
| Proposal routes | `src/app/api/v1/proposals/[id]/route.ts` |
| Approve route | `src/app/api/v1/proposals/[id]/approve/route.ts` |
| Reject route | `src/app/api/v1/proposals/[id]/reject/route.ts` |
| FAQ / Governance Guide | `src/app/faq/page.tsx` |
| Constants | `src/lib/constants.ts` |
| Types | `src/types/index.ts` |

---

*This document is updated whenever security measures are added, modified, or reviewed. All changes should be reflected in the FAQ page (`src/app/faq/page.tsx`) to ensure holders have accurate information.*
