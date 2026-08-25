/**
 * OMNOM DAO — Central type barrel.
 *
 * Source of truth: DATA-MODEL.md v1.0.0
 * Every interface, enum, and discriminated union below mirrors that document.
 * Do not diverge from the spec without updating DATA-MODEL.md first.
 */

// ─────────────────────────────────────────────────────────────
// 1. Snapshot Data Model
// ─────────────────────────────────────────────────────────────

/** Holder classification based on percentage of total supply. */
export enum HolderClass {
  /** >= 1.00% of supply */
  WHALE = "WHALE",
  /** >= 0.01% of supply */
  DOLPHIN = "DOLPHIN",
  /** < 0.01% of supply */
  FISH = "FISH",
}

/**
 * A single holder record from the frozen snapshot.
 * Captured at Block 59,922,100 (2026-06-07 23:59:58 UTC). NEVER mutated.
 */
export interface HolderSnapshot {
  /** EVM address, checksummed (0x + 40 hex chars) */
  address: string;
  /** Rank by balance, descending (1 = largest holder) */
  rank: number;
  /** Raw balance in wei (18 decimals), BigInt for precision */
  balanceRaw: bigint;
  /** Human-readable balance with decimals applied */
  balanceFormatted: string;
  /** Percentage of total supply this holder owns (e.g. 13.78) */
  percentageOfSupply: number;
  /** Derived holder class based on percentageOfSupply */
  holderClass: HolderClass;
}

/**
 * Metadata describing the snapshot itself, used for immutability verification
 * and UI display.
 */
export interface SnapshotMetadata {
  /** Dogechain block number at snapshot time */
  readonly blockNumber: 59_922_100;
  /** ISO 8601 UTC timestamp of snapshot */
  readonly timestamp: "2026-06-07T23:59:58.000Z";
  /** Total unique holder addresses in snapshot */
  totalHolders: number;
  /** Total supply captured in snapshot (raw wei) */
  totalSupply: bigint;
  /** Burned supply (Vitalik burn) in raw wei */
  burnedSupply: bigint;
  /** $OMNOM contract address on Dogechain */
  readonly contractAddress: "0xe3fcA919883950c5cD468156392a6477Ff5d18de";
  /** SHA-256 hash of the canonical snapshot CSV for integrity verification */
  csvHash: string;
  /** Holder class distribution counts */
  distribution: {
    whales: number;
    dolphins: number;
    fish: number;
  };
}

// ─────────────────────────────────────────────────────────────
// 2. User / Session Model
// ─────────────────────────────────────────────────────────────

/** A verified holder created lazily on first successful wallet verification. */
export interface User {
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

/** An authenticated session tied to a JWT. */
export interface UserSession {
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

/** User notification + display preferences. */
export interface UserSettings {
  /** FK to users.id */
  userId: string;
  /** Email / Telegram / push notification preferences */
  notifications: {
    proposalCreated: boolean;
    votingStarted: boolean;
    /** 24h before close */
    votingEndingSoon: boolean;
    proposalResult: boolean;
    mention: boolean;
  };
  /** Preferred wallet provider name for UI hints (e.g. "metamask") */
  preferredWallet: string | null;
  /** Token display format preference */
  displayFormat: "full" | "abbreviated" | "raw";
}

// ─────────────────────────────────────────────────────────────
// 3. Proposal Model
// ─────────────────────────────────────────────────────────────

/** Category of a governance proposal. */
export enum ProposalType {
  /** Where to relaunch / migrate */
  CHAIN_SELECTION = "CHAIN_SELECTION",
  /** Supply changes, burns, emissions */
  TOKENOMICS_CHANGE = "TOKENOMICS_CHANGE",
  /** Fund allocation, spending */
  TREASURY = "TREASURY",
  /** Community rules, code of conduct */
  GUIDELINE = "GUIDELINE",
  /** Platform features, integrations */
  TECHNICAL = "TECHNICAL",
  /** Anything else */
  GENERAL = "GENERAL",
}

/** Lifecycle status of a proposal. */
export enum ProposalStatus {
  /** Author editing, not visible to voters */
  DRAFT = "DRAFT",
  /** Submitted, awaiting admin/mod review */
  PENDING_REVIEW = "PENDING_REVIEW",
  /** Voting is open */
  ACTIVE = "ACTIVE",
  /** Voting period ended, not yet finalized */
  CLOSED = "CLOSED",
  /** Quorum met + majority for */
  PASSED = "PASSED",
  /** Quorum not met OR majority against */
  FAILED = "FAILED",
  /** Auto-expired without reaching quorum */
  EXPIRED = "EXPIRED",
}

/** Base metadata shared by all proposal types. */
export interface BaseMeta {
  type: "base";
  links: string[];
  tags: string[];
  /** Rejection transparency: reason why proposal was rejected (optional) */
  rejectionReason?: string;
  /** Address of admin/moderator who rejected the proposal */
  rejectedBy?: string;
  /** ISO 8601 timestamp when proposal was rejected */
  rejectedAt?: string;
}

export interface ChainSelectionMeta extends Omit<BaseMeta, "type"> {
  type: "CHAIN_SELECTION";
  candidateChains: Array<{
    chainId: number;
    chainName: string;
    rationale: string;
  }>;
}

export interface TokenomicsChangeMeta extends Omit<BaseMeta, "type"> {
  type: "TOKENOMICS_CHANGE";
  changeType: "burn" | "mint" | "rebase" | "migration";
  targetAmount?: string;
  description: string;
}

export interface TreasuryMeta extends Omit<BaseMeta, "type"> {
  type: "TREASURY";
  amount: string;
  recipient?: string;
  purpose: string;
}

export interface TechnicalMeta extends Omit<BaseMeta, "type"> {
  type: "TECHNICAL";
  githubUrl?: string;
  specification: string;
  implementationPlan?: string;
}

/** Discriminated union of type-specific metadata. */
export type ProposalMetadata =
  | ChainSelectionMeta
  | TokenomicsChangeMeta
  | TreasuryMeta
  | TechnicalMeta
  | BaseMeta;

/** A governance proposal. */
export interface Proposal {
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
  quorumRequired: number;
  /** Actual participation % achieved (computed on close) */
  quorumAchieved: number | null;
  /** Aggregate vote counts (denormalized for fast reads, recomputed on write) */
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  /** Flexible metadata bag for type-specific fields */
  metadata: ProposalMetadata;
}

/** Pre-defined template to standardize common proposal types. */
export interface ProposalTemplate {
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

/** A threaded comment on a proposal. */
export interface ProposalComment {
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
  /** Soft-delete flag timestamp (null = active) */
  deletedAt: string | null;
  /** Upvote count */
  upvotes: number;
  /** Downvote count */
  downvotes: number;
  /** The current user's reaction type ("up" | "down" | null) */
  myReaction: string | null;
}

// ─────────────────────────────────────────────────────────────
// 4. Vote Model
// ─────────────────────────────────────────────────────────────

/** A voter's choice on a proposal. */
export enum VoteChoice {
  FOR = "FOR",
  AGAINST = "AGAINST",
  ABSTAIN = "ABSTAIN",
}

/** A single cast vote. */
export interface Vote {
  /** Internal UUID */
  id: string;
  /** FK to proposals.id */
  proposalId: string;
  /** Checksummed EVM address of voter */
  voterAddress: string;
  /** The voter's choice */
  choice: VoteChoice;
  /**
   * Voting power used for this vote. Sourced from the snapshot (balanceRaw at
   * Block 59,922,100). Stored as number (formatted) for display.
   */
  votingPower: number;
  /** ISO 8601 timestamp of vote cast */
  createdAt: string;
  /** Optional transaction hash if vote is anchored on-chain (future feature) */
  txHash: string | null;
}

/**
 * Computed result after a proposal's voting period closes. NOT stored as a
 * separate table — derived from votes + snapshot data.
 */
export interface VoteResult {
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

// ─────────────────────────────────────────────────────────────
// 5. Notification Model
// ─────────────────────────────────────────────────────────────

/** Category of an in-app / push notification. */
export enum NotificationType {
  PROPOSAL_CREATED = "PROPOSAL_CREATED",
  VOTING_STARTED = "VOTING_STARTED",
  VOTING_ENDING_SOON = "VOTING_ENDING_SOON",
  PROPOSAL_RESULT = "PROPOSAL_RESULT",
  MENTION = "MENTION",
}

/** An in-app / push notification for a user. */
export interface Notification {
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

// ─────────────────────────────────────────────────────────────
// 6. Delegation Model
// ─────────────────────────────────────────────────────────────

/** Lifecycle status of a delegation relationship. */
export enum DelegationStatus {
 /** 24h time-lock elapsed, delegation in force */
 ACTIVE = "active",
 /** Within the 24h time-lock window, not yet effective */
 PENDING = "pending",
 /** Delegator revoked (instantly) or superseded */
 REVOKED = "revoked",
}

/**
* A delegation of voting power from one verified holder to another.
*
* Per GOVERNANCE_MECHANICS.md §11: 100% delegation only (no partial).
* New delegations are "pending" for a 24h time-lock before becoming
* "active". Revocation is instant.
*
* IMPORTANT (v1): Delegation is informational / trackable. It does NOT
* automatically boost the delegatee's recorded voting power. Each
* holder still votes individually and their vote is weighted by their
* own frozen snapshot balance. The delegation records who represents
* whom for transparency and future protocol upgrades.
*/
export interface Delegation {
 /** Internal UUID primary key */
 id: string;
 /** Checksummed EVM address delegating their power */
 delegatorAddress: string;
 /** Checksummed EVM address receiving the delegation */
 delegateeAddress: string;
 /** Current lifecycle status */
 status: DelegationStatus;
 /** ISO 8601 creation timestamp */
 createdAt: string;
 /** ISO 8601 timestamp the delegation becomes effective (created_at + 24h) */
 effectiveAt: string;
 /** ISO 8601 timestamp the delegation was revoked, or null */
 revokedAt: string | null;
}

// ─────────────────────────────────────────────────────────────
// 7. API Request / Response Types
// ─────────────────────────────────────────────────────────────

/** Machine-readable error codes for the API envelope. */
export enum ErrorCode {
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
  // Conflict (409)
  DELEGATION_EXISTS = "DELEGATION_EXISTS",
  DELEGATION_LIMIT = "DELEGATION_LIMIT",
  DELEGATION_NOT_FOUND = "DELEGATION_NOT_FOUND",
  INVALID_DELEGATION = "INVALID_DELEGATION",
  NOTIFICATION_NOT_FOUND = "NOTIFICATION_NOT_FOUND",
  // Rate Limit (429)
  RATE_LIMITED = "RATE_LIMITED",
  // Server (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/** Error payload returned inside the ApiResponse envelope. */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown[];
}

/** Pagination / response metadata. */
export interface ApiMeta {
  page?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
}

/** Standard API response envelope. Every endpoint returns this shape. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

// ── Auth ─────────────────────────────────────────────────────

export interface VerifyWalletRequest {
  /** The SIWE message the user signed */
  message: string;
  /** The EIP-191 signature (hex, 0x-prefixed, 65 bytes) */
  signature: string;
}

export interface VerifyWalletResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
    displayName: string;
    holderClass: HolderClass;
    balanceFormatted: string;
    percentageOfSupply: number;
  };
}

// ── Proposals ────────────────────────────────────────────────

export interface CreateProposalRequest {
  title: string;
  description: string;
  type: ProposalType;
  quorumRequired?: number;
  durationHours?: number;
  metadata?: Record<string, unknown>;
}

export interface GetProposalsRequest {
  page?: number;
  pageSize?: number;
  status?: ProposalStatus;
  type?: ProposalType;
  sortBy?: "createdAt" | "votingEndsAt" | "votesFor";
  sortOrder?: "asc" | "desc";
}

// ── Voting ───────────────────────────────────────────────────

export interface CastVoteRequest {
  proposalId: string;
  choice: VoteChoice;
}

// ── Delegation ───────────────────────────────────────────────

export interface CreateDelegationRequest {
  delegateeAddress: string;
}

export interface DelegationInfo {
  outgoing: Delegation | null;
  incomingCount: number;
  incomingList: Delegation[];
}

export interface DelegationLeaderboardEntry {
  delegateeAddress: string;
  incomingCount: number;
  /** Sum of delegators' snapshot voting power (informational) */
  totalDelegatedPower: number;
}

// ── Notifications ────────────────────────────────────────────

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
