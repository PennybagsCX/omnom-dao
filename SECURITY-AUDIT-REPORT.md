# OMNOM DAO Security Audit Report

**Agent**: Security Auditor (ad28c42a7f695dd02)
**Date**: 2026-08-24
**Duration**: 491.3s (8.2 minutes)
**Scope**: Full platform, voting-system integrity focus
**Overall Risk**: **HIGH**

---

## Executive Summary

Election result counting is structurally sound (double-vote and injection resistant), but **three claimed/necessary integrity controls do not actually function**, and the primary voting endpoint has zero abuse protection.

**Findings Summary**:
- **3 Critical** (C-01, C-02, C-03)
- **4 High** (H-01, H-02, H-03, H-04)
- **5 Medium** (M-01 through M-05)
- **5 Low** (L-01 through L-05)

---

## CRITICAL FINDINGS

### C-01: Snapshot SHA-256 Integrity Verification Disabled

**Location**: `src/lib/snapshot.ts` (line ~169)

**Evidence**:
```typescript
const fileHash = createHash("sha256").update(fileContents).digest("hex");
const integrityOk = true; // HARDCODED - CHECK DISABLED
if (!integrityOk) { // unreachable dead code
  if (process.env.NODE_ENV === "production") {
    console.error(`[snapshot] FATAL INTEGRITY FAILURE...`);
  }
}
```

**Impact**: 
- `public/data/holders.json` is the sole source of voter eligibility and vote weight
- Anyone with write access to deploy artifact can add attacker wallets with whale balances
- Governance proceeds with zero tamper detection
- Public FAQ claims: "SHA-256 integrity check ... a mismatch in production halts governance" — **FALSE**

**PoC**:
```bash
# On compromised build/CI runner:
echo '{"sortedAddresses":[],"holders":{"0xattacker...":{"rank":1,"balanceRaw":"900000000000000000000000","holderClass":"WHALE"}},"metadata":{...}}' > "public/data/holders.json"
# Redeploy -> attacker wallet is now eligible whale. No startup error.
```

**Remediation**:
```typescript
// At generation time (scripts/build-snapshot.ts):
writeFileSync("public/data/holders.json", artifact);
writeFileSync("public/data/holders.json.sha256", sha256(artifact));
// Deployment: SNAPSHOT_SHA256=<hash> vercel env add

// At load time (src/lib/snapshot.ts):
const expected = process.env.SNAPSHOT_SHA256; // pinned at deploy
const integrityOk = !!expected && fileHash === expected;
if (!integrityOk) {
  integrityVerified = false;
  if (process.env.NODE_ENV === "production") {
    console.error("[snapshot] FATAL INTEGRITY FAILURE:", { expected, fileHash });
    loadPromise = null;
    return getEmptyArtifact(); // halts governance
  }
}
```

---

### C-02: Production Silently Falls Back to In-Memory Mock Database

**Location**: `src/lib/db.ts` lines 28–38, 55–65

**Evidence**:
- If `TURSO_DATABASE_URL` or `TURSO_AUTH_TOKEN` is missing/empty/`mock://`
- `getDb()` returns `getMockDbClient()` — in-memory, per-instance
- **No production guard**

**Impact**:
1. DB UNIQUE constraints become per-instance (one wallet = one ballot per instance)
2. Ballots and audit events vanish between invocations
3. Tallies are garbage
4. Only signal: single `[DB] Running in MOCK mode` log line

**PoC**:
```bash
# Deploy with TURSO_AUTH_TOKEN=""
# Hit POST /api/v1/governance-vote repeatedly from two sessions
# Each cold-start instance accepts fresh ballot for same wallet
# Election totals exceed eligible-voter count
```

**Remediation**:
```typescript
// src/lib/db.ts
export function isMockMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  /* existing env checks */
}

export function getDb(): Client {
  if (process.env.NODE_ENV === "production" && !process.env.TURSO_DATABASE_URL) {
    throw new Error("FATAL: TURSO_DATABASE_URL missing in production. Refusing to start.");
  }
  /* ... */
}
```

---

### C-03: Proposal Voting Power Read from 7-Day-Old JWT

**Locations**:
- `src/app/api/v1/proposals/[id]/votes/route.ts` line 178
- `src/app/api/v1/dev-login/route.ts` lines 58–66

**Evidence**:
```typescript
// votes/route.ts
const votingPower = session.votingPower; // from JWT, NOT snapshot
```

**Impact**:
1. **Stale weights**: Holder who sells all tokens today keeps full vote for 7 days; buyer gets none
2. **Dev-login bypass**: One mis-set `NODE_ENV` exposes unauthenticated minting of `votingPower: 99999999`

**PoC**:
```bash
curl -X POST http://target:3000/api/v1/dev-login \
  -H 'content-type: application/json' \
  -d '{"walletAddress":"0xattacker...","holderClass":"WHALE","votingPower":99999999}' \
  -c jar.txt
curl -X POST http://target:3000/api/v1/proposals/<id>/votes \
  -H 'content-type: application/json' -b jar.txt \
  -d '{"choice":"FOR"}' # weight 99999999 recorded
```

**Remediation**:
```typescript
// votes/route.ts POST + PUT — recompute at cast time
const holder = await lookupHolder(session.sub);
if (!holder) return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 403);
const votingPower = Number(BigInt(holder.balanceRaw) / BigInt(1e18));
```

---

## HIGH FINDINGS

### H-01: `governance-vote` Has No Rate Limiting

**Location**: `src/app/api/v1/governance-vote/route.ts` (POST handler)

**Impact**:
- Authenticated holder can script thousands of ballot flips per minute
- Unbounded `governance_election_ballot_events` growth (audit trail destruction)
- Turso row-write cost amplification
- Latency degradation for all voters

**Remediation**:
```typescript
// governance-vote/route.ts POST, after requireAuth:
const rl = await checkRateLimit(
  userActionBucket("election-vote", session.sub),
  10, 5 * 60,
  true, // failClosed
);
if (!rl.allowed) return apiError(ErrorCode.RATE_LIMITED, "Too many ballot updates.", 429);
```

---

### H-02: `dev-auth-test` Endpoint Ships to Production

**Location**: `src/app/api/v1/dev-auth-test/route.ts`

**Impact**:
- No `NODE_ENV` guard
- Sets httpOnly cookie (name mismatch, doesn't grant voting session)
- One rename away from backdoor

**Remediation**: Delete `dev-auth-test`, `test-public`, `simple-auth`; add CI guard for dev-named routes.

---

### H-03: No Security Headers, No Middleware

**Location**: `next.config.ts` (only `reactStrictMode` and `poweredByHeader`); no `middleware.ts`

**Impact**:
- No Content-Security-Policy (XSS blast radius)
- No HSTS (protocol downgrade)
- No X-Frame-Options (clickjacking of wallet-connect)
- No Referrer-Policy

**Remediation**: Create `src/middleware.ts` with security headers.

---

### H-04: Client IP Extracted from Spoofable `x-forwarded-for`

**Location**: `src/lib/request.ts` (`getClientIp`)

**Impact**: Self-hosted behind nginx without XFF sanitization → attacker rotates header to get fresh bucket every request.

**Remediation**: Trust proxy headers only behind known hop count; `TRUST_PROXY_DEPTH` env var.

---

## MEDIUM FINDINGS

### M-01: Non-Atomic Ballot/Tally Operations (Race Conditions)

**Location**: `governance-vote/route.ts` SELECT-then-INSERT/UPDATE with no transaction

**Impact**: Two concurrent first-ballots both INSERT → duplicate CAST events in audit trail

**Remediation**: Wrap in `db.transaction(...)`; make audit-event insert conditional on ballot write changing a row.

---

### M-02: No Session Revocation

**Location**: `src/lib/session.ts` — stolen `omnom_token` valid for full 7-day `exp` with no server-side invalidation

**Remediation**: Add `jti` claim + KV denylist or shorten `exp` to 24h.

---

### M-03: `absMax` (90-Day Absolute Lifetime) is Dead Code

**Location**: `src/lib/session.ts` sets the claim; `verifySession` never validates it

**Remediation**: Enforce it or delete the constant.

---

### M-04: `votes/live` Polling Endpoint Lacks Caching/Rate Limiting

**Impact**: Unauthenticated DB-backed SELECT on polling cadence — cheap DoS surface

**Remediation**: Add per-IP limit or move to short-TTL cached tally.

---

### M-05: Admin Election Exports Unthrottled

**Impact**: `admin/election?export=eligibility` serializes entire holders corpus per request

**Remediation**: Add limit for hygiene.

---

## LOW FINDINGS

### L-01: Hardcoded Hardhat Private Key

**Location**: `src/config/enhanced-mock-wallet.ts` (imports into client bundle)

**Remediation**: `await import()` behind `NODE_ENV` check.

---

### L-02: `NEXT_PUBLIC_ADMIN_ADDRESSES` Exposed in Client Bundle

**Remediation**: Use server-only `ADMIN_ADDRESSES` env var.

---

### L-03: Public `audit-log` Endpoint Unpaginated Scraping

**Note**: By design for transparency; pageSize capped at 100.

---

### L-04: SIWE Parser is Hand-Rolled Subset

**Remediation**: Adopt `siwe` library before supporting third-party wallets.

---

### L-05: `expirationTime` Parse Failure Silently Ignored

**Remediation**: Reject unparseable timestamps.

---

## VULNERABILITY TEST VERDICTS

| # | Test | Verdict | Notes |
|---|------|---------|-------|
| 1 | Vote manipulation post-submission | **PASS** | Updatable until close (by design) |
| 2 | Double voting | **PASS** | UNIQUE constraints; ON CONFLICT DO NOTHING |
| 3 | Signature replay | **PASS** | Single-use KV nonce; domain binding |
| 4 | Ballot stuffing by ineligible wallets | **PASS*** | Dependent on unverified holders.json (C-01) |
| 5 | Timing attacks outside windows | **PASS** | Server clock; phase checks enforced |
| 6 | Race conditions | **PARTIAL** | Counts protected; audit-trail duplicates (M-01) |
| 7 | Database injection | **PASS** | All queries use `?` placeholders |
| 8 | Session hijacking | **PASS*** | httpOnly + Secure + SameSite=strict; no revocation (M-02) |
| 9 | API abuse / rate limiting | **FAIL** | Governance-vote POST unlimited (H-01) |
| 10 | Smart contract risks | **N/A** | Off-chain; signing is EIP-191 `personal_sign` |

---

## PRIORITIZED REMEDIATION

**Immediate (before any real election):**
1. ✅ C-01: Implement SHA-256 verification
2. ✅ C-02: Add production throw in `db.ts`
3. ✅ H-01: Add fail-closed rate limiting to `governance-vote`
4. ✅ H-02: Delete dev-auth-test, test-public, simple-auth

**Short-term:**
5. ✅ C-03: Recompute voting power from snapshot at cast time
6. ✅ H-03: Ship `middleware.ts` security headers
7. ✅ H-04: Harden `getClientIp` proxy trust
8. ✅ M-01: Transactional ballot writes

**Structural:**
9. ✅ M-02/M-03: `jti` + KV session denylist or shorter token life
10. ✅ L-01: Dynamic-import dev wallet behind `NODE_ENV`
11. ✅ Add SAST gate (Semgrep) for disabled security checks

---

## Conclusion

The cryptographic and database layers are well built — replay, double-voting, injection, and window enforcement all hold. The election's real weaknesses are **three disabled-or-missing backstops** plus the unprotected flagship endpoint.

**Fix C-01/C-02/H-01 before casting a single real ballot.**
