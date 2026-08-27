# $OMNOM DAO Governance Platform — Data Model Reference

---

## Document Metadata

- **Document Title:** $OMNOM DAO — Data Model & Schema Reference
- **Version:** 1.0.0
- **Author:** DBOT / OMNOM DAO Core Team
- **Date:** 2026-06-23
- **Status:** Draft — Under Review
- **Related Docs:** PRD.md, DESIGN.md, WALLET-FLOW.md

---

## Table of Contents

1. [Snapshot Data Model](#1-snapshot-data-model)
2. [User / Session Model](#2-user--session-model)
3. [Proposal Model](#3-proposal-model)
4. [Vote Model](#4-vote-model)
5. [Notification Model](#5-notification-model)
6. [Database Schema (Turso / SQLite)](#6-database-schema-turso--sqlite)
7. [API Request / Response Types](#7-api-request--response-types)
8. [Snapshot Data Processing](#8-snapshot-data-processing)

---

## 1. Snapshot Data Model

The snapshot is the immutable foundation of all governance power. It was captured at a single point in time and never changes.

### 1.1 Enums

```typescript
/**
 * Holder classification based on percentage of total supply.
 *
 * 7-tier marine-ecosystem model with inclusive lower-bound thresholds.
 * FISH retained as @deprecated legacy mapping for outstanding JWTs (≤7d expiry).
 */
enum HolderClass {
  // Live tiers (descending rank by % of total supply)
  KRAKEN = "KRAKEN",     // ≥ 10% of supply — 🦑
  WHALE = "WHALE",       // ≥ 1% of supply — 🐋
  DOLPHIN = "DOLPHIN",   // ≥ 0.1% of supply — 🐬
  SHARK = "SHARK",       // ≥ 0.01% of supply — 🦈
  OCTOPUS = "OCTOPUS",   // ≥ 0.001% of supply — 🐙
  CRAB = "CRAB",         // ≥ 0.0001% of supply — 🦀
  SEAHORSE = "SEAHORSE", // < 0.0001% of supply — 🦄 (no seahorse emoji exists)

  // Legacy: outstanding JWTs may still carry FISH; maps to Seahorse rank
  /** @deprecated Use SEAHORSE for new classifications */
  FISH = "FISH",
}
```

### 1.2 HolderSnapshot

```typescript
/**
 * Represents a single holder record from the frozen snapshot.
 * Source: snapshot CSV at Block 59,922,100 (2026-06-07 23:59:58 UTC).
 * This data is NEVER mutated after snapshot finalization.
 */
interface HolderSnapshot {
  /** EVM address, checksummed (0x + 40 hex chars) */
  address: string;

  /** Rank by balance, descending (1 = largest holder) */
  rank: number;

  /** Raw balance in wei (18 decimals), as BigInt for precision */
  balanceRaw: bigint;

  /** Human-readable balance with decimals applied */
  balanceFormatted: string;

  /** Percentage of total supply this holder owns (e.g. 13.78) */
  percentageOfSupply: number;

  /** Derived holder class based on percentageOfSupply */
  holderClass: HolderClass;
}
```

### 1.3 SnapshotMetadata

```typescript
/**
 * Metadata describing the snapshot itself.
 * Used for immutability verification and UI display.
 */
interface SnapshotMetadata {
  /** Dogechain block number at snapshot time */
  blockNumber: 59_922_100;

  /** ISO 8601 UTC timestamp of snapshot */
  timestamp: "2026-06-07T23:59:58.000Z";

  /** Total unique holder addresses in snapshot (ever-held) */
  totalHolders: 25_686;

  /** Total supply captured in snapshot (raw wei) */
  totalSupply: bigint;

  /** $OMNOM contract address on Dogechain */
  contractAddress: "0xe3fcA919883950c5cD468156392a6477Ff5d18de";

  /** SHA-256 hash of the canonical snapshot CSV for integrity verification */
  csvHash: string;

  /** Holder class distribution counts (ever-held snapshot) */
  distribution: {
    krakens: number;    // 1
    whales: number;     // 3
    dolphins: number;   // 30
    sharks: number;     // 326
    octopuses: number;  // 1,078
    crabs: number;      // 1,701
    seahorses: number;  // 22,547
  };
}
```

---

## 2. User / Session Model

Users are created lazily on first successful wallet verification. They are NOT snapshot data — they represent platform activity.

### 2.1 User

```typescript
interface User {
  /** Internal UUID primary key */
  id: string;

  /** Verified EVM wallet address (checksummed) — immutable after creation */
  walletAddress: string;

  /** User-chosen display name (defaults to truncated address) */
  displayName: string;

  /** ISO 8601 creation timestamp */
  createdAt: string;

  /** ISO 8601 timestamp of most recent successful sign-in */
  lastLoginAt: string;
}
```

### 2.2 UserSession

```typescript
interface UserSession {
  /** Internal UUID */
  id: string;

  /** FK to users.id */
  userId: string;

  /** Wallet address at time of session creation (denormalized for fast lookup) */
  walletAddress: string;

  /** JWT expiry time (ISO 8601) — default 7 days */
  jwtExpiry: string;

  /** Session creation time */
  createdAt: string;
}
```

### 2.3 UserSettings

```typescript
interface UserSettings {
  /** FK to users.id */
  userId: string;

  /** Email / Telegram / push notification preferences */
  notifications: {
    proposalCreated: boolean;
    votingStarted: boolean;
    votingEndingSoon: boolean;  // 24h before close
    proposalResult: boolean;
    mention: boolean;
  };

  /** Preferred wallet provider name for UI hints (e.g. "metamask", "walletconnect") */
  preferredWallet: string | null;

  /** Token display format preference */
  displayFormat: "full" | "abbreviated" | "raw";
}
```

---

## 3. Proposal Model

### 3.1 Enums

```typescript
enum ProposalType {
  CHAIN_SELECTION = "CHAIN_SELECTION",     // Where to relaunch / migrate
  TOKENOMICS_CHANGE = "TOKENOMICS_CHANGE", // Supply changes, burns, emissions
  TREASURY = "TREASURY",                   // Fund allocation, spending
  GUIDELINE = "GUIDELINE",                 // Community rules, code of conduct
  TECHNICAL = "TECHNICAL",                 // Platform features, integrations
  GENERAL = "GENERAL",                     // Anything else
}

/**
 * Proposal creation eligibility by holder class.
 *
 * High-impact proposal types require Shark+ (≥0.01% of supply).
 * Floor types are open to any holder (Seahorse+).
 *
 * Threshold-preserving migration: Shark+ (≥0.01%) ≈ old Dolphin+ gate, identical ~326 wallets.
 */
const PROPOSAL_ELIGIBILITY: Record<ProposalType, HolderClass> = {
  CHAIN_SELECTION: HolderClass.SHARK,     // ≥0.01%
  TOKENOMICS_CHANGE: HolderClass.SHARK,   // ≥0.01%
  TECHNICAL: HolderClass.SHARK,           // ≥0.01%
  TREASURY: HolderClass.SEAHORSE,         // any holder
  GUIDELINE: HolderClass.SEAHORSE,        // any holder
  GENERAL: HolderClass.SEAHORSE,          // any holder
} as const;

enum ProposalStatus {
  DRAFT = "DRAFT",                 // Author editing, not visible to voters
  PENDING_REVIEW = "PENDING_REVIEW", // Submitted, awaiting admin/mod review
  ACTIVE = "ACTIVE",               // Voting is open
  CLOSED = "CLOSED",               // Voting period ended, not yet finalized
  PASSED = "PASSED",               // Quorum met + majority for
  FAILED = "FAILED",               // Quorum not met OR majority against
  EXPIRED = "EXPIRED",             // Auto-expired without reaching quorum
}
```

### 3.2 Proposal

```typescript
interface Proposal {
  /** Internal UUID primary key */
  id: string;

  /** Human-readable proposal title (max 200 chars) */
  title: string;

  /** Full Markdown description body */
  description: string;

  /** Category of the proposal */
  type: ProposalType;

  /** Current lifecycle status */
  status: ProposalStatus;

  /** Checksummed EVM address of the proposal author */
  authorAddress: string;

  /** ISO 8601 creation timestamp */
  createdAt: string;

  /** ISO 8601 — when voting opens (null until approved) */
  votingStartsAt: string | null;

  /** ISO 8601 — when voting closes */
  votingEndsAt: string | null;

  /** Minimum participation % of total voting power required to pass */
  quorumRequired: number; // e.g. 10.0 = 10%

  /** Actual participation % achieved (computed on close) */
  quorumAchieved: number | null;

  /** Aggregate vote counts (denormalized for fast reads, recomputed on write) */
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;

  /** Flexible metadata bag for type-specific fields */
  metadata: ProposalMetadata;
}

/** Discriminated union of type-specific metadata */
type ProposalMetadata =
  | ChainSelectionMeta
  | TokenomicsChangeMeta
  | TreasuryMeta
  | TechnicalMeta
  | BaseMeta; // fallback for GUIDELINE, GENERAL

interface BaseMeta {
  type: "base";
  links: string[];
  tags: string[];
}

interface ChainSelectionMeta extends BaseMeta {
  type: "CHAIN_SELECTION";
  candidateChains: Array<{
    chainId: number;
    chainName: string;
    rationale: string;
  }>;
}

interface TokenomicsChangeMeta extends BaseMeta {
  type: "TOKENOMICS_CHANGE";
  changeType: "burn" | "mint" | "rebase" | "migration";
  targetAmount?: string;
  description: string;
}

interface TreasuryMeta extends BaseMeta {
  type: "TREASURY";
  amount: string;
  recipient?: string;
  purpose: string;
}

interface TechnicalMeta extends BaseMeta {
  type: "TECHNICAL";
  githubUrl?: string;
  specification: string;
  implementationPlan?: string;
}
```

### 3.3 ProposalTemplate

```typescript
/**
 * Pre-defined templates to standardize common proposal types.
 * Shown to authors when creating a new proposal.
 */
interface ProposalTemplate {
  /** The proposal type this template covers */
  type: ProposalType;

  /** Suggested title prefix */
  title: string;

  /** Markdown template with placeholder variables (e.g. {{chain_name}}) */
  description: string;

  /** Default quorum percentage for this type */
  defaultQuorum: number;

  /** Default voting duration in hours */
  defaultDurationHours: number;

  /** List of required fields specific to this type */
  requiredFields: string[];
}
```

### 3.4 ProposalComment

```typescript
interface ProposalComment {
  /** Internal UUID */
  id: string;

  /** FK to proposals.id */
  proposalId: string;

  /** Checksummed EVM address of commenter */
  authorAddress: string;

  /** Comment body (Markdown, max 2000 chars) */
  content: string;

  /** ISO 8601 timestamp */
  createdAt: string;

  /** Parent comment ID for threaded replies (null = top-level) */
  parentId: string | null;

  /** Soft-delete flag */
  deletedAt: string | null;
}
```

---

## 4. Vote Model

### 4.1 Enums

```typescript
enum VoteChoice {
  FOR = "FOR",
  AGAINST = "AGAINST",
  ABSTAIN = "ABSTAIN",
}
```

### 4.2 Vote

```typescript
interface Vote {
  /** Internal UUID */
  id: string;

  /** FK to proposals.id */
  proposalId: string;

  /** Checksummed EVM address of voter */
  voterAddress: string;

  /** The voter's choice */
  choice: VoteChoice;

  /**
   * Voting power used for this vote.
   * Sourced from the snapshot (balanceRaw at Block 59,922,100).
   * Stored as number (formatted) for display, but computed from balanceRaw for precision.
   */
  votingPower: number;

  /** ISO 8601 timestamp of vote cast */
  createdAt: string;

  /** Optional transaction hash if vote is anchored on-chain (future feature) */
  txHash: string | null;
}
```

> **Constraint:** One vote per (proposalId, voterAddress) pair. Subsequent votes by the same address on the same proposal are rejected at the application layer AND enforced by a UNIQUE database constraint.

### 4.3 VoteResult

```typescript
/**
 * Computed result after a proposal's voting period closes.
 * NOT stored as a separate table — derived from votes + snapshot data.
 */
interface VoteResult {
  /** FK to proposals.id */
  proposalId: string;

  /** Total voting power cast FOR */
  totalFor: number;

  /** Total voting power cast AGAINST */
  totalAgainst: number;

  /** Total voting power cast ABSTAIN */
  totalAbstain: number;

  /** (totalFor + totalAgainst + totalAbstain) / totalSnapshotSupply * 100 */
  quorumPercentage: number;

  /** true if quorumRequired is met AND totalFor > totalAgainst */
  passed: boolean;

  /** ISO 8601 timestamp when result was finalized */
  finalizedAt: string;
}
```

---

## 5. Notification Model

### 5.1 Enums

```typescript
enum NotificationType {
  PROPOSAL_CREATED = "PROPOSAL_CREATED",
  VOTING_STARTED = "VOTING_STARTED",
  VOTING_ENDING_SOON = "VOTING_ENDING_SOON",
  PROPOSAL_RESULT = "PROPOSAL_RESULT",
  MENTION = "MENTION",
}
```

### 5.2 Notification

```typescript
interface Notification {
  /** Internal UUID */
  id: string;

  /** FK to users.id */
  userId: string;

  /** Notification category */
  type: NotificationType;

  /** Short title for push/in-app display (max 100 chars) */
  title: string;

  /** Full body text (max 500 chars) */
  body: string;

  /** Whether the user has acknowledged this notification */
  read: boolean;

  /** FK to proposals.id if notification is proposal-related (null otherwise) */
  proposalId: string | null;

  /** ISO 8601 timestamp */
  createdAt: string;
}
```

---

## 6. Database Schema (Turso / SQLite)

Turso uses libSQL, a fork of SQLite with distributed replication. The schema below is standard SQLite DDL compatible with both.

### 6.1 Users

```sql
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  wallet_address  TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT uq_users_wallet UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_users_wallet
  ON users (wallet_address);
```

### 6.2 Proposals

```sql
CREATE TABLE IF NOT EXISTS proposals (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title             TEXT NOT NULL CHECK (length(title) <= 200),
  description       TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'GENERAL'
                    CHECK (type IN (
                      'CHAIN_SELECTION', 'TOKENOMICS_CHANGE', 'TREASURY',
                      'GUIDELINE', 'TECHNICAL', 'GENERAL'
                    )),
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN (
                      'DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'CLOSED',
                      'PASSED', 'FAILED', 'EXPIRED'
                    )),
  author_address    TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  voting_starts_at  TEXT,  -- NULL until approved
  voting_ends_at    TEXT,  -- NULL until approved
  quorum_required   REAL NOT NULL DEFAULT 10.0,
  quorum_achieved   REAL,  -- NULL until voting closes
  votes_for         INTEGER NOT NULL DEFAULT 0,
  votes_against     INTEGER NOT NULL DEFAULT 0,
  votes_abstain     INTEGER NOT NULL DEFAULT 0,
  metadata          TEXT NOT NULL DEFAULT '{}', -- JSON

  FOREIGN KEY (author_address) REFERENCES users (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_proposals_status
  ON proposals (status);

CREATE INDEX IF NOT EXISTS idx_proposals_author
  ON proposals (author_address);

CREATE INDEX IF NOT EXISTS idx_proposals_voting_period
  ON proposals (voting_starts_at, voting_ends_at)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_proposals_created
  ON proposals (created_at DESC);
```

### 6.3 Votes

```sql
CREATE TABLE IF NOT EXISTS votes (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  proposal_id     TEXT NOT NULL,
  voter_address   TEXT NOT NULL,
  choice          TEXT NOT NULL CHECK (choice IN ('FOR', 'AGAINST', 'ABSTAIN')),
  voting_power    REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  tx_hash         TEXT,

  CONSTRAINT uq_votes_proposal_voter UNIQUE (proposal_id, voter_address),
  FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE CASCADE,
  FOREIGN KEY (voter_address) REFERENCES users (wallet_address)
);

-- Primary lookup: all votes for a proposal
CREATE INDEX IF NOT EXISTS idx_votes_proposal
  ON votes (proposal_id);

-- Reverse lookup: all proposals a user voted on
CREATE INDEX IF NOT EXISTS idx_votes_voter
  ON votes (voter_address);

-- Fast count by choice for a proposal (covering index)
CREATE INDEX IF NOT EXISTS idx_votes_proposal_choice
  ON votes (proposal_id, choice);
```

### 6.4 Comments

```sql
CREATE TABLE IF NOT EXISTS comments (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  proposal_id     TEXT NOT NULL,
  author_address  TEXT NOT NULL,
  content         TEXT NOT NULL CHECK (length(content) <= 2000),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  parent_id       TEXT,           -- NULL = top-level comment
  deleted_at      TEXT,           -- NULL = active, non-null = soft-deleted

  FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE CASCADE,
  FOREIGN KEY (author_address) REFERENCES users (wallet_address),
  FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_proposal
  ON comments (proposal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_author
  ON comments (author_address);
```

### 6.5 Notifications

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN (
    'PROPOSAL_CREATED', 'VOTING_STARTED', 'VOTING_ENDING_SOON',
    'PROPOSAL_RESULT', 'MENTION'
  )),
  title           TEXT NOT NULL CHECK (length(title) <= 100),
  body            TEXT NOT NULL CHECK (length(body) <= 500),
  read            INTEGER NOT NULL DEFAULT 0, -- 0 = unread, 1 = read
  proposal_id     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id)
  WHERE read = 0;
```

### 6.6 Proposal Templates

```sql
CREATE TABLE IF NOT EXISTS proposal_templates (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type                    TEXT NOT NULL UNIQUE
                          CHECK (type IN (
                            'CHAIN_SELECTION', 'TOKENOMICS_CHANGE', 'TREASURY',
                            'GUIDELINE', 'TECHNICAL', 'GENERAL'
                          )),
  title                   TEXT NOT NULL,
  description_template    TEXT NOT NULL,
  default_quorum          REAL NOT NULL DEFAULT 10.0,
  default_duration_hours  INTEGER NOT NULL DEFAULT 168, -- 7 days
  required_fields         TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed data inserted on first deploy
INSERT INTO proposal_templates (type, title, description_template, default_quorum, default_duration_hours, required_fields) VALUES
  ('CHAIN_SELECTION',
   '[Chain Selection] {{chain_name}}',
   '## Proposed Chain\n\n{{chain_description}}\n\n## Rationale\n\n{{rationale}}\n\n## Risks\n\n{{risks}}',
   15.0, 336,
   '["chain_name","chain_description","rationale","risks","chain_id"]'),

  ('TREASURY',
   '[Treasury] {{purpose}}',
   '## Request\n\n{{amount}} tokens to {{recipient}}\n\n## Purpose\n\n{{purpose}}\n\n## Budget Impact\n\n{{budget_impact}}',
   10.0, 168,
   '["amount","recipient","purpose","budget_impact"]'),

  ('TOKENOMICS_CHANGE',
   '[Tokenomics] {{change_type}}',
   '## Change\n\n{{change_description}}\n\n## Motivation\n\n{{motivation}}\n\n## Expected Impact\n\n{{expected_impact}}',
   15.0, 336,
   '["change_type","change_description","motivation","expected_impact"]'),

  ('TECHNICAL',
   '[Technical] {{feature_name}}',
   '## Feature / Change\n\n{{specification}}\n\n## Implementation\n\n{{implementation_plan}}',
   10.0, 168,
   '["feature_name","specification","implementation_plan"]'),

  ('GUIDELINE',
   '[Guideline] {{guideline_title}}',
   '## Proposed Guideline\n\n{{guideline_body}}',
   10.0, 168,
   '["guideline_title","guideline_body"]'),

  ('GENERAL',
   '[General] {{title}}',
   '## Description\n\n{{description}}',
   10.0, 168,
   '["title","description"]');
```

### 6.7 ER Summary

```
users 1──* proposals    (author_address → wallet_address)
users 1──* votes        (voter_address → wallet_address)
users 1──* comments     (author_address → wallet_address)
users 1──* notifications (user_id → id)

proposals 1──* votes      (proposal_id → id)
proposals 1──* comments   (proposal_id → id)
comments  *──1 comments   (parent_id → id, self-referential)

proposal_templates — standalone seed data
```

---

## 7. API Request / Response Types

All API routes live under `/api/v1/`. Request bodies are JSON. Responses follow a standard envelope.

### 7.1 Standard Envelope

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;      // machine-readable, e.g. "UNAUTHORIZED"
    message: string;   // human-readable
  };
  meta?: {
    page?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
  };
}
```

### 7.2 Wallet Verification

```typescript
interface VerifyWalletRequest {
  /** The SIWE message the user signed */
  message: string;

  /** The EIP-191 signature (hex, 0x-prefixed, 65 bytes) */
  signature: string;
}

interface VerifyWalletResponse {
  token: string;              // JWT (httpOnly cookie or manual return)
  user: {
    id: string;
    walletAddress: string;
    displayName: string;
    holderClass: HolderClass;
    balanceFormatted: string;
    percentageOfSupply: number;
  };
}
```

### 7.3 Proposals

```typescript
interface CreateProposalRequest {
  title: string;
  description: string;
  type: ProposalType;
  /** Optional: override default quorum */
  quorumRequired?: number;
  /** Optional: override default duration (hours) */
  durationHours?: number;
  /** Optional: type-specific metadata fields */
  metadata?: Record<string, unknown>;
}

interface CreateProposalResponse {
  proposal: {
    id: string;
    title: string;
    status: ProposalStatus;
    authorAddress: string;
    createdAt: string;
  };
}

interface GetProposalsRequest {
  page?: number;          // default 1
  pageSize?: number;     // default 20, max 100
  status?: ProposalStatus;
  type?: ProposalType;
  sortBy?: "createdAt" | "votingEndsAt" | "votesFor";
  sortOrder?: "asc" | "desc";
}

interface GetProposalsResponse {
  proposals: Array<{
    id: string;
    title: string;
    type: ProposalType;
    status: ProposalStatus;
    authorAddress: string;
    votingStartsAt: string | null;
    votingEndsAt: string | null;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    quorumRequired: number;
    createdAt: string;
  }>;
}

interface GetProposalDetailResponse {
  proposal: {
    id: string;
    title: string;
    description: string;
    type: ProposalType;
    status: ProposalStatus;
    authorAddress: string;
    createdAt: string;
    votingStartsAt: string | null;
    votingEndsAt: string | null;
    quorumRequired: number;
    quorumAchieved: number | null;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    metadata: Record<string, unknown>;
  };
  /** Current user's vote on this proposal, if any */
  userVote?: {
    choice: VoteChoice;
    votingPower: number;
    createdAt: string;
  };
  /** Comment count */
  commentCount: number;
}
```

### 7.4 Voting

```typescript
interface CastVoteRequest {
  proposalId: string;
  choice: VoteChoice;
}

interface CastVoteResponse {
  vote: {
    id: string;
    proposalId: string;
    choice: VoteChoice;
    votingPower: number;
    createdAt: string;
  };
  /** Updated aggregate counts */
  proposal: {
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
  };
}
```

### 7.5 Common Error Codes

```typescript
enum ErrorCode {
  // Auth (401)
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  NONCE_EXPIRED = "NONCE_EXPIRED",

  // Not Found (404)
  PROPOSAL_NOT_FOUND = "PROPOSAL_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  NOT_IN_SNAPSHOT = "NOT_IN_SNAPSHOT",

  // Forbidden (403)
  NOT_VERIFIED = "NOT_VERIFIED",
  VOTING_CLOSED = "VOTING_CLOSED",
  ALREADY_VOTED = "ALREADY_VOTED",

  // Bad Request (400)
  INVALID_ADDRESS = "INVALID_ADDRESS",
  INVALID_CHOICE = "INVALID_CHOICE",
  MISSING_FIELDS = "MISSING_FIELDS",

  // Rate Limit (429)
  RATE_LIMITED = "RATE_LIMITED",

  // Server (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

---

## 8. Snapshot Data Processing

The snapshot CSV is processed at **build time** into a static JSON artifact that ships with the Next.js app. This avoids database storage for 25K+ read-only records and enables instant lookups.

### 8.1 Build Pipeline

```
snapshot.csv → parse → validate → sort → binary-search-index → holders.json
                                                        → metadata.json
                                                        → csv-hash.txt
```

### 8.2 CSV Processing Algorithm (TypeScript Pseudocode)

```typescript
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";

// ─── Step 1: Compute CSV Hash ───────────────────────────────────────────────
function computeCSVHash(csvPath: string): string {
  const content = readFileSync(csvPath, "utf-8");
  // Normalize: strip BOM, trim trailing whitespace, ensure LF line endings
  const normalized = content
    .replace(/^\uFEFF/, "")        // strip BOM
    .trimEnd()
    .replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
}

// ─── Step 2: Parse CSV into HolderSnapshot[] ─────────────────────────────────
function parseSnapshotCSV(csvPath: string): HolderSnapshot[] {
  const lines = readFileSync(csvPath, "utf-8")
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\n");

  // Skip header row
  const dataLines = lines.slice(1);

  const holders: HolderSnapshot[] = dataLines.map((line, index) => {
    const [rank, address, balanceRaw, balanceFormatted, percentageOfSupply] =
      line.split(",").map((s) => s.trim());

    return {
      address: address.toLowerCase(), // normalize to lowercase for lookup
      rank: Number(rank),
      balanceRaw: BigInt(balanceRaw),
      balanceFormatted: balanceFormatted,
      percentageOfSupply: Number(percentageOfSupply),
      holderClass: classifyHolder(Number(percentageOfSupply)),
    };
  });

  return holders;
}

// ─── Step 3: Classify Holders ────────────────────────────────────────────────
function classifyHolder(pct: number): HolderClass {
  if (pct >= 10.0) return HolderClass.KRAKEN;
  if (pct >= 1.0) return HolderClass.WHALE;
  if (pct >= 0.1) return HolderClass.DOLPHIN;
  if (pct >= 0.01) return HolderClass.SHARK;
  if (pct >= 0.001) return HolderClass.OCTOPUS;
  if (pct >= 0.0001) return HolderClass.CRAB;
  return HolderClass.SEAHORSE;
}

// ─── Step 4: Build Binary-Search-Optimized Index ─────────────────────────────
//
// The lookup structure is a sorted array of addresses paired with their
// holder data. At build time, we sort by address (not rank) for O(log n) lookup.
// The final artifact is a JSON file with two parallel arrays:
//   - sortedAddresses: string[] (sorted lowercase addresses)
//   - holdersByIndex: Map of index → HolderSnapshot

interface SnapshotIndex {
  sortedAddresses: string[];
  holders: Record<number, HolderSnapshot>; // index → data
  metadata: SnapshotMetadata;
}

function buildLookupIndex(holders: HolderSnapshot[], csvHash: string): SnapshotIndex {
  // Sort a copy by address for binary search
  const sorted = [...holders].sort((a, b) =>
    a.address.localeCompare(b.address, "en", { sensitivity: "base" })
  );

  const sortedAddresses = sorted.map((h) => h.address);
  const holdersByIndex: Record<number, HolderSnapshot> = {};
  sorted.forEach((h, i) => {
    holdersByIndex[i] = h;
  });

  return {
    sortedAddresses,
    holders: holdersByIndex,
    metadata: {
      blockNumber: 59_922_100,
      timestamp: "2026-06-07T23:59:58.000Z",
      totalHolders: holders.length,
      totalSupply: holders.reduce((sum, h) => sum + h.balanceRaw, 0n),
      contractAddress: "0xe3fcA919883950c5cD468156392a6477Ff5d18de",
      csvHash,
      distribution: {
        krakens: holders.filter((h) => h.holderClass === HolderClass.KRAKEN).length,
        whales: holders.filter((h) => h.holderClass === HolderClass.WHALE).length,
        dolphins: holders.filter((h) => h.holderClass === HolderClass.DOLPHIN).length,
        sharks: holders.filter((h) => h.holderClass === HolderClass.SHARK).length,
        octopuses: holders.filter((h) => h.holderClass === HolderClass.OCTOPUS).length,
        crabs: holders.filter((h) => h.holderClass === HolderClass.CRAB).length,
        seahorses: holders.filter((h) => h.holderClass === HolderClass.SEAHORSE).length,
      },
    },
  };
}

// ─── Step 5: Runtime Lookup via Binary Search ───────────────────────────────

/**
 * O(log n) lookup of a wallet address in the frozen snapshot.
 * Returns null if the address is not a known holder.
 */
function lookupHolder(
  index: SnapshotIndex,
  address: string
): HolderSnapshot | null {
  const normalized = address.toLowerCase();
  const { sortedAddresses, holders } = index;

  let lo = 0;
  let hi = sortedAddresses.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = sortedAddresses[mid].localeCompare(
      normalized,
      "en",
      { sensitivity: "base" }
    );

    if (cmp === 0) return holders[mid];
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }

  return null; // Address not in snapshot
}

// ─── Step 6: Write Artifacts ────────────────────────────────────────────────

function generateArtifacts(csvPath: string, outDir: string) {
  const csvHash = computeCSVHash(csvPath);
  const holders = parseSnapshotCSV(csvPath);
  const index = buildLookupIndex(holders, csvHash);

  // Validate totals
  if (index.metadata.totalHolders !== 25_686) {
    throw new Error(
      `Expected 25,686 holders, got ${index.metadata.totalHolders}`
    );
  }

  writeFileSync(
    `${outDir}/holders.json`,
    JSON.stringify(index, null, 2) // pretty-print for git diffing
  );
  writeFileSync(`${outDir}/csv-hash.txt`, csvHash);

  console.log(
    `✅ Snapshot indexed: ${holders.length} holders, ` +
    `hash: ${csvHash.slice(0, 16)}..., ` +
    `krakens: ${index.metadata.distribution.krakens}, ` +
    `whales: ${index.metadata.distribution.whales}, ` +
    `dolphins: ${index.metadata.distribution.dolphins}, ` +
    `sharks: ${index.metadata.distribution.sharks}, ` +
    `octopuses: ${index.metadata.distribution.octopuses}, ` +
    `crabs: ${index.metadata.distribution.crabs}, ` +
    `seahorses: ${index.metadata.distribution.seahorses}`
  );
}

// Run at build time:
// generateArtifacts("./data/snapshot.csv", "./public/data/");
```

### 8.3 Runtime Usage (Next.js API Route)

```typescript
// /api/v1/verify — simplified flow showing snapshot lookup

import snapshotData from "@/data/holders.json";

const { sortedAddresses, holders, metadata } = snapshotData;

function findHolder(address: string): HolderSnapshot | null {
  const normalized = address.toLowerCase();
  let lo = 0;
  let hi = sortedAddresses.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const midAddr = sortedAddresses[mid];
    if (midAddr === normalized) return holders[mid];
    if (midAddr < normalized) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

// In the API handler:
// 1. Verify SIWE signature → recover address
// 2. const holder = findHolder(recoveredAddress);
// 3. if (!holder) return 404 NOT_IN_SNAPSHOT
// 4. Create user + session, issue JWT with holder data
```

### 8.4 Artifact Sizes (Estimated)

| Artifact | Content | Size (est.) |
|---|---|---|
| `holders.json` | 25,686 records, sorted index | ~3.6 MB |
| `csv-hash.txt` | SHA-256 hex string | 64 bytes |
| `snapshot.csv` | Original CSV | ~1.8 MB |

> The JSON is loaded into memory once at server startup (not on every request). For edge deployment, consider splitting into chunks or using Turso for the lookup table as an alternative.

### 8.5 Validation Checklist (Build Time)

```
✅ CSV row count matches expected totalHolders (25,686 ever-held)
✅ All addresses are valid EVM addresses (0x + 40 hex chars)
✅ No duplicate addresses in CSV
✅ Total supply from sum(balanceRaw) matches metadata
✅ 7-tier distribution: 1 kraken, 3 whales, 30 dolphins, 326 sharks, 1,078 octopuses, 1,701 crabs, 22,547 seahorses
✅ All percentages sum to ~100%
✅ Sorted array length matches holders object keys
✅ Binary search round-trip test: every address finds itself
✅ CSV hash matches published reference hash (1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128)
```

---

## Appendix: Type Exports

All TypeScript interfaces and enums above should be exported from a single barrel file:

```typescript
// src/types/index.ts
export { HolderClass } from "./snapshot";
export type { HolderSnapshot, SnapshotMetadata } from "./snapshot";

export type { User, UserSession, UserSettings } from "./user";

export { ProposalType, ProposalStatus } from "./proposal";
export type { Proposal, ProposalMetadata, ProposalTemplate, ProposalComment } from "./proposal";

export { VoteChoice } from "./vote";
export type { Vote, VoteResult } from "./vote";

export { NotificationType } from "./notification";
export type { Notification } from "./notification";

export { ErrorCode } from "./api";
export type { ApiResponse } from "./api";
```

---

*End of DATA-MODEL.md — v1.0.0*
