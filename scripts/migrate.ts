/**
 * OMNOM DAO — Database Migration Script
 *
 * Creates all 7 Turso/SQLite tables per DATA-MODEL.md §6 plus their indexes.
 * Idempotent (uses CREATE TABLE IF NOT EXISTS). Safe to re-run.
 *
 * Run: `npm run db:migrate`
 *
 * Tables:
 *   1. users
 *   2. proposals
 *   3. votes               (UNIQUE(proposal_id, voter_address))
 *   4. comments            (self-ref parent_id, soft-delete)
 *   5. notifications
 *   6. proposal_templates
 *   7. sessions            (JWT issuance / nonce bookkeeping; nonce TTL also in KV)
 */
import { createClient } from "@libsql/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n❌ Missing required env var: ${name}`);
    console.error("   Copy .env.example → .env.local and fill in real values.\n");
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("TURSO_DATABASE_URL");
  const authToken = requireEnv("TURSO_AUTH_TOKEN");

  const db = createClient({ url, authToken });

  const statements: Array<{ sql: string }> = [
    // ── 1. Users ─────────────────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        wallet_address  TEXT NOT NULL UNIQUE,
        display_name    TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at   TEXT NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT uq_users_wallet UNIQUE (wallet_address)
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_users_wallet ON users (wallet_address)` },

    // ── 2. Proposals ─────────────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS proposals (
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
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        voting_starts_at  TEXT,
        voting_ends_at    TEXT,
        quorum_required   REAL NOT NULL DEFAULT 10.0,
        quorum_achieved   REAL,
        votes_for         INTEGER NOT NULL DEFAULT 0,
        votes_against     INTEGER NOT NULL DEFAULT 0,
        votes_abstain     INTEGER NOT NULL DEFAULT 0,
        metadata          TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (author_address) REFERENCES users (wallet_address)
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals (author_address)` },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_proposals_voting_period
            ON proposals (voting_starts_at, voting_ends_at)
            WHERE status = 'ACTIVE'`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals (created_at DESC)` },

    // ── 3. Votes ─────────────────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS votes (
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
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes (proposal_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes (voter_address)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_votes_proposal_choice ON votes (proposal_id, choice)` },

    // ── 4. Comments ──────────────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS comments (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        proposal_id     TEXT NOT NULL,
        author_address  TEXT NOT NULL,
        content         TEXT NOT NULL CHECK (length(content) <= 2000),
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        parent_id       TEXT,
        deleted_at      TEXT,
        FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE CASCADE,
        FOREIGN KEY (author_address) REFERENCES users (wallet_address),
        FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_comments_proposal ON comments (proposal_id, created_at DESC)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_address)` },

    // ── 5. Notifications ─────────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id         TEXT NOT NULL,
        type            TEXT NOT NULL CHECK (type IN (
          'PROPOSAL_CREATED', 'VOTING_STARTED', 'VOTING_ENDING_SOON',
          'PROPOSAL_RESULT', 'MENTION'
        )),
        title           TEXT NOT NULL CHECK (length(title) <= 100),
        body            TEXT NOT NULL CHECK (length(body) <= 500),
        read            INTEGER NOT NULL DEFAULT 0,
        proposal_id     TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (proposal_id) REFERENCES proposals (id) ON DELETE SET NULL
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read, created_at DESC)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE read = 0` },

    // ── 6. Proposal Templates ────────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS proposal_templates (
        id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type                    TEXT NOT NULL UNIQUE
                                CHECK (type IN (
                                  'CHAIN_SELECTION', 'TOKENOMICS_CHANGE', 'TREASURY',
                                  'GUIDELINE', 'TECHNICAL', 'GENERAL'
                                )),
        title                   TEXT NOT NULL,
        description_template    TEXT NOT NULL,
        default_quorum          REAL NOT NULL DEFAULT 10.0,
        default_duration_hours  INTEGER NOT NULL DEFAULT 168,
        required_fields         TEXT NOT NULL DEFAULT '[]',
        created_at              TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },

    // ── 7. Sessions (bookkeeping; nonce TTL also in Vercel KV) ─
    {
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id         TEXT NOT NULL,
        wallet_address  TEXT NOT NULL,
        jwt_expiry      TEXT NOT NULL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON sessions (wallet_address)` },

    // ── 8. Delegations (Phase 3) ──────────────────────────────
    {
      sql: `CREATE TABLE IF NOT EXISTS delegations (
        id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        delegator_address   TEXT NOT NULL,
        delegatee_address   TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('active', 'pending', 'revoked')),
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        effective_at        TEXT NOT NULL,
        revoked_at          TEXT,
        CONSTRAINT uq_delegations_delegator UNIQUE (delegator_address),
        FOREIGN KEY (delegator_address) REFERENCES users (wallet_address),
        FOREIGN KEY (delegatee_address) REFERENCES users (wallet_address)
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_delegations_delegatee_active
            ON delegations (delegatee_address) WHERE status IN ('active', 'pending')`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON delegations (delegator_address)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations (status)` },

    // ── 9. User settings (Phase 3) ────────────────────────────
    //    Persists notification preferences + Telegram / email delivery
    //    channels per GOVERNANCE_MECHANICS.md §14 + TECHNICAL_ARCHITECTURE.md §4.
    {
      sql: `CREATE TABLE IF NOT EXISTS user_settings (
        user_id                 TEXT PRIMARY KEY,
        notif_proposal_created  INTEGER NOT NULL DEFAULT 1,
        notif_voting_started    INTEGER NOT NULL DEFAULT 1,
        notif_voting_ending_soon INTEGER NOT NULL DEFAULT 1,
        notif_proposal_result   INTEGER NOT NULL DEFAULT 1,
        notif_mention           INTEGER NOT NULL DEFAULT 1,
        telegram_enabled        INTEGER NOT NULL DEFAULT 0,
        telegram_chat_id        TEXT,
        telegram_username       TEXT,
        email_enabled           INTEGER NOT NULL DEFAULT 0,
        email_address           TEXT,
        preferred_wallet        TEXT,
        display_format          TEXT NOT NULL DEFAULT 'abbreviated',
        updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_user_settings_telegram ON user_settings (telegram_enabled) WHERE telegram_enabled = 1` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings (email_enabled) WHERE email_enabled = 1` },

    // ── 10. Foundational election ballots ─────────────────────
    //    One immutable ballot per eligible ever-held wallet.
    {
      sql: `CREATE TABLE IF NOT EXISTS governance_election (
        id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        election_key          TEXT NOT NULL UNIQUE,
        title                 TEXT NOT NULL,
        voting_starts_at      TEXT NOT NULL,
        voting_ends_at        TEXT NOT NULL,
        snapshot_commit       TEXT NOT NULL,
        snapshot_file         TEXT NOT NULL,
        snapshot_file_sha256  TEXT NOT NULL,
        eligible_wallet_count INTEGER NOT NULL,
        created_at            TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS governance_election_ballots (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        election_key    TEXT NOT NULL,
        voter_address   TEXT NOT NULL,
        choice          TEXT NOT NULL
                          CHECK (choice IN ('QUADRATIC', 'ONE_WALLET_ONE_VOTE', 'TIERED', 'LINEAR')),
        cast_at         TEXT NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT uq_election_ballot UNIQUE (election_key, voter_address),
        FOREIGN KEY (election_key) REFERENCES governance_election (election_key) ON DELETE CASCADE
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_election_ballots_choice ON governance_election_ballots (election_key, choice)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_election_ballots_voter ON governance_election_ballots (voter_address)` },

    // ── 11. Election ballot-change audit trail ───────────────
    //    Every accepted ballot event (initial cast and each change) is retained.
    //    The active ballot remains the latest row in governance_election_ballots.
    {
      sql: `CREATE TABLE IF NOT EXISTS governance_election_ballot_events (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        election_key    TEXT NOT NULL,
        voter_address   TEXT NOT NULL,
        choice          TEXT NOT NULL
                          CHECK (choice IN ('QUADRATIC', 'ONE_WALLET_ONE_VOTE', 'TIERED', 'LINEAR')),
        event           TEXT NOT NULL CHECK (event IN ('CAST', 'CHANGE')),
        recorded_at     TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (election_key) REFERENCES governance_election (election_key) ON DELETE CASCADE
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_election_ballot_events_election
            ON governance_election_ballot_events (election_key, recorded_at)`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_election_ballot_events_voter
            ON governance_election_ballot_events (voter_address, recorded_at)`,
    },
  ];

  console.log("🚀 Running OMNOM DAO migrations...");
  let applied = 0;
  for (const stmt of statements) {
    try {
      // Pass the SQL as a plain string — parameterized via args where needed.
      await db.execute(stmt.sql);
      applied++;
    } catch (err) {
      console.error("❌ Migration statement failed:\n   ", stmt.sql);
      throw err;
    }
  }

  console.log(`✅ Applied ${applied} migration statements (9 tables + indexes).`);
}

main().catch((err) => {
  console.error("\n💥 Migration failed:", err);
  process.exit(1);
});
