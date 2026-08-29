/**
 * OMNOM DAO — Mock data layer.
 *
 * Provides a comprehensive, MUTABLE, in-memory dataset that mirrors the Turso /
 * libSQL schema (DATA-MODEL.md §6). It is used by `mock-db.ts` when no Turso
 * database is configured (see `db.ts` → `isMockMode()`), so the entire platform
 * renders and functions against realistic data during local development and CI
 * without any external database dependency.
 *
 * Design notes:
 *  - Rows are stored in **snake_case** column form (exactly as the SQL queries
 *    expect them), so `mock-db.ts` can return them verbatim as `ResultSet` rows.
 *  - The store is a module-level singleton that persists across requests within
 *    the same server process — mutations (votes, comments, proposals) are
 *    reflected by subsequent reads, just like a real database.
 *  - `resetMockStore()` restores the seeded baseline (used by tests).
 *
 * Addresses + balances are sourced from `scripts/data/snapshot.sample.csv` so
 * they resolve against the real `data/holders.json` snapshot lookup
 * (where the sample snapshot is installed). See GOVERNANCE_MECHANICS.md.
 */

export interface MockUserRow {
  id: string;
  wallet_address: string;
  display_name: string;
  created_at: string;
  last_login_at: string;
}

export interface MockProposalRow {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  author_address: string;
  created_at: string;
  updated_at: string | null;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  quorum_required: number;
  quorum_achieved: number | null;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  metadata: string;
}

export interface MockVoteRow {
  id: string;
  proposal_id: string;
  voter_address: string;
  choice: string;
  voting_power: number;
  created_at: string;
  tx_hash: string | null;
}

export interface MockCommentRow {
  id: string;
  proposal_id: string;
  author_address: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  deleted_at: string | null;
}

export interface MockReactionRow {
  id: string;
  comment_id: string;
  user_address: string;
  type: string; // "up" | "down"
  created_at: string;
}

/** Mirror of the `election_comments` table — used by the dev-mode mock DB
 *  so POST /api/v1/elections/[key]/comments works without a real Turso
 *  connection. Shape matches the migration in scripts/migrate.ts. */
export interface MockElectionCommentRow {
  id: string;
  election_key: string;
  author_address: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  deleted_at: string | null;
}

/** Mirror of the `election_comment_reactions` table. */
export interface MockElectionReactionRow {
  id: string;
  comment_id: string;
  user_address: string;
  type: string;
  created_at: string;
}

export interface MockNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: number; // 0 = unread, 1 = read (mirrors INTEGER column)
  proposal_id: string | null;
  created_at: string;
}

export interface MockDelegationRow {
  id: string;
  delegator_address: string;
  delegatee_address: string;
  status: string;
  created_at: string;
  effective_at: string;
  revoked_at: string | null;
}

export interface MockTemplateRow {
  id: string;
  type: string;
  title: string;
  description_template: string;
  default_quorum: number;
  default_duration_hours: number;
  required_fields: string;
  created_at: string;
  updated_at: string;
}

export interface MockUserSettingsRow {
  user_id: string;
  notif_proposal_created: number;
  notif_voting_started: number;
  notif_voting_ending_soon: number;
  notif_proposal_result: number;
  notif_mention: number;
  preferred_wallet: string | null;
  display_format: string;
}

export interface MockAuditLogRow {
  id: string;
  actor_address: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  created_at: string;
}

export interface MockGovernanceVoteRow {
  id: string;
  voter_address: string;
  choice: string;
  created_at: string;
}

export interface MockElectionRow {
  id: string;
  election_key: string;
  title: string;
  voting_starts_at: string;
  voting_ends_at: string;
  snapshot_commit: string;
  snapshot_file: string;
  snapshot_file_sha256: string;
  eligible_wallet_count: number;
  created_at: string;
}

export interface MockElectionBallotRow {
  id: string;
  election_key: string;
  voter_address: string;
  choice: string;
  cast_at: string;
}

export interface MockElectionBallotEventRow {
  id: string;
  election_key: string;
  voter_address: string;
  choice: string;
  event: "CAST" | "CHANGE";
  recorded_at: string;
}

export interface MockStore {
  users: MockUserRow[];
  proposals: MockProposalRow[];
  votes: MockVoteRow[];
  comments: MockCommentRow[];
  comment_reactions: MockReactionRow[];
  notifications: MockNotificationRow[];
  delegations: MockDelegationRow[];
  proposal_templates: MockTemplateRow[];
  user_settings: MockUserSettingsRow[];
  audit_log: MockAuditLogRow[];
  governance_votes: MockGovernanceVoteRow[];
  governance_election: MockElectionRow[];
  governance_election_ballots: MockElectionBallotRow[];
  governance_election_ballot_events: MockElectionBallotEventRow[];
  election_comments: MockElectionCommentRow[];
  election_comment_reactions: MockElectionReactionRow[];
}

// ─────────────────────────────────────────────────────────────
// Verified-holder addresses (from scripts/data/snapshot.sample.csv)
// ─────────────────────────────────────────────────────────────

export const MOCK_HOLDERS = {
  whale1: {
    address: "0x0f2d557587022a8f500d7b9ca099342af796b946",
    votingPower: 84_689_761_740_325,
  },
  whale2: {
    address: "0x5bf60ea5cf2383f407f09cf38378176298238a6c",
    votingPower: 28_608_437_074_651,
  },
  dolphin1: {
    address: "0x00fe75619881227b053f6592b0e85b08b9ad6b15",
    votingPower: 440_003_113_541,
  },
  dolphin2: {
    address: "0x00595bf5688e19a3cfc999a180b0aaed3c349c71",
    votingPower: 191_360_013_030,
  },
  fish1: {
    address: "0x000000006533ecb269f92a09d8541e84e485332f",
    votingPower: 1_281_436_465,
  },
  fish2: {
    address: "0x000000000003ebf123909630caed826f160fcb7f",
    votingPower: 210_952_345,
  },
  fish3: {
    address: "0x00000450f9d086c78ddd1cff3ef0bdbc53f9c6ce",
    votingPower: 177_706_674,
  },
  /** Dev mock wallet (viem test account #0) — used for local testing only. */
  devWallet: {
    address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    votingPower: 1_000,
  },
} as const;

// User ids (stable, readable).
const U = {
  whale1: "user-0f2d5575",
  whale2: "user-5bf60ea5",
  dolphin1: "user-00fe7561",
  dolphin2: "user-00595bf5",
  fish1: "user-70997970",
  fish2: "user-4b0897b0",
  fish3: "user-583031d1",
  devWallet: "user-f39fd6e5",
} as const;

// Stable proposal ids.
const P = {
  activeChain: "prop-active-chain-selection",
  activeTokenomics: "prop-active-tokenomics-burn",
  passedTreasury: "prop-passed-treasury-grant",
  passedGuideline: "prop-passed-code-of-conduct",
  failedGeneral: "prop-failed-submission-fee",
  pendingTechnical: "prop-pending-walletconnect-sdk",
  draftGeneral: "prop-draft-ama-format",
  expiredTechnical: "prop-expired-snapshot-cadence",
  pendingTest1: "prop-test-pending-1",
  pendingTest2: "prop-test-pending-2",
  pendingTest3: "prop-test-pending-3",
  rejectedTest1: "prop-test-rejected-1",
} as const;

// ─────────────────────────────────────────────────────────────
// Seed builder
// ─────────────────────────────────────────────────────────────

/** A reference "now" used to compute relative voting windows. */
function relativeNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const governanceVotesSeed: MockGovernanceVoteRow[] = [];

const nowMs = Date.now();
const electionStart = new Date(nowMs).toISOString();
const electionEnd = new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString();

const governanceElectionSeed: MockElectionRow[] = [
  {
    id: "election-foundational-2026",
    election_key: "foundational-2026",
    title: "Foundational Governance Election",
    voting_starts_at: electionStart,
    voting_ends_at: electionEnd,
    snapshot_commit: "2c38af77ba37e67328347cc44bcabbd07551ec42",
    snapshot_file: "omnom-snapshot-ever-held.csv",
    snapshot_file_sha256: "1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128",
    eligible_wallet_count: 25_686,
    created_at: electionStart,
  },
];

const governanceElectionBallotsSeed: MockElectionBallotRow[] = [];
const governanceElectionBallotEventsSeed: MockElectionBallotEventRow[] = [];

function buildSeed(): MockStore {
  const users: MockUserRow[] = [
    { id: U.whale1, wallet_address: MOCK_HOLDERS.whale1.address, display_name: "OMNOM Core (Admin)", created_at: "2026-06-08T09:12:00.000Z", last_login_at: "2026-06-20T14:30:00.000Z" },
    { id: U.whale2, wallet_address: MOCK_HOLDERS.whale2.address, display_name: "DogeWhale", created_at: "2026-06-08T10:05:11.000Z", last_login_at: "2026-06-22T08:01:00.000Z" },
    { id: U.dolphin1, wallet_address: MOCK_HOLDERS.dolphin1.address, display_name: "Flipper", created_at: "2026-06-09T12:00:00.000Z", last_login_at: "2026-06-23T19:42:00.000Z" },
    { id: U.dolphin2, wallet_address: MOCK_HOLDERS.dolphin2.address, display_name: "Coral", created_at: "2026-06-10T07:45:00.000Z", last_login_at: "2026-06-21T11:10:00.000Z" },
    { id: U.fish1, wallet_address: MOCK_HOLDERS.fish1.address, display_name: "Guppy", created_at: "2026-06-11T16:20:00.000Z", last_login_at: "2026-06-24T06:55:00.000Z" },
    { id: U.fish2, wallet_address: MOCK_HOLDERS.fish2.address, display_name: "Minnow", created_at: "2026-06-12T13:33:00.000Z", last_login_at: "2026-06-19T20:05:00.000Z" },
    { id: U.fish3, wallet_address: MOCK_HOLDERS.fish3.address, display_name: "Bubbles", created_at: "2026-06-13T05:00:00.000Z", last_login_at: "2026-06-18T09:30:00.000Z" },
    { id: U.devWallet, wallet_address: MOCK_HOLDERS.devWallet.address, display_name: "Dev Wallet", created_at: "2026-06-28T10:00:00.000Z", last_login_at: "2026-06-30T12:00:00.000Z" },
  ];

  const proposals: MockProposalRow[] = [
    {
      id: P.activeChain,
      title: "Chain Migration: Relaunch $OMNOM on an Ethereum L2",
      description:
        "## Proposal\n\nWith the Dogechain sunset, this proposal recommends migrating $OMNOM to a **secure, low-fee Ethereum Layer 2**.\n\n### Candidate Chains\n- **Base** (Coinbase-backed, deep liquidity)\n- **Arbitrum One** (mature ecosystem, low fees)\n- **Optimism** (public-goods funded)\n\n### Rationale\nA 1:1 airdrop preserves every holder's governance weight. An L2 gives us EVM compatibility, low-cost transactions, and access to the deepest liquidity in crypto.\n\n### Risks\n- Bridge complexity during the migration window\n- Final chain selected in a follow-up vote (Round 1 of the tokenomics framework)\n\n_Voting is governed by the Chain Selection supermajority (60%) and 15% quorum._",
      type: "CHAIN_SELECTION",
      status: "ACTIVE",
      author_address: MOCK_HOLDERS.dolphin1.address,
      created_at: "2026-06-18T12:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-06-20T12:00:00.000Z",
      voting_ends_at: relativeNow(3 * 24 * 60 * 60 * 1000),
      quorum_required: 15.0,
      quorum_achieved: null,
      votes_for: 1_201_500,
      votes_against: 85,
      votes_abstain: 25,
      metadata: JSON.stringify({
        type: "CHAIN_SELECTION",
        links: ["https://omnomdao.org"],
        tags: ["migration", "l2"],
        candidateChains: [
          { chainId: 8453, chainName: "Base", rationale: "Coinbase-backed, deep liquidity." },
          { chainId: 42161, chainName: "Arbitrum One", rationale: "Mature ecosystem, low fees." },
          { chainId: 10, chainName: "Optimism", rationale: "Public-goods funded retroactive rewards." },
        ],
      }),
    },
    {
      id: P.activeTokenomics,
      title: "Adopt a 1% Deflationary Transaction Burn",
      description:
        "## Change\n\nIntroduce a **1% burn on every $OMNOM transfer**, sent to a verifiable dead address.\n\n## Motivation\n\nDeflationary pressure rewards long-term holders and aligns with the Hybrid tokenomics model (Option B + E).\n\n## Expected Impact\n\n- Predictable, on-chain supply reduction\n- Transparent dead address verifiable by anyone\n- Adjustable down (e.g. 0.5%) in a later governance vote\n\n_Closes in under 24 hours — vote now._",
      type: "TOKENOMICS_CHANGE",
      status: "ACTIVE",
      author_address: MOCK_HOLDERS.whale2.address,
      created_at: "2026-06-22T09:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-06-22T09:00:00.000Z",
      voting_ends_at: relativeNow(10 * 60 * 60 * 1000),
      quorum_required: 15.0,
      quorum_achieved: null,
      votes_for: 980_000,
      votes_against: 420,
      votes_abstain: 3,
      metadata: JSON.stringify({
        type: "TOKENOMICS_CHANGE",
        links: [],
        tags: ["burn", "deflationary"],
        changeType: "burn",
        targetAmount: "1.0%",
        description: "1% of every transfer burned to a verifiable dead address.",
      }),
    },
    {
      id: P.passedTreasury,
      title: "Fund Community Tooling Grant (50,000 $OMNOM)",
      description:
        "## Request\n\n**50,000 $OMNOM** to `0xToolingGrantee` for a community block explorer + notification bot.\n\n## Purpose\n\nDeliverables:\n1. Open-source governance dashboard\n2. Telegram notification bot for proposal events\n3. Quarterly maintenance\n\n## Budget Impact\n\n~0.006% of circulating supply. Funds are advisory and disbursed off-chain by the core team.\n\n_Status: **PASSED** — quorum met, simple majority reached._",
      type: "TREASURY",
      status: "PASSED",
      author_address: MOCK_HOLDERS.whale1.address,
      created_at: "2026-06-05T11:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-06-06T11:00:00.000Z",
      voting_ends_at: "2026-06-13T11:00:00.000Z",
      quorum_required: 10.0,
      quorum_achieved: 27.3,
      votes_for: 2_181_500,
      votes_against: 85,
      votes_abstain: 0,
      metadata: JSON.stringify({
        type: "TREASURY",
        links: [],
        tags: ["grant", "tooling"],
        amount: "50000",
        recipient: "0xToolingGrantee",
        purpose: "Block explorer + notification bot + maintenance.",
      }),
    },
    {
      id: P.passedGuideline,
      title: "Adopt Community Code of Conduct v2",
      description:
        "## Proposed Guideline\n\nRefresh the community Code of Conduct to cover off-chain governance discussions, respectful debate, and anti-harassment norms.\n\n_Status: **PASSED**._",
      type: "GUIDELINE",
      status: "PASSED",
      author_address: MOCK_HOLDERS.dolphin1.address,
      created_at: "2026-06-03T08:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-06-03T08:00:00.000Z",
      voting_ends_at: "2026-06-10T08:00:00.000Z",
      quorum_required: 10.0,
      quorum_achieved: 12.4,
      votes_for: 2_030,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["conduct", "governance"] }),
    },
    {
      id: P.failedGeneral,
      title: "Require a 100 $OMNOM Deposit to Submit Proposals",
      description:
        "## Description\n\nProposal to add a 100 $OMNOM anti-spam deposit, refunded on a valid outcome.\n\n_Status: **FAILED** — majority AGAINST._",
      type: "GENERAL",
      status: "FAILED",
      author_address: MOCK_HOLDERS.dolphin2.address,
      created_at: "2026-06-01T15:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-06-02T15:00:00.000Z",
      voting_ends_at: "2026-06-09T15:00:00.000Z",
      quorum_required: 10.0,
      quorum_achieved: 15.1,
      votes_for: 1_585,
      votes_against: 1_200_000,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["anti-spam"] }),
    },
    {
      id: P.pendingTechnical,
      title: "Integrate WalletConnect v2 SDK for Multi-Wallet Login",
      description:
        "## Feature / Change\n\nUpgrade the SIWE flow to support WalletConnect v2, enabling mobile wallets (Rainbow, Trust, etc.) to sign in.\n\n## Implementation Plan\n\n1. Swap wagmi connector for WalletConnect v2\n2. Update nonce/verify endpoints to remain chain-agnostic\n3. QA across 5 mobile wallets\n\n_Status: **PENDING REVIEW** — awaiting moderator approval._",
      type: "TECHNICAL",
      status: "PENDING_REVIEW",
      author_address: MOCK_HOLDERS.whale1.address,
      created_at: "2026-06-24T10:00:00.000Z",
      updated_at: null,
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 10.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({
        type: "TECHNICAL",
        links: ["https://docs.walletconnect.com"],
        tags: ["auth", "walletconnect"],
        githubUrl: "https://github.com/omnom-dao/platform",
        specification: "WalletConnect v2 SIWE integration.",
        implementationPlan: "Connector swap + endpoint QA.",
      }),
    },
    {
      id: P.draftGeneral,
      title: "Weekly Community AMA Format & Cadence",
      description:
        "## Description\n\nDraft proposal to formalize a weekly AMA with the core team.\n\n_Status: **DRAFT** — author is still composing._",
      type: "GENERAL",
      status: "DRAFT",
      author_address: MOCK_HOLDERS.fish1.address,
      created_at: "2026-06-25T07:30:00.000Z",
      updated_at: null,
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 10.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["community", "ama"] }),
    },
    {
      id: P.expiredTechnical,
      title: "Increase Snapshot Refresh Cadence to Quarterly",
      description:
        "## Feature / Change\n\nRefresh the governance snapshot every quarter instead of once.\n\n_Status: **EXPIRED** — quorum not reached._",
      type: "TECHNICAL",
      status: "EXPIRED",
      author_address: MOCK_HOLDERS.dolphin2.address,
      created_at: "2026-05-20T12:00:00.000Z",
      updated_at: null,
      voting_starts_at: "2026-05-21T12:00:00.000Z",
      voting_ends_at: "2026-05-28T12:00:00.000Z",
      quorum_required: 10.0,
      quorum_achieved: 2.1,
      votes_for: 85,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["snapshot"] }),
    },
    {
      id: P.pendingTest1,
      title: "Test Proposal 1 - For Approval Testing",
      description: "This is a test proposal for verifying the approve functionality works correctly after the bug fix.",
      type: "TECHNICAL",
      status: "PENDING_REVIEW",
      author_address: MOCK_HOLDERS.whale1.address,
      created_at: relativeNow(-24 * 60 * 60 * 1000),
      updated_at: null,
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 10.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "TECHNICAL", links: [], tags: ["test", "approve-test"] }),
    },
    {
      id: P.pendingTest2,
      title: "Test Proposal 2 - For Rejection Testing",
      description: "This is a test proposal for verifying the reject functionality works correctly after the bug fix.",
      type: "GENERAL",
      status: "PENDING_REVIEW",
      author_address: MOCK_HOLDERS.dolphin1.address,
      created_at: relativeNow(-12 * 60 * 60 * 1000),
      updated_at: null,
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 10.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["test", "reject-test"] }),
    },
    {
      id: P.pendingTest3,
      title: "Test Proposal 3 - Backup for Testing",
      description: "Backup test proposal to ensure moderation queue has multiple items for testing.",
      type: "TOKENOMICS_CHANGE",
      status: "PENDING_REVIEW",
      author_address: MOCK_HOLDERS.dolphin2.address,
      created_at: relativeNow(-6 * 60 * 60 * 1000),
      updated_at: null,
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 15.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({ type: "base", links: [], tags: ["test", "backup"] }),
    },
    {
      id: P.rejectedTest1,
      title: "Test Proposal 4 - Rejected for Testing",
      description: "This is a test proposal that was rejected by an admin to verify the rejection transparency UI works correctly.",
      type: "GENERAL",
      status: "FAILED",
      author_address: MOCK_HOLDERS.fish1.address,
      created_at: relativeNow(-48 * 60 * 60 * 1000),
      updated_at: relativeNow(-24 * 60 * 60 * 1000),
      voting_starts_at: null,
      voting_ends_at: null,
      quorum_required: 10.0,
      quorum_achieved: null,
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      metadata: JSON.stringify({
        type: "base",
        links: [],
        tags: ["test", "rejected"],
        rejectionReason: "This proposal was rejected because it doesn't meet the community guidelines. The description is insufficient and lacks proper governance context.",
        rejectedBy: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        rejectedAt: relativeNow(-24 * 60 * 60 * 1000),
      }),
    },
  ];

  const votes: MockVoteRow[] = [
    // Proposal 1 — active chain selection
    { id: "vote-1a", proposal_id: P.activeChain, voter_address: MOCK_HOLDERS.whale1.address, choice: "FOR", voting_power: MOCK_HOLDERS.whale1.votingPower, created_at: "2026-06-20T13:01:00.000Z", tx_hash: null },
    { id: "vote-1b", proposal_id: P.activeChain, voter_address: MOCK_HOLDERS.dolphin1.address, choice: "FOR", voting_power: MOCK_HOLDERS.dolphin1.votingPower, created_at: "2026-06-20T14:20:00.000Z", tx_hash: null },
    { id: "vote-1c", proposal_id: P.activeChain, voter_address: MOCK_HOLDERS.fish1.address, choice: "AGAINST", voting_power: MOCK_HOLDERS.fish1.votingPower, created_at: "2026-06-21T09:00:00.000Z", tx_hash: null },
    { id: "vote-1d", proposal_id: P.activeChain, voter_address: MOCK_HOLDERS.fish2.address, choice: "ABSTAIN", voting_power: MOCK_HOLDERS.fish2.votingPower, created_at: "2026-06-21T10:15:00.000Z", tx_hash: null },

    // Proposal 2 — active tokenomics burn
    { id: "vote-2a", proposal_id: P.activeTokenomics, voter_address: MOCK_HOLDERS.whale2.address, choice: "FOR", voting_power: MOCK_HOLDERS.whale2.votingPower, created_at: "2026-06-22T10:00:00.000Z", tx_hash: null },
    { id: "vote-2b", proposal_id: P.activeTokenomics, voter_address: MOCK_HOLDERS.dolphin2.address, choice: "AGAINST", voting_power: MOCK_HOLDERS.dolphin2.votingPower, created_at: "2026-06-22T11:30:00.000Z", tx_hash: null },
    { id: "vote-2c", proposal_id: P.activeTokenomics, voter_address: MOCK_HOLDERS.fish3.address, choice: "ABSTAIN", voting_power: MOCK_HOLDERS.fish3.votingPower, created_at: "2026-06-22T12:05:00.000Z", tx_hash: null },

    // Proposal 3 — passed treasury
    { id: "vote-3a", proposal_id: P.passedTreasury, voter_address: MOCK_HOLDERS.whale1.address, choice: "FOR", voting_power: MOCK_HOLDERS.whale1.votingPower, created_at: "2026-06-06T12:00:00.000Z", tx_hash: null },
    { id: "vote-3b", proposal_id: P.passedTreasury, voter_address: MOCK_HOLDERS.whale2.address, choice: "FOR", voting_power: MOCK_HOLDERS.whale2.votingPower, created_at: "2026-06-06T13:00:00.000Z", tx_hash: null },
    { id: "vote-3c", proposal_id: P.passedTreasury, voter_address: MOCK_HOLDERS.dolphin1.address, choice: "FOR", voting_power: MOCK_HOLDERS.dolphin1.votingPower, created_at: "2026-06-06T14:00:00.000Z", tx_hash: null },
    { id: "vote-3d", proposal_id: P.passedTreasury, voter_address: MOCK_HOLDERS.fish1.address, choice: "AGAINST", voting_power: MOCK_HOLDERS.fish1.votingPower, created_at: "2026-06-07T09:00:00.000Z", tx_hash: null },

    // Proposal 4 — passed guideline
    { id: "vote-4a", proposal_id: P.passedGuideline, voter_address: MOCK_HOLDERS.dolphin1.address, choice: "FOR", voting_power: MOCK_HOLDERS.dolphin1.votingPower, created_at: "2026-06-04T09:00:00.000Z", tx_hash: null },
    { id: "vote-4b", proposal_id: P.passedGuideline, voter_address: MOCK_HOLDERS.dolphin2.address, choice: "FOR", voting_power: MOCK_HOLDERS.dolphin2.votingPower, created_at: "2026-06-04T10:00:00.000Z", tx_hash: null },
    { id: "vote-4c", proposal_id: P.passedGuideline, voter_address: MOCK_HOLDERS.fish1.address, choice: "FOR", voting_power: MOCK_HOLDERS.fish1.votingPower, created_at: "2026-06-04T11:00:00.000Z", tx_hash: null },
    { id: "vote-4d", proposal_id: P.passedGuideline, voter_address: MOCK_HOLDERS.fish2.address, choice: "FOR", voting_power: MOCK_HOLDERS.fish2.votingPower, created_at: "2026-06-05T08:00:00.000Z", tx_hash: null },

    // Proposal 5 — failed general
    { id: "vote-5a", proposal_id: P.failedGeneral, voter_address: MOCK_HOLDERS.whale1.address, choice: "AGAINST", voting_power: MOCK_HOLDERS.whale1.votingPower, created_at: "2026-06-03T10:00:00.000Z", tx_hash: null },
    { id: "vote-5b", proposal_id: P.failedGeneral, voter_address: MOCK_HOLDERS.dolphin1.address, choice: "FOR", voting_power: MOCK_HOLDERS.dolphin1.votingPower, created_at: "2026-06-03T11:00:00.000Z", tx_hash: null },
    { id: "vote-5c", proposal_id: P.failedGeneral, voter_address: MOCK_HOLDERS.fish1.address, choice: "FOR", voting_power: MOCK_HOLDERS.fish1.votingPower, created_at: "2026-06-03T12:00:00.000Z", tx_hash: null },

    // Proposal 8 — expired technical
    { id: "vote-8a", proposal_id: P.expiredTechnical, voter_address: MOCK_HOLDERS.fish1.address, choice: "FOR", voting_power: MOCK_HOLDERS.fish1.votingPower, created_at: "2026-05-22T09:00:00.000Z", tx_hash: null },
  ];

  const comments: MockCommentRow[] = [
    // Proposal 1 (active) — threaded, includes a reply + a soft-deleted comment.
    { id: "cmt-1a", proposal_id: P.activeChain, author_address: MOCK_HOLDERS.dolphin1.address, content: "Strongly support Base — the Coinbase distribution channel is a huge advantage for onboarding.", created_at: "2026-06-18T13:00:00.000Z", parent_id: null, deleted_at: null },
    { id: "cmt-1b", proposal_id: P.activeChain, author_address: MOCK_HOLDERS.fish1.address, content: "Arbitrum has lower fees historically. Worth considering for retail holders.", created_at: "2026-06-18T14:30:00.000Z", parent_id: "cmt-1a", deleted_at: null },
    { id: "cmt-1c", proposal_id: P.activeChain, author_address: MOCK_HOLDERS.whale2.address, content: "Let's make sure the bridge is audited before any relaunch.", created_at: "2026-06-19T09:10:00.000Z", parent_id: null, deleted_at: null },
    { id: "cmt-1d", proposal_id: P.activeChain, author_address: MOCK_HOLDERS.fish2.address, content: "this is spam", created_at: "2026-06-19T11:00:00.000Z", parent_id: null, deleted_at: "2026-06-19T11:30:00.000Z" },
    { id: "cmt-1e", proposal_id: P.activeChain, author_address: MOCK_HOLDERS.dolphin2.address, content: "Agreed on the audit. Can we add a multi-sig requirement for the migration keys?", created_at: "2026-06-19T15:00:00.000Z", parent_id: "cmt-1c", deleted_at: null },

    // Proposal 2 (active)
    { id: "cmt-2a", proposal_id: P.activeTokenomics, author_address: MOCK_HOLDERS.dolphin2.address, content: "1% feels high for a deflationary burn. 0.5% might be safer to start.", created_at: "2026-06-22T12:00:00.000Z", parent_id: null, deleted_at: null },
    { id: "cmt-2b", proposal_id: P.activeTokenomics, author_address: MOCK_HOLDERS.whale2.address, content: "The dead address should be a well-known, verifiable burn address (e.g. `0x000...dead`).", created_at: "2026-06-22T13:00:00.000Z", parent_id: "cmt-2a", deleted_at: null },
    { id: "cmt-2c", proposal_id: P.activeTokenomics, author_address: MOCK_HOLDERS.fish1.address, content: "Support — predictable deflation aligns long-term holders.", created_at: "2026-06-22T14:00:00.000Z", parent_id: null, deleted_at: null },

    // Proposal 3 (passed)
    { id: "cmt-3a", proposal_id: P.passedTreasury, author_address: MOCK_HOLDERS.dolphin1.address, content: "Milestones look reasonable. Looking forward to the dashboard.", created_at: "2026-06-07T09:00:00.000Z", parent_id: null, deleted_at: null },
  ];

  const notifications: MockNotificationRow[] = [
    { id: "ntf-1", user_id: U.whale1, type: "PROPOSAL_CREATED", title: "🗳️ New proposal: Adopt a 1% Deflationary Transaction Burn", body: "A new tokenomics_change proposal was submitted. Review and discuss before voting opens.", read: 0, proposal_id: P.activeTokenomics, created_at: "2026-06-22T09:00:00.000Z" },
    { id: "ntf-2", user_id: U.whale1, type: "VOTING_STARTED", title: "🗳️ Voting started: Chain Migration: Relaunch $OMNOM on an Ethereum L2", body: "Voting is now open. Cast your vote — every token counts.", read: 0, proposal_id: P.activeChain, created_at: "2026-06-20T12:00:00.000Z" },
    { id: "ntf-3", user_id: U.whale1, type: "VOTING_ENDING_SOON", title: "⏳ Ending soon: Adopt a 1% Deflationary Transaction Burn", body: "Less than 24 hours remain to vote.", read: 0, proposal_id: P.activeTokenomics, created_at: "2026-06-25T08:00:00.000Z" },
    { id: "ntf-4", user_id: U.whale1, type: "PROPOSAL_RESULT", title: "✅ Result: Fund Community Tooling Grant (50,000 $OMNOM)", body: "The proposal has passed.", read: 1, proposal_id: P.passedTreasury, created_at: "2026-06-13T11:00:00.000Z" },
    { id: "ntf-5", user_id: U.whale1, type: "MENTION", title: "💬 You were mentioned", body: "You were mentioned in a comment on the chain migration proposal.", read: 1, proposal_id: P.activeChain, created_at: "2026-06-19T15:00:00.000Z" },
  ];

  const delegations: MockDelegationRow[] = [
    {
      id: "dlg-1",
      delegator_address: MOCK_HOLDERS.fish2.address,
      delegatee_address: MOCK_HOLDERS.whale1.address,
      status: "active",
      created_at: "2026-06-12T10:00:00.000Z",
      effective_at: "2026-06-13T10:00:00.000Z",
      revoked_at: null,
    },
    {
      id: "dlg-2",
      delegator_address: MOCK_HOLDERS.fish3.address,
      delegatee_address: MOCK_HOLDERS.dolphin1.address,
      status: "pending",
      created_at: relativeNow(-2 * 60 * 60 * 1000),
      effective_at: relativeNow(22 * 60 * 60 * 1000),
      revoked_at: null,
    },
    {
      id: "dlg-3",
      delegator_address: MOCK_HOLDERS.dolphin2.address,
      delegatee_address: MOCK_HOLDERS.whale2.address,
      status: "active",
      created_at: "2026-06-15T11:00:00.000Z",
      effective_at: "2026-06-16T11:00:00.000Z",
      revoked_at: null,
    },
  ];

  const proposal_templates: MockTemplateRow[] = [
    { id: "tpl-chain", type: "CHAIN_SELECTION", title: "[Chain Selection] {{chain_name}}", description_template: "## Proposed Chain\n\n{{chain_description}}\n\n## Rationale\n\n{{rationale}}\n\n## Risks\n\n{{risks}}", default_quorum: 15.0, default_duration_hours: 336, required_fields: '["chain_name","chain_description","rationale","risks","chain_id"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
    { id: "tpl-treasury", type: "TREASURY", title: "[Treasury] {{purpose}}", description_template: "## Request\n\n{{amount}} tokens to {{recipient}}\n\n## Purpose\n\n{{purpose}}\n\n## Budget Impact\n\n{{budget_impact}}", default_quorum: 10.0, default_duration_hours: 168, required_fields: '["amount","recipient","purpose","budget_impact"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
    { id: "tpl-tokenomics", type: "TOKENOMICS_CHANGE", title: "[Tokenomics] {{change_type}}", description_template: "## Change\n\n{{change_description}}\n\n## Motivation\n\n{{motivation}}\n\n## Expected Impact\n\n{{expected_impact}}", default_quorum: 15.0, default_duration_hours: 336, required_fields: '["change_type","change_description","motivation","expected_impact"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
    { id: "tpl-technical", type: "TECHNICAL", title: "[Technical] {{feature_name}}", description_template: "## Feature / Change\n\n{{specification}}\n\n## Implementation\n\n{{implementation_plan}}", default_quorum: 10.0, default_duration_hours: 168, required_fields: '["feature_name","specification","implementation_plan"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
    { id: "tpl-guideline", type: "GUIDELINE", title: "[Guideline] {{guideline_title}}", description_template: "## Proposed Guideline\n\n{{guideline_body}}", default_quorum: 10.0, default_duration_hours: 168, required_fields: '["guideline_title","guideline_body"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
    { id: "tpl-general", type: "GENERAL", title: "[General] {{title}}", description_template: "## Description\n\n{{description}}", default_quorum: 10.0, default_duration_hours: 168, required_fields: '["title","description"]', created_at: "2026-06-08T00:00:00.000Z", updated_at: "2026-06-08T00:00:00.000Z" },
  ];

  const user_settings: MockUserSettingsRow[] = [
    { user_id: U.whale1, notif_proposal_created: 1, notif_voting_started: 1, notif_voting_ending_soon: 1, notif_proposal_result: 1, notif_mention: 1, preferred_wallet: null, display_format: "full" },
  ];

  const comment_reactions: MockReactionRow[] = [];

  return {
    users,
    proposals,
    votes,
    comments,
    comment_reactions,
    notifications,
    delegations,
    proposal_templates,
    user_settings,
    audit_log: [] as MockAuditLogRow[],
    governance_votes: [...governanceVotesSeed],
    governance_election: [...governanceElectionSeed],
    governance_election_ballots: [...governanceElectionBallotsSeed],
    governance_election_ballot_events: [...governanceElectionBallotEventsSeed],
    election_comments: [] as MockElectionCommentRow[],
    election_comment_reactions: [] as MockElectionReactionRow[],
  };
}

// ─────────────────────────────────────────────────────────────
// Mutable singleton store (process-wide via globalThis)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the live mutable store. Mutations performed via the mock DB adapter
 * write directly into this object, so subsequent reads observe the change.
 *
 * Uses globalThis to ensure all Next.js route modules share the same store
 * instance, even under Turbopack's separate module compilation.
 */
export function getMockStore(): MockStore {
  const g = globalThis as typeof globalThis & { __omnomMockStore?: MockStore };
  if (!g.__omnomMockStore) {
    g.__omnomMockStore = buildSeed();
  }
  return g.__omnomMockStore;
}

/** Restore the seeded baseline (used by tests). */
export function resetMockStore(): void {
  const g = globalThis as typeof globalThis & { __omnomMockStore?: MockStore };
  g.__omnomMockStore = buildSeed();
}

/**
 * Generate a new pseudo-random lowercase-hex id (mirrors the schema default
 * `lower(hex(randomblob(16)))`).
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  // `crypto` is a global in Node 19+ and all modern runtimes (Web Crypto API).
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c) {
    c.getRandomValues(bytes);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
