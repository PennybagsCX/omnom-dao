---
name: admin-approve-bug-root-cause-found
description: Root cause of admin approve bug identified through browser testing
metadata:
  type: project
  node_type: memory
  originSessionId: 79963e70-ec6b-42c5-9ea3-02f7d59f3a90
  modified: 2026-08-24T19:39:54.219Z
---

# Admin Approve Bug — Root Cause Found

**Date**: 2026-08-24

## Problem Confirmed Through Browser Testing

The approve button returns 200 success but the proposal status doesn't change from PENDING_REVIEW to ACTIVE.

## Root Cause

**Double-layer module caching issue:**

1. `getMockStore()` in `mock-data.ts` was fixed to use `globalThis.__omnomMockStore`
2. **BUT** `db.ts` has module-level caching: `let client: Client | null = null`
3. **AND** `mock-db.ts` exports a module-level const: `export const mockDbClient: Client`

Under Turbopack, each route module gets its own instance of these module-level singletons:
- Route A imports `db.ts` → gets instance of `client` cache → gets `mockDbClient` → calls `getMockStore()`
- Route B imports `db.ts` → gets DIFFERENT instance of `client` cache → gets `mockDbClient` → calls `getMockStore()`

Even though `getMockStore()` uses `globalThis`, the module-level caching above it creates separate flows.

## Evidence from Browser Test

```json
{
  "beforeCount": 0,           // Pending queue already empty
  "approveStatus": 200,       // Approve request succeeds
  "approveData": {
    "status": "PENDING_REVIEW" // BUT status unchanged!
  },
  "afterCount": 0,            // Queue still empty
  "proposalStatus": "PENDING_REVIEW" // Still not ACTIVE
}
```

## Fix Required

Apply `globalThis` caching to **both layers**:
1. ✅ `getMockStore()` in `mock-data.ts` — DONE
2. ❌ `getDb()` client cache in `db.ts` — NEEDS FIX
3. ❌ `mockDbClient` export in `mock-db.ts` — NEEDS FIX

The fix pattern is the same: replace module-level singletons with `globalThis`-keyed singletons.
