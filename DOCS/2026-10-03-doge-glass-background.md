# 2026-10-03 — Binary Doge Background, Glass Design System, Bookmarks, UX Fixes

Session record for the visual overhaul + feature work.

## 1. Binary doge background (all pages)

`src/components/layout/binary-matrix-background.tsx` + `public/doge-matrix.png`

- The doge portrait rendered as flickering 0s/1s (Canvas 2D, one rAF loop),
  fixed behind all content, `pointer-events-none` + `aria-hidden`.
- **Contain-fit**: whole silhouette always visible on every device (never
  cropped); cell size scales with viewport area (~3k glyphs on a phone,
  ~8k at 4K); dpr-aware (capped ×2).
- **Navbar-aware band**: spans the space between the fixed header and bottom
  nav (heights measured from live DOM; BottomNav is `lg:hidden`).
- **Glyph-mass centering**: re-centers on the visible pixel mass, since the
  head is not centered in the source photo.
- **Self-healing loop**: every frame verifies viewport vs built grid and
  rebuilds on mismatch — a missed resize event (rotation, URL-bar race,
  emulation switch) can never leave a stale desktop render on a phone.
- Honors `prefers-reduced-motion` (static frame).
- Opacity via `--doge-opacity` (default 0.2 — user-tuned).

## 2. Glass design system (final, always on)

`src/app/globals.css` — `[data-glass="on"]` set unconditionally by an inline
`<head>` script in `src/app/layout.tsx` (no flash, no toggle).

- **Surfaces** (cards, panels, popovers + opacity variants): transparent fill,
  `blur(4px) saturate(100%)`, outline `color-mix(white 20%, --color-border)`.
  Values are `--glass-*` custom properties (slider-tunable historically).
- **Floating menus** (select/dropdown popovers): own readability floor —
  45% `--color-bg-elevated` fill + same blur/outline — because they float
  over arbitrary content, not the dim background.
- **Winning-choice banner** (/results): same treatments, own fixed
  semi-transparent **yellow** wash (gold at 12%) — keeps its identity.
- Inner chips (`.bg-bg-elevated` badges, vote-bar tracks) keep solid styles.
- Hero gradients removed on Home + FAQ (they darkened the top third over the
  background).
- The Glass/solid toggle and the dev Glass Tuner were **removed** (glass is
  the permanent presentation); `glass-toggle.tsx` / `glass-tuner.tsx` deleted.

## 3. Pill progress bars — outlines site-wide

Every `%`/progress track now has `border border-border` so 0% fills still
read as tracks: `vote-bar.tsx`, `quorum-progress.tsx`, `ui/progress.tsx`
(shared Radix Progress), class-breakdown, results tallies, ballot mini-bars,
create-wizard step segments, admin Operations strips (×2), governance-vote
results (×2).

## 4. Results + vote page tiling

- /results per-choice tallies wrapped in a Card.
- /vote "Current results — Question N" wrapped in a Card.

## 5. Vote page FAQ

- FAQ data extracted to `src/lib/faq-data.ts` (shared: /faq + /vote).
- Referendum FAQ accordion (bottom of /vote) restyled with the FAQ page's
  per-item chip design (bordered rounded items, gold title on open).
- New "Questions about voting?" tile at the end of /vote: 4 voting questions
  + link to all 43.

## 6. "Your ballots cast" stat (/vote)

`src/components/vote/your-ballots-cast.tsx` — third referendum stat now shows
`X / N — Your ballots cast` (X = referendum questions the connected wallet has
a ballot on; reads the same detail queries as the ballot cards, so it updates
on cast/change). Not connected → `0/N`.

## 7. Bookmarked proposals (new feature, v1 client-side)

- `src/lib/bookmarks.ts`: localStorage id store + pub/sub (EventTarget bus,
  cross-tab via `storage`), stable snapshots for `useSyncExternalStore`.
- `src/components/shared/bookmark-button.tsx`: link-safe toggle on every
  ProposalCard tile (gold when active).
- Dashboard "Bookmarked Proposals": renders bookmarked proposals as real
  cards (wallet-gated page); empty state kept for zero bookmarks.
- Tests: `src/__tests__/lib/bookmarks.test.ts` (5 cases — toggle, ordering,
  corrupt storage, subscribers).

## 8. Loading spinner centering

`src/app/loading.tsx`: fills exactly the space between the fixed header and
bottom nav (`100dvh` based, `max-lg`/`lg` split, real 72px nav height), so the
spinner is centered both axes on every device.

## Verification status at close

- `tsc --noEmit` PASS · `eslint src --max-warnings=0` PASS · vitest
  bookmarks 5/5 PASS.
- Browser-verified (desktop + mobile emulation): doge containment/centering
  (pixel-measured), glass tiles, dropdown glass floor, winner banner,
  bookmark toggle + persistence, vote FAQ chips, loading spinner geometry.
- Dashboard bookmark rendering is wallet-gated — code path typechecked but
  not visually confirmed without a connected wallet.

## Final round (same day)

- **Glass made permanent**: the Glass/solid toggle and the dev Glass Tuner
  removed (components deleted); glass is set unconditionally before first
  paint — one presentation for everyone.
- **"Your ballots cast" stat** on /vote: `X / N — Your ballots cast` in the
  referendum stats strip (`src/components/vote/your-ballots-cast.tsx`);
  X = questions the connected wallet has a ballot on; updates live.
- **Pill outlines completed**: admin Operations strips (×2) and
  governance-vote results — every progress track on the site outlined.
- **Stale-render bug fixed**: the animation loop now verifies the viewport
  against the built grid every frame and rebuilds on mismatch — missed
  resize events (rotation, URL-bar races, emulation switches) previously
  left a desktop-sized render sliced on mobile ("the left ear" reports).
- **Debug-instrumentation syntax error** that briefly froze the component's
  dev compile (causing "changes not live" reports) found and fixed by a
  clean rewrite of the component file.
- Docs: this file.

## Known follow-ups

- Bookmarks are per-browser (v1). Server-side sync would need auth scope.
- To re-tune the glass values, adjust the `--glass-*` custom properties
  (defaults in the globals.css "Glass mode" block) or reintroduce a tuner.
- Rollback: `git revert` the feature commit(s), or diff against
  `backup/pre-binary-matrix`.
