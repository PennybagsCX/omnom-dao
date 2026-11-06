# OMNOM DAO — Prioritized Next Steps (2026-11-03)

> Written as part of the Nov 3 staleness pass (card t_e5b04016). Sources:
> STATUS.md, ROADMAP.md, DOCS/GOVERNANCE-NEXT.md, DOCS/REFERENDUM-WAVE1.md,
> plus the Nov 3 dependency refresh. P0 items are owner-gated; P1+ are dev lanes.

## P0 — Owner actions (blocking the governance loop)

1. **Wave 1 Referendum outcome** — window closed 2026-11-01 00:00 UTC:
   - Run `npm run verify:referendum` (green gate before anything public).
   - Decide per-question: record outcome vs `adopt-consensus` fallback
     (guardrails shipped: intent declaration + 24h cooling-off + 60%/100-voter
     override path — audited either way).
   - ~~Reject the 2 superseded "Governance parameter: …" rows at `/admin`.~~
     **Done before close** — verified 2026-11-03 via the public API: both rows
     are FAILED with `rejectedAt`/`rejectedBy`/`rejectionReason` metadata.
   - Publish the matching results copy-pack variant
     (`DOCS/announcements/referendum-wave1.md` has both quorum-reached and
     consensus-fallback versions).
   - Queue review (verified 2026-11-03): 5 PENDING_REVIEW community rows are
     waiting, including **two duplicate** "Establish a Joint OMNOM & DOGE
     Marketing & Liquidity Fund" submissions — owner call on each.
2. **Turnout reality check** — every vote to date has missed the 5% quorum
   floor (FGE peak 2.73%; Week 1 1.73%). Before Wave 2: a turnout plan
   (announcement cadence, holder outreach, possibly lowering the floor via the
   fallback rule now that it has a ratification path).

## P1 — Near-term development (small, safe, high-value)

1. **Reduced-motion a11y gap** — framer-motion entrances bypass the CSS
   `prefers-reduced-motion` kill-switch. Wrap the app in
   `<MotionConfig reducedMotion="user">` or gate entrances with
   `useReducedMotion()`. (Carried on STATUS.md; systemic, ~half a day.)
2. **Quorum display parity** — detail pages show "0.00% / N%" on live
   proposals (`quorumAchieved ?? 0` fallback); the /vote card already handles
   this state better. Port that behavior to the detail page.
3. **Seed-script concurrency guard** — idempotent per run, no two-run lock.
   Low risk, cheap: flock or a marker row.
4. **Dependency pin note** — `@x402/svm` is pinned exact at `2.23.0`
   (2026-11-03): `2.29.0` requires `@solana/kit >=8` while the tree installs
   5.5.1, which broke `next build` with 22 module errors. Revisit only as a
   coordinated bump of `@x402/svm` + `@solana/kit` together, with a build
   gate.

## P2 — Wave 2 preparation (process & access questions, GOVERNANCE-NEXT #4/#6/#10)

1. Draft the three Wave 2 GENERAL proposals (seed script supports
   `--wave 2`), staged as PENDING_REVIEW.
2. Update the announcement pack for Wave 2 (copy patterns exist).
3. DogeOS chain-selection research memo (public testnet 2026-09-30; EVM +
   DOGE gas match this stack) — feeds the later Chain Selection vote.

## P3 — Backlog

- Push notification channels (email/Telegram) — revisit only if turnout
  justifies the complexity.
- Vercel Hobby daily-cron cap — the GitHub Actions 30-min pinger covers it;
  revisit on a paid plan.
- `/faq` and `/privacy` pages have no test references (only routes without
  any coverage mention) — static content, add smoke specs opportunistically.

## Done in the 2026-11-03 staleness pass (this card)

- Docs: README status line, ROADMAP referendum line, STATUS.md dated addendum
  + supersede marker on a stale pre-referendum line (all reflecting the
  Nov 1 close; no history rewritten).
- Deps: in-range refresh via `npm update`; `@x402/svm` pinned exact at
  `2.23.0` after `2.29.0` broke the build (see P1.4).
- Gates after changes: lint 0 problems · typecheck clean · vitest
  **781/781** · `next build` ✓ (44 pages) · e2e suite (see card for the
  final count).
