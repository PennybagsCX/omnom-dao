# $OMNOM DAO — Implementation Roadmap

> Phased development plan for the $OMNOM DAO Governance Platform.
> Target: Open-source, low-cost, community-driven governance for 25,431 token holders.

---

## Timeline Overview

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
      │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
P0:   ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Foundation
P1:   ░░░░░░░░░░████████████████░░░░░░░░░░░░░░░░░░░░░  MVP
P2:   ░░░░░░░░░░░░░░░░░░░░░░░░░████████████████░░░░░░░  Govern
P3:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████████  Engage
P4:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  Scale
```

---

## Phase 0: Foundation (Week 1-2)

**Duration:** 2 weeks
**Team:** 1 developer (full-time)
**Dependencies:** None

### Goals
- Project scaffolding and tooling
- Snapshot data processing and optimization
- Design system establishment
- CI/CD pipeline

### Tasks

**Week 1: Setup & Data**
- Initialize Next.js 15 project with TypeScript, Tailwind CSS, shadcn/ui
- Configure RainbowKit + wagmi v3 + viem
- Process snapshot CSV → optimized JSON:
  - Convert to sorted array for binary search
  - Generate SHA-256 hash for immutability proof
  - Create address → holder lookup index
- Set up Turso SQLite database (proposals, votes, users tables)
- Configure Vercel deployment with preview environments
- Set up GitHub repo with branch protection

**Week 2: Design System & Infrastructure**
- Implement OMNOM design tokens (colors, typography, spacing)
- Build core components: Button, Card, Badge, Modal, Input, Toggle
- Create layout components: Navbar, Sidebar, Footer, PageContainer
- Implement dark theme (default)
- Set up ESLint + Prettier + TypeScript strict mode
- Configure environment variables (.env.local pattern)
- Implement basic error boundary and loading states

### Deliverables
- ✅ Staging site deployed to Vercel with design system
- ✅ Snapshot data loaded and queryable (<10ms lookup)
- ✅ Database schema created with migrations
- ✅ CI/CD: push to main → auto-deploy

### Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Snapshot CSV parsing errors | High | Validate against Blockscout archive, compare holder counts |
| Design system too complex | Medium | Start with shadcn/ui defaults, customize incrementally |

### Success Criteria
- `npm run build` succeeds in <60s
- Snapshot lookup returns results in <10ms
- Staging site accessible at preview URL
- All linting/type checks pass

---

## Phase 1: MVP — Verify & View (Week 3-5)

**Duration:** 3 weeks
**Team:** 1 developer (full-time)
**Dependencies:** Phase 0 complete

### Goals
- Holders can connect wallets and verify against snapshot
- Holder dashboard shows balance, rank, class, voting power
- Admin can create proposals (no user creation yet)
- Proposals are viewable with basic voting display

### Tasks

**Week 3: Wallet Connection & Verification**
- Implement RainbowKit wallet modal with OMNOM branding
- Build SIWE (Sign-In with Ethereum) flow:
  - Generate nonce + timestamp on frontend
  - Request wallet signature
  - POST to `/api/verify` endpoint
  - Backend: ecrecover → validate → snapshot lookup
  - Return holder data or "not found"
- Build verification success page (balance, rank, class badge)
- Build verification failure page (not found, error states)
- Implement JWT session management (httpOnly cookie, 7-day expiry)
- Handle edge cases: rejected signature, slow hardware wallet, network errors

**Week 4: Holder Dashboard & Proposal Display**
- Build holder dashboard page (stats cards, profile card)
- Implement Turso SQLite schema for proposals (admin-only for now)
- Build admin proposal creation script/CLI (bypasses UI)
- Build proposals list page with status filters
- Build proposal detail page (description, vote display, timeline)
- Implement responsive layouts (desktop sidebar → mobile bottom nav)
- Add skeleton loading states for all pages

**Week 5: Polish & Testing**
- Mobile responsive testing (iOS Safari, Chrome Android)
- Error handling for all edge cases
- Add "Not Found" help flow (Blockscout link, Telegram link)
- Performance optimization: snapshot data in memory, ISR for proposal pages
- Write integration tests: wallet connect → verify → dashboard flow
- Deploy to staging for community testing

### Deliverables
- ✅ Holders can connect wallet and verify holdings
- ✅ Dashboard shows balance, rank, class, voting power
- ✅ 3 admin-created test proposals viewable
- ✅ Mobile-responsive on all major devices

### Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| SIWE complexity on RainbowKit | Medium | Use siwe package, test with MetaMask + WalletConnect |
| Mobile wallet connection issues | High | Test early with WalletConnect on iOS/Android |
| Snapshot hash mismatch | Low | Verify against 3 sources (CSV, Blockscout, community archive) |

### Success Criteria
- 5+ community members successfully verify wallets on staging
- Page load < 3s on 3G mobile connection
- Zero critical errors during 24h soak test

---

## Phase 2: Govern — Propose & Vote (Week 6-9)

**Duration:** 4 weeks
**Team:** 1-2 developers
**Dependencies:** Phase 1 complete, Turso database configured

### Goals
- Full governance loop: create proposals, discuss, vote, see results
- Real-time vote counting
- Anti-double-voting enforcement
- Comment/discussion system

### Tasks

**Week 6-7: Proposal Creation**
- Build multi-step proposal creation form (4 steps: Type → Content → Parameters → Review)
- Integrate Markdown editor with preview (TipTap or Milkdown)
- Proposal types: Chain Selection, Tokenomics, Treasury, Guidelines, Technical, General
- Quorum configuration: slider with real-time supply % display
- Voting period options: 24h, 72h, 7d, 14d, 30d
- Proposal templates per type
- Input validation and error handling
- Draft saving (auto-save to localStorage)

**Week 8: Voting System**
- Build vote casting flow (FOR / AGAINST / ABSTAIN)
- Prevent double-voting: UNIQUE constraint on (proposalId, voterAddress)
- Real-time vote counting: WebSocket or polling (5s interval)
- Vote result calculation when voting period ends
- Quorum validation (must meet % threshold for binding result)
- Vote history in user dashboard
- Voter list on proposal detail page

**Week 9: Comments & Polish**
- Basic comment system (flat, no threading for MVP)
- Proposal status transitions: Draft → Pending → Active → Closed → Passed/Failed
- Automated status updates (cron job checks voting periods)
- Proposal search and advanced filtering
- Notification settings page (preparation for Phase 3)
- End-to-end testing: create → vote → result

### Deliverables
- ✅ Any verified holder can create proposals
- ✅ Voting with real-time counting
- ✅ Comment system functional
- ✅ Proposal lifecycle automated
- ✅ First community proposal created and voted on

### Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Double-voting exploit | Critical | Database constraint + API-level check + frontend disable |
| Real-time performance under load | Medium | Use Turso's read replica for vote queries, cache aggressively |
| Spam proposals | Medium | Rate limit (3/week), minimum balance to create (optional) |

### Success Criteria
- First community proposal receives 50+ votes
- Zero double-voting incidents
- Vote counts update within 10s of casting

---

## Phase 3: Engage — Notify & Connect (Week 10-12)

**Duration:** 3 weeks
**Team:** 1-2 developers
**Dependencies:** Phase 2 complete

### Goals
- Notifications drive engagement (email + Telegram)
- Users can set display names and manage profiles
- Vote delegation for inactive holders

### Tasks

**Week 10: Email Notifications**
- Integrate Resend for transactional emails
- Notification types: proposal created, voting started, ending soon (24h), result
- Email preference management in settings
- Unsubscribe link in all emails
- Email templates with OMNOM branding

**Week 11: Telegram Integration**
- Deep linking: proposal URLs open in Telegram with preview card
- Bot notifications: @DBOT_DC_BOT sends alerts to OMNOM group
- "Vote on this proposal" → opens web app with wallet connect
- Telegram login option (optional identity)

**Week 12: Profiles & Delegation**
- Display name field (no PII required)
- Public profile page showing voting history
- Vote delegation: holders can assign voting power to trusted addresses
- Delegation dashboard: see who delegated to you, total delegated power
- Revoke delegation at any time

### Deliverables
- ✅ Email notifications for all proposal events
- ✅ Telegram deep links working
- ✅ User profiles with display names
- ✅ Vote delegation functional

### Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Email spam complaints | Medium | Clear unsubscribe, respect preferences, use Resend reputation |
| Telegram API limits | Low | Rate limit bot messages, batch notifications |

### Success Criteria
- Email open rate > 30% for proposal notifications
- 10%+ of voters using delegated voting
- Telegram notification CTR > 5%

---

## Phase 4: Scale — Analytics & Trust (Week 13-16)

**Duration:** 4 weeks
**Team:** 1-2 developers
**Dependencies:** Phase 3 complete

### Goals
- Governance analytics dashboard
- Public snapshot verification page
- Accessibility audit pass
- Performance optimization for 25K+ users

### Tasks

**Week 13-14: Analytics & Verification**
- Governance analytics: turnout trends, holder participation, voting patterns
- Whale vs dolphin vs fish participation breakdown
- Proposal success rate by type
- Public snapshot verification page:
  - Display CSV hash
  - Link to Blockscout archive
  - Allow anyone to verify an address without connecting wallet
  - Trust anchor for community

**Week 15: Accessibility & Performance**
- WCAG 2.1 AA audit (manual + automated with axe-core)
- Fix all accessibility issues
- Bundle optimization: code splitting, lazy loading
- CDN caching for static assets
- Database query optimization
- Load testing: simulate 1,000 concurrent users

**Week 16: Security Audit & Launch Prep**
- Security review: CSP headers, rate limiting, input validation
- Penetration testing (basic: XSS, CSRF, SQL injection)
- Production deployment checklist
- DNS + SSL configuration
- Monitoring setup (Vercel Analytics, error tracking)
- Launch announcement preparation

### Deliverables
- ✅ Analytics dashboard with governance metrics
- ✅ Public snapshot verification page
- ✅ WCAG 2.1 AA compliant
- ✅ Load tested at 1,000 concurrent users
- ✅ Security audit complete

### Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Accessibility regression | Medium | Integrate axe-core in CI, fail on violations |
| Performance under peak voting | High | Pre-compute vote totals, use Turso read replicas |

### Success Criteria
- Lighthouse accessibility score ≥ 95
- Page load < 2s on 4G
- 0 critical security vulnerabilities

---

## Phase 5: Future (Post-Launch)

Long-term features, prioritized by community demand:

| Feature | Description | Priority |
|---|---|---|
| Mobile PWA | Add to home screen, push notifications | High |
| Snapshot v2 | Support for new snapshots if token relaunches | High |
| Tally Integration | Verified on-chain voting for binding decisions | Medium |
| Multi-chain Proposals | Vote on cross-chain deployment | Medium |
| Quadratic Voting | More sophisticated voting mechanism | Medium |
| Delegation Graph | Visualize delegation relationships | Low |
| Governance SDK | API for third-party integrations | Low |
| Open Framework | Export/import proposal templates | Low |

---

## Resource Requirements

### MVP (Phases 0-2): Solo Developer
- 1 full-stack developer (React/Next.js + Node.js)
- 8-10 weeks
- Cost: ~$0 (Vercel free tier, Turso free tier, Resend free tier)

### Full Platform (Phases 0-4): Small Team
- 1 full-stack developer
- 1 part-time designer (Phases 0-1)
- 1 part-time community manager (Phase 2+)
- 16 weeks
- Cost: ~$50-100/month (Vercel Pro, Turso paid, email sending)

### Optional Enhancements
- Smart contract developer (if on-chain voting needed)
- Security auditor (before mainnet launch)
- DevOps engineer (if self-hosting)

---

## Risk Register

| # | Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Snapshot data integrity dispute | Low | Critical | Public CSV hash, Blockscout cross-reference | Lead Dev |
| R2 | Whale dominance of votes | High | Medium | Quadratic voting (v2), delegation | Community |
| R3 | Low voter turnout | Medium | High | Telegram notifications, gamification | PM |
| R4 | Smart contract audit costs | N/A for MVP | N/A | Off-chain voting avoids contracts | Lead Dev |
| R5 | DDoS during active votes | Low | High | Vercel DDoS protection, rate limiting | DevOps |
| R6 | Lost wallet holders | High | Medium | Verification help flow, community support | PM |
| R7 | Mobile wallet UX issues | Medium | Medium | Extensive WalletConnect testing | QA |

---

## Key Milestones

| Date | Milestone | Success Criteria |
|---|---|---|
| Week 2 | Foundation Complete | Staging site live, snapshot loaded |
| Week 5 | MVP Launch | 100+ holders verified on production |
| Week 9 | Governance Live | First community proposal voted on |
| Week 12 | Engagement Launch | Notifications driving 50%+ voter return |
| Week 16 | Production Hardening | Security audit passed, 1K concurrent users |
