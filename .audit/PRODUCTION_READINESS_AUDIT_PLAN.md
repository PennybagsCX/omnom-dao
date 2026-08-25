# OMNOM DAO Production Readiness Audit Plan
**Version**: 1.0  
**Date**: 2026-08-24  
**Status**: Ready for Execution  

---

## Executive Summary

This comprehensive audit plan validates the OMNOM DAO platform for production deployment across 6 critical dimensions. The platform is a **Next.js 16.2.9 + React 19** decentralized autonomous organization with **on-chain voting**, **proposal management**, **delegation systems**, and **wallet authentication** via **wagmi/viem** integration.

**Tech Stack:**
- Frontend: Next.js 16.2.9, React 19, TypeScript 5.5.0
- Blockchain: wagmi 2.15.0, viem 2.15.0, RainbowKit 2.1.0
- State: TanStack Query 5.50.0
- Database: LibSQL client 0.17.4, Vercel KV 3.0.0
- Testing: Vitest 3.2.6, Playwright 1.61.1
- Build: Next.js build, Tailwind CSS 4.0.0

**Critical Features:**
- Governance voting with on-chain transaction integrity
- Proposal lifecycle management (draft → active → finalized)
- Delegation system for voting power transfer
- SIWE (Sign-In with Ethereum) authentication
- Admin panel with proposal approval workflows
- Real-time notifications and audit logging

---

## Phase 1: Discovery & Analysis (Parallel Execution)

**Objective**: Map complete architecture, catalog features, assess code quality foundations

**Lead Agents**: `backend-architect` + `Explore` (parallel)  
**Duration**: 4-6 hours  
**Dependencies**: None

### 1.1 Architecture Mapping

**Agent**: `backend-architect`  
**Deliverable**: Architecture documentation with data flow diagrams

**Files to Examine**:
```
Core Configuration:
├── src/config/wagmi.ts              # Blockchain RPC/config
├── src/config/wagmi-full.ts        # Full wagmi setup
├── src/lib/db.ts                    # Database initialization
├── src/lib/mock-db.ts               # Mock database layer
└── src/lib/auth.ts                  # Authentication logic

Architecture:
├── src/app/layout.tsx               # Root layout + providers
├── src/components/providers.tsx     # React Query + Wagmi providers
├── src/lib/api.tsx                  # API client composition
└── src/lib/api-response.ts          # API response standardization
```

**Key Questions**:
1. How does wallet authentication flow from RainbowKit → API → Session?
2. What are the database table relationships for proposals, votes, delegations?
3. How does the on-chain voting integrate with off-chain proposal data?
4. What are the caching strategies (Vercel KV vs LibSQL)?

**Output**: `architecture-map.md` with:
- Data flow diagram (auth → API → blockchain)
- Database schema diagram
- API route tree with responsibilities
- Security boundaries (public vs authenticated vs admin)

### 1.2 Feature Catalog & Dependency Mapping

**Agent**: `Explore` (breadth: "very thorough")  
**Deliverable**: Complete feature inventory with ownership

**Search Targets**:
```
Voting/Governance:
├── src/app/governance-vote/         # On-chain voting UI
├── src/app/api/v1/governance-vote/  # Voting API
├── src/components/voting/          # Voting components
└── src/lib/proposal-finalize.ts     # Proposal finalization logic

Proposals:
├── src/app/proposals/               # Proposal listing + detail
├── src/app/api/v1/proposals/        # Proposal CRUD endpoints
├── src/components/proposals/        # Proposal components
└── src/lib/proposal-service.ts      # Proposal business logic

Delegation:
├── src/app/api/v1/delegation/      # Delegation endpoints
├── src/lib/delegation.ts            # Delegation logic
└── src/lib/delegation-api.ts        # Delegation API

Authentication:
├── src/app/api/v1/verify/route.ts  # SIWE verification
├── src/app/api/v1/nonce/           # Nonce generation
├── src/lib/auth.ts                 # Auth utilities
└── src/lib/siwe.tsx                # SIWE message construction

Admin:
├── src/app/admin/                  # Admin dashboard
├── src/app/api/v1/admin/           # Admin endpoints
└── src/components/admin/            # Admin components
```

**Output**: `feature-catalog.md` with:
- Feature list with page routes
- Component ownership tree
- API endpoint mapping
- Permission boundaries

### 1.3 Code Quality Baseline

**Agent**: `qa-debugger`  
**Deliverable**: Code quality metrics + technical debt inventory

**Files to Analyze**:
```
Critical Libraries:
├── src/lib/auth.ts                  # 15KB - Auth logic (HIGH RISK)
├── src/lib/api.tsx                  # 19KB - API composition
├── src/lib/mock-data.ts             # 35KB - Test data
├── src/lib/mock-db.ts               # 33KB - Mock DB
├── src/lib/snapshot.ts              # 11KB - Snapshot integration
└── src/lib/validators.ts            # 4KB - Input validation

Configuration:
├── tsconfig.json                   # TypeScript strict mode
├── eslint.config.mjs              # ESLint rules
├── next.config.ts                  # Next.js config
└── playwright.config.ts            # E2E test config
```

**Checks**:
- TypeScript strict mode compliance (`tsc --noEmit`)
- ESLint errors/warnings (`npm run lint`)
- Test coverage gaps (`npm run test -- --coverage`)
- TODO/FIXME/HACK comments (grep analysis)
- Large file detection (>500 LOC)

**Output**: `code-quality-report.md` with:
- Compilation status (✓/✗)
- Linter violations count
- Test coverage % by module
- Technical debt prioritization (High/Med/Low)

---

## Phase 2: Functional Testing (Sequential by Feature)

**Objective**: Validate all user journeys end-to-end with real blockchain interactions

**Lead Agent**: `qa-debugger`  
**Support**: `agent-browser` for visual validation  
**Duration**: 8-12 hours  
**Dependencies**: Phase 1 complete

### 2.1 Authentication Flow

**Test Scenarios**:

**Scenario A: SIWE Wallet Connection (Happy Path)**
```
1. User clicks "Connect Wallet"
2. RainbowKit modal opens
3. User selects wallet (MetaMask/WalletConnect)
4. User signs SIWE message
5. Backend verifies signature
6. Session established
7. User redirected to dashboard
```

**Files**: `src/lib/auth.ts`, `src/lib/siwe.tsx`, `src/app/api/v1/verify/route.ts`

**Success Criteria**:
- ✓ Signature verification passes for valid messages
- ✓ Nonce is single-use only
- ✓ Session cookie set correctly
- ✓ Invalid signatures rejected with clear error

**Scenario B: Session Persistence**
```
1. User connects wallet
2. User closes browser
3. User reopens browser
4. Session restored automatically
5. User can vote without reconnecting
```

**Scenario C: Wallet Disconnect**
```
1. User clicks "Disconnect"
2. Session cleared
3. User redirected to home
4. Protected routes inaccessible
```

**Test Implementation**:
```typescript
// src/__tests__/e2e/auth.spec.ts
test('SIWE flow end-to-end', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('[data-testid="connect-wallet"]')
  // Mock wallet interaction
  await page.evaluate(() => window.ethereum.request({ 
    method: 'eth_requestAccounts' 
  }))
  await page.waitForURL('/dashboard')
  expect(await page.textContent('[data-testid="user-address"]'))
    .toMatch(/^0x[a-fA-F0-9]{40}$/)
})
```

### 2.2 Proposal Lifecycle

**Test Scenarios**:

**Scenario A: Proposal Creation (Draft)**
```
1. Admin user navigates to /proposals/create
2. Fills title, description, tags
3. Selects proposal type (Signal/Governance)
4. Submits as draft
5. Proposal saved with status=DRAFT
6. Proposal visible in admin queue
```

**Files**: `src/app/proposals/create/page.tsx`, `src/app/api/v1/proposals/route.ts`

**Scenario B: Proposal Approval**
```
1. Admin reviews pending proposal
2. Validates content + tags
3. Clicks "Approve"
4. Proposal status changes to ACTIVE
5. Notification sent to delegates
6. Proposal appears in public feed
```

**Files**: `src/app/api/v1/admin/proposals/pending/route.ts`, `src/app/api/v1/proposals/[id]/approve/route.ts`

**Scenario C: Proposal Voting**
```
1. User navigates to active proposal
2. Clicks "Vote" button
3. Selects vote option (For/Against/Abstain)
4. Confirms wallet transaction
5. Transaction mined on-chain
6. Vote recorded off-chain
7. Vote bar updates with new tally
```

**Files**: `src/app/governance-vote/page.tsx`, `src/app/api/v1/proposals/[id]/votes/route.ts`

**Scenario D: Proposal Finalization**
```
1. Proposal end time reached
2. Admin/Worker triggers finalization
3. Final vote tally fetched from blockchain
4. Proposal status = PASSED/REJECTED
5. Results published to snapshot
```

**Files**: `src/lib/proposal-finalize.ts`, `src/app/api/v1/cron/finalize/route.ts`

**Success Criteria**:
- ✓ Draft proposals not visible to public
- ✓ Only admins can approve proposals
- ✓ Voting requires valid signature
- ✓ Finalized proposals immutable
- ✓ All transitions logged in audit-log

### 2.3 Delegation System

**Test Scenarios**:

**Scenario A: Delegate Selection**
```
1. User navigates to /dashboard
2. Clicks "Choose Delegate"
3. Browses delegate leaderboard
4. Selects delegate by address
5. Signs delegation transaction
6. Delegation recorded on-chain
7. Voting power updated
```

**Files**: `src/lib/delegation.ts`, `src/app/api/v1/delegation/[address]/route.ts`

**Scenario B: Delegation Revocation**
```
1. User views current delegation
2. Clicks "Revoke"
3. Signs revocation transaction
4. Voting power returned to user
```

**Scenario C: Delegate Leaderboard**
```
1. User navigates to /delegations/leaderboard
2. Sees delegates ranked by voting power
3. Filters by trust score
4. Views delegate stats
```

**Files**: `src/app/api/v1/delegations/leaderboard/route.ts`

### 2.4 Admin Functions

**Test Scenarios**:

**Scenario A: Proposal Moderation**
```
1. Admin flags inappropriate proposal
2. Adds moderation reason
3. Proposal status = REJECTED
4. User notified
```

**Scenario B: Election Management**
```
1. Admin creates election
2. Sets start/end times
3. Configures voting options
4. Publishes election
5. Monitors live results
```

**Files**: `src/app/api/v1/admin/election/route.ts`, `src/lib/election.ts`

**Scenario C: Audit Log Review**
```
1. Admin navigates to /audit-log
2. Filters by date/user/action
3. Exports CSV
4. Identifies suspicious activity
```

**Files**: `src/app/api/v1/audit-log/route.ts`, `src/lib/audit-log.ts`

### 2.5 Notifications System

**Test Scenarios**:

**Scenario A: Real-time Notifications**
```
1. User has unread notifications badge
2. New proposal approved
3. Badge count increments
4. Notification appears in dropdown
5. User clicks notification
6. Redirected to relevant page
7. Notification marked as read
```

**Files**: `src/lib/notifications.ts`, `src/app/api/v1/notifications/route.ts`

**Scenario B: Bulk Read**
```
1. User clicks "Mark all read"
2. All unread notifications updated
3. Badge count = 0
```

**Files**: `src/app/api/v1/notifications/read-all/route.ts`

### 2.6 Settings & User Profile

**Test Scenarios**:

**Scenario A: User Preferences**
```
1. User navigates to /settings
2. Toggles email notifications
3. Changes theme preference
4. Updates delegate address
5. Saves settings
6. Changes persisted
```

**Files**: `src/app/api/v1/settings/route.ts`, `src/lib/user-settings.ts`

---

## Phase 3: Security Audit (Critical Focus)

**Objective**: Validate voting system integrity, anti-manipulation measures, smart contract security

**Lead Agent**: `security-auditor`  
**Support**: `backend-architect` for architecture review  
**Duration**: 12-16 hours  
**Dependencies**: Phase 2 complete

### 3.1 Voting System Integrity

**Security Properties**:
```
✓ One vote, one address (no double voting)
✓ Votes immutable after submission
✓ Finalization requires blockchain consensus
✓ No off-chain vote manipulation
✓ Sybil resistance through wallet verification
```

**Files to Audit**:
```
Voting Logic:
├── src/app/governance-vote/page.tsx      # Voting UI + transaction
├── src/app/api/v1/proposals/[id]/votes/route.ts
├── src/app/api/v1/proposals/[id]/votes/live/route.ts
├── src/lib/proposal-finalize.ts          # Finalization logic
└── src/lib/validators.ts                # Input validation

Smart Contract Integration:
├── src/config/wagmi.ts                  # Contract addresses
└── src/lib/api.tsx                      # Contract read/write
```

**Security Tests**:

**Test A: Double-Voting Prevention**
```typescript
test('cannot vote twice on same proposal', async () => {
  const proposalId = '123'
  const voterAddress = '0x123...'
  
  // First vote succeeds
  await vote(proposalId, voterAddress, 'FOR')
  expect(await getVoteCount(proposalId, voterAddress)).toBe(1)
  
  // Second vote fails
  await expect(
    vote(proposalId, voterAddress, 'AGAINST')
  ).rejects.toThrow('Already voted')
})
```

**Test B: Vote Immutable After Submission**
```typescript
test('vote cannot be modified after submission', async () => {
  const voteId = 'vote_123'
  
  // Attempt to update vote
  await expect(
    updateVote(voteId, 'AGAINST')
  ).rejects.toThrow('Vote immutable')
})
```

**Test C: Finalization Requires Blockchain Consensus**
```typescript
test('finalization validates blockchain state', async () => {
  const proposalId = '456'
  
  // Attempt to finalize with wrong tally
  await expect(
    finalizeProposal(proposalId, { for: 100, against: 50 })
  ).rejects.toThrow('Tally mismatch')
  
  // Correct tally succeeds
  await finalizeProposal(proposalId, { for: 150, against: 50 })
  expect(await getProposalStatus(proposalId)).toBe('PASSED')
})
```

**Test D: Sybil Resistance**
```typescript
test('requires valid wallet signature', async () => {
  const fakeAddress = '0x000...000'
  
  // Vote without valid signature
  await expect(
    vote('123', fakeAddress, 'FOR', { signature: 'invalid' })
  ).rejects.toThrow('Invalid signature')
})
```

### 3.2 Anti-Manipulation Measures

**Attack Vectors to Test**:

**A. Timestamp Manipulation**
```
Scenario: Attacker tries to vote after deadline
Defense:
├── Server-side timestamp validation
├── Blockchain block timestamp verification
└── Proposal end time stored on-chain
```

**Files**: `src/lib/proposal-finalize.ts`, `src/app/api/v1/proposals/[id]/votes/route.ts`

**Test**:
```typescript
test('rejects vote after proposal deadline', async () => {
  const expiredProposal = await createExpiredProposal()
  
  await expect(
    vote(expiredProposal.id, voter, 'FOR')
  ).rejects.toThrow('Proposal expired')
})
```

**B. Replay Attacks**
```
Scenario: Attacker replays valid transaction
Defense:
├── Nonce usage (one-time per vote)
├── Transaction hash uniqueness check
└── Chain ID validation
```

**Test**:
```typescript
test('prevents transaction replay', async () => {
  const tx = { to: '0x...', data: '0x...', nonce: 1 }
  
  // First submission succeeds
  await submitVote(tx)
  
  // Replay fails
  await expect(submitVote(tx)).rejects.toThrow('Transaction replayed')
})
```

**C. Front-Running (MEV)**
```
Scenario: Attacker sees pending vote, submits competing transaction
Defense:
├── Use commit-reveal scheme (if applicable)
├── Limit voting window
└── Monitor for suspicious patterns
```

**Analysis Required**: Review mempool behavior + ordering guarantees

**D. Delegation Manipulation**
```
Scenario: Attacker delegates to multiple addresses to multiply influence
Defense:
├── One delegation per address active
├── Delegation revocation requires cooldown
└── Total voting power validation
```

**Files**: `src/lib/delegation.ts`

**Test**:
```typescript
test('prevents delegation multiplication', async () => {
  const delegator = '0x123...'
  
  // First delegation succeeds
  await delegate(delegator, 'delegateA')
  expect(await getVotingPower(delegator)).toBe('delegated')
  
  // Second delegation replaces first
  await delegate(delegator, 'delegateB')
  expect(await getCurrentDelegate(delegator)).toBe('delegateB')
})
```

### 3.3 Smart Contract Security

**Contract Interfaces to Validate**:
```
Governance Contract:
├── vote(proposalId, support) - Voting function
├── hasVoted(address, proposalId) - Vote state
├── finalizeProposal(proposalId) - Finalization
└── getProposalTally(proposalId) - Vote tally

Delegation Contract:
├── setDelegate(delegate) - Set delegate
├── getDelegate(address) - Query delegate
└── getVotingPower(address) - Query power
```

**Security Checklist**:
- [ ] Contract addresses verified on Etherscan
- [ ] Contract ABI matches actual deployment
- [ ] Read/write functions use correct encoding
- [ ] Error handling for contract reverts
- [ ] Gas estimation includes sufficient buffer
- [ ] Transaction signing uses correct chain ID

**Files**: `src/config/wagmi.ts`, all contract read/write calls

**Test**:
```typescript
test('handles contract revert gracefully', async () => {
  // Mock contract revert
  mockContractRevert(governanceContract, 'vote', 'Already voted')
  
  await expect(
    voteOnContract('123', 'FOR')
  ).rejects.toThrow('Already voted')
  
  // Verify UI shows error message
  expect(screen.getByText('You have already voted')).toBeInTheDocument()
})
```

### 3.4 API Security

**Endpoints to Audit**:
```
Public:
├── GET  /api/v1/proposals              # Public proposal feed
├── GET  /api/v1/proposals/[id]         # Public proposal detail
├── GET  /api/v1/health                 # Health check
└── GET  /api/v1/test-public            # Public test endpoint

Authenticated:
├── POST /api/v1/verify                # SIWE verification
├── GET  /api/v1/me                    # Current user
├── POST /api/v1/proposals              # Create proposal
├── POST /api/v1/proposals/[id]/votes  # Submit vote
├── POST /api/v1/delegation            # Set delegate
└── GET  /api/v1/settings              # User settings

Admin:
├── POST /api/v1/admin/proposals/pending  # Approve proposal
├── POST /api/v1/admin/proposals/[id]/approve
├── POST /api/v1/admin/proposals/[id]/reject
├── POST /api/v1/admin/election        # Create election
└── GET  /api/v1/audit-log             # Audit trail
```

**Security Tests**:

**Test A: Authentication Required**
```typescript
test('authenticated endpoints return 401 without session', async () => {
  const response = await fetch('/api/v1/me', {
    headers: { cookie: '' } // No session
  })
  
  expect(response.status).toBe(401)
})
```

**Test B: Authorization Required**
```typescript
test('admin endpoints require admin role', async () => {
  const regularUser = await createRegularUser()
  
  const response = await fetch('/api/v1/admin/proposals/pending', {
    method: 'POST',
    headers: { 
      cookie: regularUser.sessionCookie 
    }
  })
  
  expect(response.status).toBe(403)
})
```

**Test C: Input Validation**
```typescript
test('rejects malformed proposal data', async () => {
  const response = await fetch('/api/v1/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '', // Empty title
      description: 'A'.repeat(10001), // Too long
      type: 'INVALID_TYPE'
    })
  })
  
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    error: expect.stringContaining('validation')
  })
})
```

**Test D: Rate Limiting**
```typescript
test('rate limits vote submission', async () => {
  const proposalId = '123'
  
  // Submit 10 votes rapidly
  const promises = Array(10).fill(null).map(() => 
    fetch(`/api/v1/proposals/${proposalId}/votes`, { method: 'POST' })
  )
  
  const responses = await Promise.all(promises)
  const rateLimited = responses.filter(r => r.status === 429)
  
  expect(rateLimited.length).toBeGreaterThan(0)
})
```

**Files**: `src/lib/rate-limit.ts`, all API routes

### 3.5 Data Validation & Sanitization

**Files to Audit**:
```
Input Validation:
├── src/lib/validators.ts              # Zod schemas
├── src/lib/sanitize.ts                # Sanitization utilities
├── src/lib/api-response.ts            # Response formatting

User-Generated Content:
├── Proposal titles/descriptions
├── Comment text
├── Tag names
└── Notification messages
```

**Security Tests**:

**Test A: XSS Prevention**
```typescript
test('sanitizes HTML in proposal descriptions', async () => {
  const maliciousDescription = '<script>alert("XSS")</script>'
  
  await createProposal({ description: maliciousDescription })
  
  const proposal = await getProposal(proposalId)
  expect(proposal.description).not.toContain('<script>')
})
```

**Test B: SQL Injection Prevention**
```typescript
test('escapes special characters in database queries', async () => {
  const maliciousInput = "'; DROP TABLE proposals; --"
  
  await expect(
    searchProposals(maliciousInput)
  ).resolves.not.toThrow()
  
  // Verify table still exists
  const count = await db.proposals.count()
  expect(count).toBeGreaterThan(0)
})
```

**Test C: Injection in Tags**
```typescript
test('sanitizes tag names', async () => {
  const maliciousTags = ['<img src=x onerror=alert(1)>', 'tag; DROP TABLE--']
  
  await setTags(maliciousTags)
  
  const tags = await getTags()
  tags.forEach(tag => {
    expect(tag).not.toMatch(/[<>]/)
    expect(tag).not.toMatch(/;/)
  })
})
```

### 3.6 Session & Authentication Security

**Files to Audit**:
```
Authentication:
├── src/lib/auth.ts                   # 15KB - Core auth logic
├── src/lib/siwe.tsx                  # SIWE message construction
├── src/lib/session.ts                # Session management
└── src/app/api/v1/verify/route.ts   # Verification endpoint

Session Flow:
1. Frontend: SIWE message constructed
2. User signs with wallet
3. Backend: Signature verified
4. Session cookie set (HttpOnly, Secure, SameSite)
5. Subsequent requests validated
```

**Security Tests**:

**Test A: SIWE Message Validation**
```typescript
test('rejects tampered SIWE messages', async () => {
  const validMessage = constructSIWEMessage(address, nonce, domain)
  const tamperedMessage = validMessage.replace('Address:', 'ADDRESS:')
  
  const signature = await wallet.signMessage(validMessage)
  
  await expect(
    verifySignature(tamperedMessage, signature)
  ).rejects.toThrow('Invalid message format')
})
```

**Test B: Nonce Reuse Prevention**
```typescript
test('prevents nonce reuse', async () => {
  const nonce = await generateNonce()
  
  // First use succeeds
  await verifySignature(message, signature, nonce)
  
  // Second use fails
  await expect(
    verifySignature(message, signature, nonce)
  ).rejects.toThrow('Nonce already used')
})
```

**Test C: Session Expiration**
```typescript
test('session expires after timeout', async () => {
  const session = await createSession()
  
  // Fast-forward time
  vi.advanceTimersByTime(25 * 60 * 1000) // 25 minutes
  
  const response = await fetch('/api/v1/me', {
    headers: { cookie: session.cookie }
  })
  
  expect(response.status).toBe(401)
})
```

**Test D: Session Cookie Security**
```typescript
test('session cookie has secure attributes', async () => {
  const response = await fetch('/api/v1/verify', { method: 'POST' })
  const setCookie = response.headers.get('set-cookie')!
  
  expect(setCookie).toContain('HttpOnly')
  expect(setCookie).toContain('Secure')
  expect(setCookie).toContain('SameSite=Strict')
})
```

### 3.7 Audit Trail & Compliance

**Files to Audit**:
```
Audit Logging:
├── src/lib/audit-log.ts              # Audit log utilities
├── src/app/api/v1/audit-log/route.ts # Audit query endpoint

Events to Log:
├── User authentication (login/logout)
├── Proposal creation/modification
├── Vote submission
├── Delegation changes
├── Admin actions
└── Failed authentication attempts
```

**Compliance Tests**:

**Test A: All Critical Events Logged**
```typescript
test('logs all vote submissions', async () => {
  await vote('proposal-123', 'FOR')
  
  const logs = await getAuditLogs({ action: 'VOTE_SUBMIT' })
  const voteLog = logs.find(l => l.proposalId === 'proposal-123')
  
  expect(voteLog).toMatchObject({
    action: 'VOTE_SUBMIT',
    userId: expect.any(String),
    timestamp: expect.any(Date),
    ipAddress: expect.any(String),
    userAgent: expect.any(String)
  })
})
```

**Test B: Log Integrity**
```typescript
test('audit logs are immutable', async () => {
  const logId = await createAuditLog({ action: 'TEST' })
  
  await expect(
    updateAuditLog(logId, { action: 'MODIFIED' })
  ).rejects.toThrow('Audit logs are immutable')
})
```

**Test C: Log Retention**
```typescript
test('maintains logs for required retention period', async () => {
  const oldDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 180 days ago
  
  const logs = await getAuditLogs({ 
    startDate: oldDate,
    endDate: new Date()
  })
  
  expect(logs.length).toBeGreaterThan(0)
})
```

---

## Phase 4: Cross-Device Visual Validation

**Objective**: Validate responsive design, visual consistency, accessibility across all screen sizes and browsers

**Lead Agent**: `ui-ux-expert`  
**Support**: `agent-browser` for screenshot automation  
**Duration**: 6-8 hours  
**Dependencies**: Phase 3 complete

### 4.1 Responsive Design Testing

**Viewports to Test**:
```
Mobile:
├── iPhone SE: 375px × 667px
├── iPhone 12 Pro: 390px × 844px
└── iPhone 14 Plus: 428px × 926px

Tablet:
├── iPad Mini: 768px × 1024px
├── iPad Pro: 1024px × 1366px
└── Surface Pro: 912px × 1368px

Desktop:
├── Laptop: 1366px × 768px
├── Desktop: 1920px × 1080px
└── Wide: 2560px × 1440px
```

**Critical Pages to Test**:
```
├── / (Landing page)
├── /dashboard (Main dashboard)
├── /proposals (Proposal feed)
├── /proposals/[id] (Proposal detail)
├── /governance-vote (Voting interface)
├── /admin (Admin panel)
└── /settings (User settings)
```

**Test Automation**:
```typescript
// src/__tests__/e2e/responsive.spec.ts
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'Desktop', width: 1920, height: 1080 }
]

for (const viewport of viewports) {
  test(`responsive layout on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/proposals')
    
    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => 
      document.documentElement.scrollWidth
    )
    const clientWidth = await page.evaluate(() => 
      document.documentElement.clientWidth
    )
    expect(scrollWidth).toBe(clientWidth)
    
    // Verify text readable (min 16px)
    const fontSize = await page.evaluate(() => 
      window.getComputedStyle(document.body).fontSize
    )
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16)
    
    // Verify touch targets min 44x44px on mobile
    if (viewport.width < 768) {
      const buttons = await page.$$('button')
      for (const button of buttons) {
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
    }
  })
}
```

### 4.2 Browser Compatibility

**Browsers to Test**:
```
Chrome:
├── Latest (v127+)
├── Previous major (v125)
└── ESR (Enterprise)

Firefox:
├── Latest (v128+)
└── Previous major (v126)

Safari:
├── iOS (v17+)
└── macOS (v17+)

Edge:
└── Latest (v127+)
```

**Wallet Support Matrix**:
```
MetaMask          ✓ Chrome, Firefox, Edge, Brave
WalletConnect     ✓ All mobile wallets
Coinbase Wallet   ✓ Chrome, iOS, Android
Rainbow           ✓ Mobile (iOS/Android)
Trust Wallet      ✓ Mobile (iOS/Android)
```

**Test Scenarios**:

**Scenario A: Core Functionality by Browser**
```typescript
const browsers = ['chromium', 'firefox', 'webkit']

for (const browserType of browsers) {
  test(`${browserType}: complete voting flow`, async ({ page }) => {
    await page.goto('/proposals/123')
    await page.click('[data-testid="vote-button"]')
    // ... full voting flow
  })
}
```

**Scenario B: Web3 Provider Compatibility**
```typescript
test('RainbowKit integration across wallets', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('[data-testid="connect-wallet"]')
  
  // Verify all configured wallets appear
  const wallets = await page.$$('[data-testid^="wallet-"]')
  const walletNames = await Promise.all(
    wallets.map(w => w.getAttribute('data-testid'))
  )
  
  expect(walletNames).toContain('wallet-metamask')
  expect(walletNames).toContain('wallet-walletconnect')
  expect(walletNames).toContain('wallet-coinbase')
})
```

### 4.3 Visual Regression Testing

**Setup Screenshot Baselines**:
```bash
# Take baseline screenshots (once, for reference)
npm run test:e2e -- --update-screenshots
```

**Test Implementation**:
```typescript
// src/__tests__/e2e/visual-regression.spec.ts
test('visual regression: proposal card', async ({ page }) => {
  await page.goto('/proposals')
  
  // Wait for content to load
  await page.waitForSelector('[data-testid="proposal-card"]')
  
  // Take screenshot
  await page.screenshot({
    path: '.audit/screenshots/proposal-card.png',
    fullPage: false
  })
  
  // Compare with baseline (handled by Playwright)
  expect(await page.screenshot()).toMatchSnapshot('proposal-card.png')
})
```

**Critical Components to Snapshot**:
```
├── Proposal card
├── Vote bar
├── Wallet connect modal
├── Proposal detail page
├── Voting interface
├── Dashboard layout
└── Admin panel
```

### 4.4 Accessibility (a11y) Testing

**WCAG 2.1 AA Compliance Tests**:

**Test A: Keyboard Navigation**
```typescript
test('keyboard navigation works', async ({ page }) => {
  await page.goto('/proposals')
  
  // Tab through interactive elements
  await page.keyboard.press('Tab')
  let focused = await page.evaluate(() => document.activeElement?.tagName)
  expect(focused).toBe('BUTTON')
  
  // Navigate to first proposal
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/proposals\/\d+/)
})
```

**Test B: Screen Reader Compatibility**
```typescript
test('ARIA labels present', async ({ page }) => {
  await page.goto('/proposals/123')
  
  // Check vote buttons have labels
  const voteButtons = await page.$$('button[aria-label*="vote"]')
  expect(voteButtons.length).toBeGreaterThan(0)
  
  // Check live regions for vote updates
  const liveRegions = await page.$$('[aria-live="polite"]')
  expect(liveRegions.length).toBeGreaterThan(0)
})
```

**Test C: Color Contrast**
```typescript
test('color contrast meets WCAG AA', async ({ page }) => {
  await page.goto('/proposals')
  
  const contrasts = await page.evaluate(() => {
    const results: { element: string; ratio: number }[] = []
    const elements = document.querySelectorAll('*')
    
    elements.forEach(el => {
      const styles = window.getComputedStyle(el)
      const color = styles.color
      const bg = styles.backgroundColor
      
      if (color && bg && bg !== 'rgba(0, 0, 0, 0)') {
        // Simplified contrast calculation
        results.push({
          element: el.tagName,
          ratio: 4.5 // Placeholder - actual calculation needed
        })
      }
    })
    
    return results
  })
  
  contrasts.forEach(({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})
```

**Test D: Focus Management**
```typescript
test('focus managed correctly', async ({ page }) => {
  // Modal focus trap
  await page.goto('/proposals/123')
  await page.click('[data-testid="vote-button"]')
  
  let focused = await page.evaluate(() => document.activeElement?.tagName)
  expect(focused).toBe('DIALOG') // or similar
  
  // Focus returns after modal close
  await page.keyboard.press('Escape')
  focused = await page.evaluate(() => document.activeElement?.textContent)
  expect(focused).toContain('Vote')
})
```

---

## Phase 5: Performance & Reliability

**Objective**: Validate load handling, measure performance metrics, test error handling

**Lead Agent**: `qa-debugger`  
**Support**: `backend-architect` for performance optimization  
**Duration**: 8-10 hours  
**Dependencies**: Phase 4 complete

### 5.1 Performance Metrics

**Core Web Vitals Targets**:
```
Largest Contentful Paint (LCP): < 2.5s
First Input Delay (FID): < 100ms
Cumulative Layout Shift (CLS): < 0.1
Time to First Byte (TTFB): < 600ms
First Contentful Paint (FCP): < 1.8s
```

**Test Implementation**:
```typescript
// src/__tests__/performance/core-web-vitals.spec.ts
test('measures Core Web Vitals', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        resolve(entries)
      }).observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })
    })
  })
  
  const lcp = metrics.find(m => m.entryType === 'largest-contentful-paint')
  expect(lcp?.startTime).toBeLessThan(2500)
})
```

**Page Load Budgets**:
```
Route              LCP     FCP     TTFB    Total Size
------------------------------------------------------
/                  2.0s    1.0s    400ms   < 500KB
/dashboard         2.5s    1.5s    500ms   < 800KB
/proposals         2.0s    1.2s    400ms   < 600KB
/proposals/[id]    2.5s    1.5s    500ms   < 700KB
/governance-vote   3.0s    1.8s    600ms   < 900KB
```

### 5.2 Load Testing

**Load Scenarios**:

**Scenario A: Concurrent Users**
```
100 concurrent users browsing proposals
50 concurrent users voting simultaneously
20 concurrent admins managing proposals
```

**Test Implementation**:
```typescript
// load-test.js (use k6 or similar)
import http from 'k6/http'
import { check, sleep } from 'k6'

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 0 },   // Ramp down
  ],
}

export default function () {
  // Browse proposals
  let res = http.get('https://omnom-dao.com/proposals')
  check(res, { 'status was 200': (r) => r.status === 200 })
  
  // View proposal detail
  res = http.get('https://omnom-dao.com/proposals/123')
  check(res, { 'status was 200': (r) => r.status === 200 })
  
  sleep(3)
}
```

**Scenario B: API Endpoint Load**
```
GET /api/v1/proposals - 1000 req/s
POST /api/v1/proposals/[id]/votes - 100 req/s
GET /api/v1/proposals/[id] - 500 req/s
```

**Success Criteria**:
- ✓ P95 latency < 500ms for GET endpoints
- ✓ P95 latency < 1000ms for POST endpoints
- ✓ Zero 5xx errors under normal load
- ✓ Graceful degradation at 2x load

### 5.3 Database Performance

**Queries to Optimize**:
```
├── Proposal feed (pagination, filtering)
├── Vote tally aggregation
├── Delegate leaderboard
├── Audit log queries (date range)
└── User settings retrieval
```

**Test Implementation**:
```typescript
// src/__tests__/performance/database.spec.ts
test('proposal query performs under 100ms', async () => {
  const start = Date.now()
  
  await getProposals({ 
    page: 1, 
    limit: 20,
    status: 'ACTIVE'
  })
  
  const duration = Date.now() - start
  expect(duration).toBeLessThan(100)
})
```

**Index Validation**:
```sql
-- Verify critical indexes exist
EXPLAIN QUERY PLAN SELECT * FROM proposals 
WHERE status = 'ACTIVE' 
ORDER BY created_at DESC 
LIMIT 20;

-- Should show: INDEX proposals_status_created_at_idx
```

### 5.4 Blockchain Performance

**Test Scenarios**:

**Scenario A: RPC Endpoint Performance**
```typescript
test('RPC responses complete within timeout', async () => {
  const timeout = 10000 // 10s
  
  await expect(
    Promise.race([
      publicClient.readContract({ 
        address: governanceContract,
        functionName: 'getProposalTally',
        args: [proposalId]
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ])
  ).resolves.toBeDefined()
})
```

**Scenario B: Transaction Confirmation Time**
```typescript
test('vote transaction confirms within reasonable time', async () => {
  const hash = await wallet.writeContract({
    address: governanceContract,
    functionName: 'vote',
    args: [proposalId, true]
  })
  
  const start = Date.now()
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const duration = Date.now() - start
  
  // Should confirm within 3 minutes (180 blocks on Ethereum)
  expect(duration).toBeLessThan(180000)
  expect(receipt.status).toBe('success')
})
```

### 5.5 Error Handling

**Error Scenarios to Test**:

**A. Network Failures**
```typescript
test('handles network failure gracefully', async ({ page }) => {
  // Simulate network offline
  await page.context().setOffline(true)
  
  await page.goto('/proposals')
  
  // Should show error boundary, not crash
  expect(await page.textContent('body')).toContain('offline')
  
  // Retry when network restored
  await page.context().setOffline(false)
  await page.click('[data-testid="retry-button"]')
  
  await page.waitForSelector('[data-testid="proposal-card"]')
})
```

**B. RPC Failures**
```typescript
test('handles RPC endpoint failure', async () => {
  // Mock RPC failure
  mockRPCFailure()
  
  const result = await voteOnContract('123', true)
  
  // Should fall back gracefully or show error
  expect(result).toMatchObject({
    success: false,
    error: expect.stringContaining('RPC')
  })
})
```

**C. Database Connection Loss**
```typescript
test('retries database queries on connection loss', async () => {
  // Mock connection loss
  mockDatabaseDisconnect()
  
  const result = await getProposals()
  
  // Should retry and succeed
  expect(result).toBeDefined()
  expect(result.proposals).toBeInstanceOf(Array)
})
```

**D. Wallet Transaction Failures**
```typescript
test('handles user rejection gracefully', async ({ page }) => {
  await page.goto('/proposals/123')
  await page.click('[data-testid="vote-button"]')
  
  // Mock user rejection in wallet
  mockWalletReject()
  
  // Should show error, not crash
  expect(await page.textContent('[data-testid="error-message"]'))
    .toContain('rejected')
})
```

### 5.6 Edge Cases

**Test Cases**:

**A. Empty States**
```typescript
test('handles empty proposal feed', async ({ page }) => {
  // Mock empty response
  mockEmptyProposals()
  
  await page.goto('/proposals')
  
  expect(await page.textContent('[data-testid="empty-state"]'))
    .toContain('No proposals')
})
```

**B. Extremely Long Content**
```typescript
test('handles long proposal descriptions', async ({ page }) => {
  const longDescription = 'A'.repeat(100000)
  await createProposal({ description: longDescription })
  
  await page.goto(`/proposals/${proposalId}`)
  
  // Should render without performance issues
  const renderTime = await page.evaluate(() => 
    performance.timing.loadEventEnd - performance.timing.navigationStart
  )
  expect(renderTime).toBeLessThan(3000)
})
```

**C: Concurrent Vote Submissions**
```typescript
test('prevents race conditions in voting', async () => {
  const proposalId = '123'
  
  // Submit identical votes simultaneously
  const votes = await Promise.all([
    vote(proposalId, voter, 'FOR'),
    vote(proposalId, voter, 'FOR'),
    vote(proposalId, voter, 'FOR'),
  ])
  
  // Only one should succeed
  const successful = votes.filter(v => v.success === true)
  expect(successful.length).toBe(1)
})
```

**D. Timestamp Edge Cases**
```typescript
test('handles proposal at exact deadline', async () => {
  // Create proposal ending now
  const proposal = await createProposal({
    endTime: new Date()
  })
  
  // Should handle boundary correctly
  const status = await getProposalStatus(proposal.id)
  expect(status).toMatch(/ACTIVE|EXPIRED/) // Either is acceptable
})
```

---

## Phase 6: Build & Deployment Validation

**Objective**: Validate production build, test deployment process, verify environment configuration

**Lead Agent**: `devops-engineer`  
**Support**: `backend-architect` for architecture validation  
**Duration**: 4-6 hours  
**Dependencies**: Phase 5 complete

### 6.1 Production Build Validation

**Build Process**:
```bash
# Clean build
rm -rf .next
npm run build

# Verify build output
ls -lh .next/static/
ls -lh .next/server/app/
```

**Validation Checks**:

**Check A: Build Completeness**
```bash
# Verify all routes built
test -f .next/server/app/page.html          # Landing page
test -f .next/server/app/dashboard.html     # Dashboard
test -f .next/server/app/proposals.html     # Proposals feed
test -f .next/server/app/admin.html         # Admin panel
```

**Check B: Asset Optimization**
```bash
# Verify minification
grep -r '\.js.map' .next/static/ | wc -l  # Should be 0 (no source maps)
gzip -l .next/static/chunks/*.js           # Check gzip sizes

# Verify image optimization
ls -lh .next/static/image/                 # Should have optimized images
```

**Check C: Environment Variables**
```bash
# Verify all required env vars set
test -n "$NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID"
test -n "$DATABASE_URL"
test -n "$SESSION_SECRET"
test -n "$NEXT_PUBLIC_ALCHEMY_API_KEY"
```

**Test Implementation**:
```typescript
// src/__tests__/build/production-build.spec.ts
test('production build completes successfully', async () => {
  const { execSync } = require('child_process')
  
  // Build
  execSync('npm run build', { stdio: 'inherit' })
  
  // Verify build output
  expect(fs.existsSync('.next/BUILD_ID')).toBe(true)
  expect(fs.existsSync('.next/static')).toBe(true)
  expect(fs.existsSync('.next/server')).toBe(true)
})
```

### 6.2 Environment Configuration

**Environment Variables Matrix**:
```
Variable              Local   Prod    Required?   Description
----------------------------------------------------------------
DATABASE_URL          ✓       ✓       Yes        LibSQL connection
SESSION_SECRET        ✓       ✓       Yes        Session encryption
NEXT_PUBLIC_CHAIN_ID  ✓       ✓       Yes        Blockchain network
NEXT_PUBLIC_CONTRACT  ✓       ✓       Yes        Governance contract
WC_PROJECT_ID         ✓       ✓       Yes        WalletConnect
ALCHEMY_API_KEY       ✓       ✓       Yes        RPC provider
VERCEL_KV_URL         ✓       ✓       Yes        KV storage
RESEND_API_KEY        ✓       ✓       Yes        Email sending
```

**Validation Test**:
```typescript
// src/__tests__/config/environment.spec.ts
test('all required env vars present', () => {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_CONTRACT_ADDRESS',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  expect(missing).toEqual([])
})
```

### 6.3 Deployment Testing

**Vercel Deployment Validation**:
```bash
# Deploy preview
vercel deploy --prebuilt

# Run smoke tests against preview
npm run test:e2e -- --project=vercel-preview

# Deploy to production
vercel deploy --prebuilt --prod
```

**Smoke Test Suite**:
```typescript
// src/__tests__/e2e/deployment-smoke.spec.ts
test('production deployment smoke test', async ({ page }) => {
  // Test critical pages load
  const pages = [
    '/',
    '/dashboard',
    '/proposals',
    '/faq',
    '/settings'
  ]
  
  for (const url of pages) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    expect(await page.title()).not.toBe('Error')
  }
})
```

### 6.4 Health Checks

**Endpoint Tests**:
```typescript
// src/__tests__/e2e/health.spec.ts
test('health check endpoint responds', async () => {
  const response = await fetch('/api/v1/health')
  
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    status: 'ok',
    timestamp: expect.any(String),
    database: expect.any(String),
    blockchain: expect.any(String)
  })
})
```

**Database Connectivity**:
```typescript
test('database connection healthy', async () => {
  const result = await db.query('SELECT 1 as health')
  
  expect(result[0].health).toBe(1)
})
```

**Blockchain Connectivity**:
```typescript
test('blockchain RPC reachable', async () => {
  const blockNumber = await publicClient.getBlockNumber()
  
  expect(blockNumber).toBeGreaterThan(0)
})
```

---

## Task List Summary

### Phase 1: Discovery & Analysis (20 tasks)
- [ ] 1.1.1 Map authentication flow
- [ ] 1.1.2 Document database schema
- [ ] 1.1.3 Diagram blockchain integration
- [ ] 1.1.4 Document caching strategy
- [ ] 1.2.1 Catalog all routes and features
- [ ] 1.2.2 Map component ownership
- [ ] 1.2.3 Document API endpoints
- [ ] 1.2.4 Identify permission boundaries
- [ ] 1.3.1 Run type check (tsc --noEmit)
- [ ] 1.3.2 Run linter (npm run lint)
- [ ] 1.3.3 Check test coverage
- [ ] 1.3.4 Scan for TODO comments
- [ ] 1.3.5 Identify large files (>500 LOC)
- [ ] 1.3.6 Check for console.log/debugger
- [ ] 1.3.7 Verify no hardcoded secrets
- [ ] 1.3.8 Review dependency versions
- [ ] 1.3.9 Check for unused dependencies
- [ ] 1.3.10 Verify ES target consistency
- [ ] 1.3.11 Document code quality findings
- [ ] 1.3.12 Create architecture diagram

### Phase 2: Functional Testing (35 tasks)
- [ ] 2.1.1 SIWE connection happy path
- [ ] 2.1.2 Session persistence test
- [ ] 2.1.3 Wallet disconnect test
- [ ] 2.1.4 Invalid signature rejection
- [ ] 2.1.5 Nonce reuse prevention
- [ ] 2.2.1 Proposal creation draft
- [ ] 2.2.2 Proposal approval flow
- [ ] 2.2.3 Proposal voting flow
- [ ] 2.2.4 Proposal finalization
- [ ] 2.2.5 Draft proposal visibility
- [ ] 2.2.6 Admin-only approval
- [ ] 2.2.7 Vote signature requirement
- [ ] 2.2.8 Finalized proposal immutability
- [ ] 2.2.9 Audit log entries
- [ ] 2.3.1 Delegate selection flow
- [ ] 2.3.2 Delegation revocation
- [ ] 2.3.3 Delegate leaderboard
- [ ] 2.3.4 Voting power transfer
- [ ] 2.4.1 Proposal moderation
- [ ] 2.4.2 Election management
- [ ] 2.4.3 Audit log review
- [ ] 2.4.4 Admin authentication
- [ ] 2.4.5 Admin authorization
- [ ] 2.5.1 Real-time notifications
- [ ] 2.5.2 Notification badge count
- [ ] 2.5.3 Notification read status
- [ ] 2.5.4 Bulk read functionality
- [ ] 2.5.5 Notification redirect
- [ ] 2.6.1 User preferences update
- [ ] 2.6.2 Theme persistence
- [ ] 2.6.3 Email notification toggle
- [ ] 2.6.4 Settings validation
- [ ] 2.6.5 Settings API error handling
- [ ] 2.6.6 Settings persistence
- [ ] 2.6.7 Settings rollback on error
- [ ] 2.6.8 Settings export/import

### Phase 3: Security Audit (40 tasks)
- [ ] 3.1.1 Double-voting prevention
- [ ] 3.1.2 Vote immutability
- [ ] 3.1.3 Blockchain consensus validation
- [ ] 3.1.4 Sybil resistance verification
- [ ] 3.1.5 Contract address validation
- [ ] 3.1.6 Contract ABI validation
- [ ] 3.1.7 Gas estimation accuracy
- [ ] 3.1.8 Transaction encoding
- [ ] 3.2.1 Timestamp manipulation test
- [ ] 3.2.2 Replay attack prevention
- [ ] 3.2.3 Front-running mitigation
- [ ] 3.2.4 Delegation manipulation prevention
- [ ] 3.2.5 Flash loan attack check
- [ ] 3.2.6 Governance attack prevention
- [ ] 3.2.7 Whale manipulation mitigation
- [ ] 3.3.1 Public endpoint access
- [ ] 3.3.2 Authenticated endpoint protection
- [ ] 3.3.3 Admin endpoint authorization
- [ ] 3.3.4 Input validation enforcement
- [ ] 3.3.5 Rate limiting verification
- [ ] 3.3.6 CORS configuration
- [ ] 3.3.7 CSRF protection
- [ ] 3.3.8 API response size limits
- [ ] 3.4.1 XSS prevention
- [ ] 3.4.2 SQL injection prevention
- [ ] 3.4.3 NoSQL injection prevention
- [ ] 3.4.4 Command injection prevention
- [ ] 3.4.5 Path traversal prevention
- [ ] 3.4.6 SSRF prevention
- [ ] 3.4.7 LDAP injection prevention
- [ ] 3.5.1 SIWE message validation
- [ ] 3.5.2 Nonce reuse prevention
- [ ] 3.5.3 Session expiration
- [ ] 3.5.4 Session cookie security
- [ ] 3.5.5 CSRF token validation
- [ ] 3.5.6 Session fixation prevention
- [ ] 3.5.7 Concurrent session limit
- [ ] 3.5.8 Session revocation
- [ ] 3.6.1 Vote submission logging
- [ ] 3.6.2 Admin action logging
- [ ] 3.6.3 Auth attempt logging
- [ ] 3.6.4 Log immutability
- [ ] 3.6.5 Log retention
- [ ] 3.6.6 Log export functionality
- [ ] 3.6.7 Log search performance

### Phase 4: Visual Validation (25 tasks)
- [ ] 4.1.1 iPhone SE layout
- [ ] 4.1.2 iPhone 12 Pro layout
- [ ] 4.1.3 iPad layout
- [ ] 4.1.4 Desktop layout
- [ ] 4.1.5 Wide screen layout
- [ ] 4.1.6 Horizontal scroll check
- [ ] 4.1.7 Touch target size (mobile)
- [ ] 4.1.8 Font size readability
- [ ] 4.1.9 Responsive navigation
- [ ] 4.1.10 Responsive tables
- [ ] 4.2.1 Chrome compatibility
- [ ] 4.2.2 Firefox compatibility
- [ ] 4.2.3 Safari compatibility
- [ ] 4.2.4 Edge compatibility
- [ ] 4.2.5 Wallet compatibility matrix
- [ ] 4.2.6 RainbowKit integration
- [ ] 4.2.7 Web3 provider detection
- [ ] 4.2.8 Fallback for no wallet
- [ ] 4.3.1 Visual regression baseline
- [ ] 4.3.2 Proposal card snapshot
- [ ] 4.3.3 Vote bar snapshot
- [ ] 4.3.4 Wallet modal snapshot
- [ ] 4.3.5 Dashboard snapshot
- [ ] 4.3.6 Admin panel snapshot
- [ ] 4.4.1 Keyboard navigation
- [ ] 4.4.2 ARIA labels verification
- [ ] 4.4.3 Color contrast check
- [ ] 4.4.4 Focus management
- [ ] 4.4.5 Screen reader test
- [ ] 4.4.6 Form error announcements
- [ ] 4.4.7 Alt text for images
- [ ] 4.4.8 Form label association
- [ ] 4.4.9 Skip links present
- [ ] 4.4.10 Focus visible indicators

### Phase 5: Performance & Reliability (30 tasks)
- [ ] 5.1.1 LCP measurement
- [ ] 5.1.2 FID measurement
- [ ] 5.1.3 CLS measurement
- [ ] 5.1.4 TTFB measurement
- [ ] 5.1.5 FCP measurement
- [ ] 5.1.6 Page load budget validation
- [ ] 5.1.7 Bundle size analysis
- [ ] 5.1.8 Asset optimization verification
- [ ] 5.2.1 100 concurrent users test
- [ ] 5.2.2 API endpoint load test
- [ ] 5.2.3 Database query load test
- [ ] 5.2.4 RPC endpoint load test
- [ ] 5.2.5 P95 latency measurement
- [ ] 5.2.6 Error rate under load
- [ ] 5.2.7 Graceful degradation test
- [ ] 5.3.1 Proposal query performance
- [ ] 5.3.2 Vote tally performance
- [ ] 5.3.3 Leaderboard query performance
- [ ] 5.3.4 Audit log query performance
- [ ] 5.3.5 Database index validation
- [ ] 5.3.6 N+1 query detection
- [ ] 5.3.7 Connection pooling
- [ ] 5.4.1 RPC response time
- [ ] 5.4.2 Transaction confirmation time
- [ ] 5.4.3 RPC fallback test
- [ ] 5.4.4 Block reorg handling
- [ ] 5.5.1 Network failure handling
- [ ] 5.5.2 RPC failure handling
- [ ] 5.5.3 Database failure handling
- [ ] 5.5.4 Wallet rejection handling
- [ ] 5.5.5 Timeout handling
- [ ] 5.5.6 Retry logic verification
- [ ] 5.5.7 Circuit breaker test
- [ ] 5.5.8 Error boundary test
- [ ] 5.6.1 Empty state handling
- [ ] 5.6.2 Long content handling
- [ ] 5.6.3 Concurrent vote prevention
- [ ] 5.6.4 Timestamp edge cases
- [ ] 5.6.5 Unicode handling
- [ ] 5.6.6 Special character handling

### Phase 6: Build & Deployment (15 tasks)
- [ ] 6.1.1 Clean build execution
- [ ] 6.1.2 Build completeness check
- [ ] 6.1.3 Asset minification check
- [ ] 6.1.4 Source maps exclusion
- [ ] 6.1.5 Image optimization verification
- [ ] 6.1.6 Chunk size analysis
- [ ] 6.2.1 Environment variables matrix
- [ ] 6.2.2 Production env var validation
- [ ] 6.2.3 Secret scanning check
- [ ] 6.2.4 Config validation
- [ ] 6.3.1 Preview deployment
- [ ] 6.3.2 Production deployment
- [ ] 6.3.3 Rollback procedure
- [ ] 6.3.4 Zero-downtime test
- [ ] 6.4.1 Health check endpoint
- [ ] 6.4.2 Database connectivity
- [ ] 6.4.3 Blockchain connectivity
- [ ] 6.4.4 External service connectivity
- [ ] 6.4.5 Monitoring integration

**Total Tasks**: 165 tasks across 6 phases

---

## Execution Timeline

```
Week 1:
  Day 1-2: Phase 1 - Discovery & Analysis (6h)
  Day 3-5: Phase 2 - Functional Testing (12h)

Week 2:
  Day 6-8: Phase 3 - Security Audit (16h)
  Day 9-10: Phase 4 - Visual Validation (8h)

Week 3:
  Day 11-12: Phase 5 - Performance & Reliability (10h)
  Day 13-14: Phase 6 - Build & Deployment (6h)
  Day 15: Final report + remediation planning (8h)
```

**Total Estimated Effort**: 66 hours (1.9 weeks parallelized, 3 weeks sequential)

---

## Success Criteria Summary

### Phase 1: Discovery & Analysis
- ✓ Complete architecture documentation
- ✓ 100% of features cataloged
- ✓ Zero TypeScript errors
- ✓ Zero high-severity lint warnings
- ✓ Test coverage > 80% for critical paths

### Phase 2: Functional Testing
- ✓ 100% of user journeys pass
- ✓ Zero critical bugs (P0)
- ✓ < 5 high-severity bugs (P1)
- ✓ All error messages user-friendly
- ✓ All loading states handled

### Phase 3: Security Audit
- ✓ All security tests pass
- ✓ Zero critical vulnerabilities
- ✓ < 3 high-severity vulnerabilities
- ✓ All OWASP Top 10 mitigated
- ✓ Audit log 100% complete

### Phase 4: Visual Validation
- ✓ All Core Web Vitals pass
- ✓ All tested browsers functional
- ✓ WCAG 2.1 AA compliant
- ✓ Zero visual regressions
- ✓ All responsive breakpoints working

### Phase 5: Performance & Reliability
- ✓ P95 latency < 500ms for GET
- ✓ P95 latency < 1000ms for POST
- ✓ Zero 5xx errors at normal load
- ✓ Graceful degradation at 2x load
- ✓ All error cases handled

### Phase 6: Build & Deployment
- ✓ Production build completes
- ✓ All environment variables set
- ✓ Health checks pass
- ✓ Zero deployment errors
- ✓ Rollback procedure tested

---

## Deliverables

1. **Architecture Map** (`architecture-map.md`)
2. **Feature Catalog** (`feature-catalog.md`)
3. **Code Quality Report** (`code-quality-report.md`)
4. **Test Results** (`test-results.json`)
5. **Security Audit Report** (`security-audit-report.md`)
6. **Visual Regression Report** (`visual-regression-report.md`)
7. **Performance Report** (`performance-report.md`)
8. **Deployment Validation Report** (`deployment-report.md`)
9. **Final Audit Summary** (`FINAL_AUDIT_REPORT.md`)
10. **Remediation Roadmap** (`remediation-roadmap.md`)

---

## Agent Allocation Summary

| Phase | Primary Agent | Support Agent | Parallelization |
|-------|--------------|---------------|-----------------|
| 1. Discovery & Analysis | `backend-architect` + `Explore` | None | Parallel |
| 2. Functional Testing | `qa-debugger` | `agent-browser` | Sequential |
| 3. Security Audit | `security-auditor` | `backend-architect` | Partial Parallel |
| 4. Visual Validation | `ui-ux-expert` | `agent-browser` | Partial Parallel |
| 5. Performance & Reliability | `qa-debugger` | `backend-architect` | Partial Parallel |
| 6. Build & Deployment | `devops-engineer` | `backend-architect` | Sequential |

---

## Risk Assessment

**High Risk Areas**:
1. **Voting System Integrity** - Critical for trust
2. **Smart Contract Integration** - Irreversible on-chain actions
3. **Session Management** - Unauthorized access risk
4. **Database Performance** - Scalability bottleneck
5. **RPC Endpoint Reliability** - Single point of failure

**Mitigation Strategies**:
- Comprehensive security audit (Phase 3)
- Load testing at 2x expected capacity (Phase 5)
- Multiple RPC provider fallbacks
- Database query optimization + indexing
- Session timeout + strict cookie security

---

## Post-Audit Remediation Process

1. **Prioritize findings** by severity (Critical → High → Medium → Low)
2. **Assign ownership** for each finding
3. **Estimate effort** for each fix
4. **Create sprint plan** with 2-week iterations
5. **Verify fixes** with regression tests
6. **Re-run audit phases** for critical fixes
7. **Sign-off** from security lead before production

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Adjust timeline/scope** as needed
3. **Set up tracking** (GitHub Projects/Jira)
4. **Begin Phase 1** - Discovery & Analysis
5. **Daily standups** to track progress
6. **Weekly reviews** to adjust plan
7. **Final presentation** of findings

**Audit Start Date**: TBD  
**Target Completion**: TBD  
**Audit Lead**: TBD  
**Stakeholder Review**: Required before execution