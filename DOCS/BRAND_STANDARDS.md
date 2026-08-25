# $OMNOM DAO — Brand Standards

> **ULTIMATE source of truth** for the $OMNOM DAO brand identity, color system, typography, dark theme architecture, component patterns, and design guidelines. This document supersedes all prior design references.

**Version:** 1.0.0
**Last updated:** 2026-06-26
**Theme:** Dark-only (no light mode in v1)
**Status:** Canonical — all UI work must conform to this document

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Dark Theme Architecture](#4-dark-theme-architecture)
5. [Icon System](#5-icon-system)
6. [Component Design Patterns](#6-component-design-patterns)
7. [Animation Guidelines](#7-animation-guidelines)
8. [Accessibility](#8-accessibility)
9. [Responsive Breakpoints](#9-responsive-breakpoints)
10. [Holder Class Brand System](#10-holder-class-brand-system)

---

## 1. Brand Identity

### Logo

| Element | Detail |
|---------|--------|
| **Icon** | 🐶 Dog icon via `lucide-react` `<Dog />` component |
| **Wordmark** | `$OMNOM DAO` — always lowercase `$`, uppercase `OMNOM`, space, uppercase `DAO` |
| **Wordmark gradient** | `bg-gradient-to-r from-gold to-purple bg-clip-text text-transparent` |
| **Icon color** | `text-gold` (`#FFD700`) |
| **Logo sizing (header)** | `h-7 w-7` icon, `text-lg font-bold tracking-tight` wordmark |
| **Logo sizing (footer)** | `h-6 w-6` icon |

### Tagline

> **Community Governance** — Off-chain, snapshot-based governance for $OMNOM token holders.

### Brand Voice

- **Approachable but credible** — friendly community tone with serious governance underpinning
- **Transparent** — snapshot data, provenance, and block numbers are always visible
- **Playful identity, serious mechanics** — the dog mascot and 🐋🐬🐟 holder classes add personality; voting power is strictly balance-weighted (1 token = 1 vote)

### Naming Conventions

- **Token:** `$OMNOM` (always with `$` prefix in display text)
- **Chain:** Dogechain (Snapshot) — frozen, snapshot-only
- **Snapshot date:** June 7, 2026

---

## 2. Color System

Defined as CSS custom properties in `@theme` in [`globals.css`](src/app/globals.css:12) and mapped to semantic Tailwind v4 tokens.

### Brand Colors

| Token | Hex | CSS Variable | Tailwind Class | Usage |
|-------|-----|-------------|----------------|-------|
| **Gold** | `#FFD700` | `--color-gold` | `gold` / `text-gold` / `bg-gold` | Primary brand — CTAs, accents, logo, active states |
| **Gold Hover** | `#E6C200` | `--color-gold-hover` | `gold-hover` | Hover state for gold buttons |
| **Purple** | `#8B5CF6` | `--color-purple` | `purple` / `text-purple` / `bg-purple` | Secondary brand — gradients, hover accents, secondary CTAs |

### Surface Colors (Dark Theme Layers)

| Token | Hex | CSS Variable | Tailwind Class | Usage |
|-------|-----|-------------|----------------|-------|
| **BG Deep** | `#000000` | `--color-bg-deep` | `bg-bg-deep` | Page background (true black, deepest layer) |
| **BG Surface** | `#0A0A0A` | `--color-bg-surface` | `bg-bg-surface` | Cards, panels, primary surfaces (rich off-black) |
| **BG Elevated** | `#141414` | `--color-bg-elevated` | `bg-bg-elevated` | Hovered cards, dropdowns, inputs |
| **Border** | `#262626` | `--color-border` | `border-border` (default) | All borders, dividers (WCAG-visible separation on true black) |

### Text Colors

| Token | Hex | CSS Variable | Tailwind Class | Usage |
|-------|-----|-------------|----------------|-------|
| **Text Primary** | `#FAFAFA` | `--color-text-primary` | `text-foreground` | Headings, primary body text |
| **Text Secondary** | `#A1A1AA` | `--color-text-muted` | `text-muted-foreground` | Secondary text, descriptions |
| **Text Muted** | `#8B8B96` | `--color-text-dim` | `text-text-dim` | Tertiary text, timestamps, meta (WCAG AA on all layers) |

### Status / Semantic Colors

| Token | Hex | CSS Variable | Tailwind Class | Usage |
|-------|-----|-------------|----------------|-------|
| **Success** | `#10B981` | `--color-success` | `success` / `text-success` | Passed proposals, verified, confirmed |
| **Danger** | `#EF4444` | `--color-danger` | `danger` / `destructive` | Failed proposals, errors, destructive actions |
| **Warning** | `#F59E0B` | `--color-warning` | `warning` / `text-warning` | Pending review, caution, expiry warnings |

### shadcn/ui Semantic Mapping

```css
--color-background: var(--color-bg-deep);
--color-foreground: var(--color-text-primary);
--color-card: var(--color-bg-surface);
--color-card-foreground: var(--color-text-primary);
--color-popover: var(--color-bg-surface);
--color-popover-foreground: var(--color-text-primary);
--color-primary: var(--color-gold);
--color-primary-foreground: var(--color-bg-deep);
--color-secondary: var(--color-purple);
--color-secondary-foreground: var(--color-text-primary);
--color-muted: var(--color-bg-elevated);
--color-muted-foreground: var(--color-text-muted);
--color-accent: var(--color-bg-elevated);
--color-accent-foreground: var(--color-text-primary);
--color-destructive: var(--color-danger);
--color-destructive-foreground: var(--color-text-primary);
--color-input: var(--color-bg-elevated);
--color-ring: var(--color-gold);
```

### Gradient Usage

| Context | Classes |
|---------|---------|
| Hero heading | `bg-gradient-to-r from-gold via-gold to-purple bg-clip-text text-transparent` |
| Wordmark | `bg-gradient-to-r from-gold to-purple bg-clip-text text-transparent` |
| CTA cards | `from-purple/15 via-bg-surface to-bg-surface` |
| Icon backgrounds | `bg-gradient-to-br from-gold/20 to-purple/20` |
| Holder avatar ring | `bg-gradient-to-br from-purple/25 to-gold/20` |
| Ambient glow | `bg-gold/10 blur-[120px]` or `bg-purple/20 blur-[100px]` |

### Color Rules

1. **Never use raw hex codes in JSX** — always use Tailwind classes or CSS variables
2. **Gold is reserved for primary actions** — CTAs, active nav, logos, focus rings
3. **Purple is for secondary/decorative** — gradients, borders, hover accents
4. **No `bg-white`, `text-black`, or light-gray utility classes** anywhere in the codebase
5. **Opacity modifiers** are used for subtle effects: `bg-gold/10`, `text-purple/80`, `border-border/50`

---

## 3. Typography

### Font Families

| Role | Font | CSS Variable | Tailwind Class |
|------|------|-------------|----------------|
| **Sans (primary)** | Inter | `--font-inter` → `--font-sans` | `font-sans` (default) |
| **Mono** | JetBrains Mono | `--font-jetbrains-mono` → `--font-mono` | `font-mono` |

Loaded via `next/font/google` in [`layout.tsx`](src/app/layout.tsx:12) with `display: "swap"` and `subsets: ["latin"]`.

### Type Scale (Tailwind v4)

| Level | Classes | Usage |
|-------|---------|-------|
| **Display** | `text-4xl font-bold tracking-tight sm:text-5xl` | Hero headline (homepage) |
| **H1** | `text-3xl font-bold tracking-tight` | Page titles (settings, dashboard) |
| **H2** | `text-2xl font-bold` | Section headers |
| **H3** | `text-xl font-bold` | Card titles, subsections |
| **Card title** | `text-base font-semibold` | `<CardTitle>` default |
| **Body** | `text-sm` | Default body text, paragraphs |
| **Body large** | `text-base` | Important descriptions |
| **Caption** | `text-xs text-text-dim` | Timestamps, metadata, counters |
| **Mono data** | `font-mono text-xs` | Addresses, balances, block numbers |

### Font Weight Scale

| Weight | Tailwind | Usage |
|--------|----------|-------|
| 400 (Regular) | `font-normal` | Body text |
| 500 (Medium) | `font-medium` | Nav links, labels |
| 600 (Semibold) | `font-semibold` | Card titles |
| 700 (Bold) | `font-bold` | Headings, wordmark, buttons |

### Text Color Hierarchy

- **Primary:** `text-foreground` — headings, important content
- **Muted:** `text-muted-foreground` — descriptions, secondary content
- **Dim:** `text-text-dim` — timestamps, counters, meta info
- **Brand accent:** `text-gold` or `text-purple` — highlights, links, brand emphasis

---

## 4. Dark Theme Architecture

### Design Philosophy

OMNOM DAO is **dark-only** in v1. There is no light mode toggle, no `prefers-color-scheme: light` override, and no light variant of any component. The `dark` class is permanently applied to the `<html>` element.

### Layering System (z-hierarchy)

```
┌─────────────────────────────────────────────┐
│  BG Deep (#000000)        ← body, main bg    │  Layer 0: Page
├─────────────────────────────────────────────┤
│  BG Surface (#0A0A0A)     ← cards, panels     │  Layer 1: Surfaces
├─────────────────────────────────────────────┤
│  BG Elevated (#141414)    ← hover, dropdowns  │  Layer 2: Interactive
├─────────────────────────────────────────────┤
│  Gold/Purple accents      ← CTAs, focus       │  Layer 3: Brand accent
├─────────────────────────────────────────────┤
│  Ambient glow (blur)      ← decorative        │  Layer 4: Atmosphere
└─────────────────────────────────────────────┘
```

### Root Configuration

| Property | Value | Location |
|----------|-------|----------|
| `color-scheme` | `dark` | `:root` in globals.css |
| `<html>` class | `dark` | [`layout.tsx`](src/app/layout.tsx:62) |
| `body` bg | `bg-bg-deep` | [`layout.tsx`](src/app/layout.tsx:63) |
| `body` text | `text-foreground` | [`layout.tsx`](src/app/layout.tsx:63) |
| `themeColor` | `#000000` | [`layout.tsx`](src/app/layout.tsx:52) viewport export |

### Ambient Effects

- **Ambient glow blobs:** Large, blurred radial gradients behind hero sections
  - `bg-gold/10 blur-[120px]` — warm gold glow
  - `bg-purple/20 blur-[100px]` — purple accent glow
- **Header backdrop:** `bg-bg-deep/80 backdrop-blur-md` — frosted glass effect
- **Card shimmer:** Skeleton loaders use `.skeleton-shimmer` with a translucent white sweep
- **Pulse glow:** Active voting badges use `.animate-pulse-glow` (green pulsing ring)

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

All animations must gracefully degrade — content remains fully visible without motion.

---

## 5. Icon System

### Icon Library

All icons use **[lucide-react](https://lucide.dev/)** — imported as named components.

### DynamicIcon Component

[`DynamicIcon`](src/components/shared/dynamic-icon.tsx) renders icons by string name, enabling config-driven icon mapping:

```tsx
<DynamicIcon name="BarChart3" className="h-5 w-5" />
```

### Standard Icon Sizes

| Size | Class | Usage |
|------|-------|-------|
| XS | `h-3.5 w-3.5` | Inline nav icons, small accents |
| SM | `h-4 w-4` | Button icons, card headers, inline labels |
| MD | `h-5 w-5` | Feature icons, stat cards |
| LG | `h-6 w-6` | Footer logo |
| XL | `h-7 w-7` | Header logo |
| 2XL | `h-12 w-12` | Empty state icons |

### Key Icon Mappings

| Context | Icon | Usage |
|---------|------|-------|
| Brand/logo | `Dog` | Header, footer |
| Home nav | `Home` | Navigation |
| Proposals nav | `ClipboardList` | Navigation |
| Create nav | `Plus` | Navigation |
| Dashboard nav | `BarChart3` | Navigation |
| Wallet | `Wallet` | Connect buttons, wallet sections |
| Vote | `Vote` | Voting actions |
| Trophy/rank | `Trophy` | Rank display |
| Zap/power | `Zap` | Voting power |
| Lock | `Lock` | Auth required states |
| Bell | `Bell` | Notifications |
| Copy | `Copy` | Address copy buttons |

### Icon Rules

1. Always include `aria-hidden` on decorative icons: `<Dog aria-hidden />`
2. Never use emoji for UI icons — use lucide-react components
3. Exception: holder class emojis (🐋🐬🐟) are brand identity (see §10)
4. Icon color inherits from parent `currentColor` unless explicitly set

---

## 6. Component Design Patterns

### Button Variants

Defined in [`button.tsx`](src/components/ui/button.tsx):

| Variant | Visual | Usage |
|---------|--------|-------|
| `default` | Gold bg (`bg-gold`), deep text | Primary CTAs — "Connect Wallet", "Create Proposal", "Submit" |
| `secondary` | Purple-tinted | Secondary actions |
| `outline` | Border + transparent bg | "Cancel", "Browse", secondary navigation |
| `ghost` | Transparent, hover bg | Nav items, icon buttons |
| `destructive` | Red bg (`bg-danger`) | "Delete account", destructive confirmations |
| `link` | Underlined text | Inline links within text |

**Sizes:** `default`, `sm`, `lg`, `icon`

### Button with Link Pattern

```tsx
<Button asChild>
  <Link href="/proposals/create">Create Proposal</Button>
</Link>
```

Always use `asChild` with `<Link>` for navigation buttons (avoids nested `<a>` issues).

### Card Styles

```tsx
<Card className="overflow-hidden">          // surface bg, border, rounded-lg
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="h-4 w-4" /> Title
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* content */}
  </CardContent>
</Card>
```

### Badge Styles

Badges use the `bg-{color}/15 text-{color}-300 border-{color}-600/40` pattern:

```tsx
<span className="bg-emerald-500/15 text-emerald-300 border border-emerald-600/40 rounded-full px-2 py-0.5 text-xs">
  Active
</span>
```

See [`PROPOSAL_STATUS_CONFIG`](src/lib/constants.ts:178) and [`VOTE_CHOICE_CONFIG`](src/lib/constants.ts:244) for all badge variants.

### Form Inputs

```tsx
<Input id="name" placeholder="Enter value" className="bg-bg-elevated" />
<Textarea id="body" rows={6} />
<Select>
  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="opt">Option</SelectItem>
  </SelectContent>
</Select>
```

- Inputs use `bg-bg-elevated` background
- Labels use `<Label htmlFor="id">` paired with input `id`
- Helper text: `<p className="text-xs text-text-dim">`

### Dialog Patterns

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete Account</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete your account?</DialogTitle>
      <DialogDescription>This cannot be undone.</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Empty State Pattern

```tsx
<EmptyState
  icon={<Wallet className="h-12 w-12" />}
  title="Connect your wallet"
  description="Connect and verify your wallet to continue."
  action={<ConnectCta size="lg">Connect Wallet</ConnectCta>}
/>
```

### Loading States

- Use [`<LoadingSkeleton variant="dashboard" />`](src/components/shared/loading-skeleton.tsx) for full-page loading
- Inline loading uses `<Loader2 className="h-4 w-4 animate-spin" />`

---

## 7. Animation Guidelines

### Library

**[framer-motion](https://www.framer.com/motion/)** is the animation library.

### Standard Entrance Animation

```tsx
const EASE = [0.22, 1, 0.36, 1] as const;

<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: EASE }}
>
  {/* content */}
</motion.div>
```

### Stagger Pattern

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: index * 0.06, ease: EASE }}
>
```

### Success Animation

```tsx
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.5, ease: EASE }}
>
```

### CSS Keyframe Animations

| Class | Description |
|-------|-------------|
| `.animate-pulse-glow` | Green pulsing ring for active voting badges (2s infinite) |
| `.skeleton-shimmer` | Translucent sweep for skeleton loaders (1.6s infinite) |

### Animation Rules

1. Keep durations short — 0.3s–0.5s for entrances
2. Use the shared `EASE = [0.22, 1, 0.36, 1]` curve for consistency
3. Stagger delays should be `0.05s`–`0.08s` per item
4. Always respect `prefers-reduced-motion` (handled globally in CSS)
5. Page-level animations apply `opacity` + slight `y` translate only — no horizontal movement

---

## 8. Accessibility

### WCAG AA Compliance

All components must meet **WCAG 2.1 Level AA** requirements.

### Focus Indicators

```css
*:focus-visible {
  outline: 2px solid #ffd700;   /* gold focus ring */
  outline-offset: 2px;
  border-radius: 4px;
}
```

- Focus rings are **gold** (`#FFD700`) — always 2px solid with 2px offset
- Non-keyboard focus (`*:focus:not(:focus-visible)`) has no outline

### Skip Link

```tsx
<a href="#main-content" className="skip-link">Skip to content</a>
```

Visually hidden until focused (slides down from top). Links to `<main id="main-content">`.

### Semantic HTML

- Use `<header>`, `<nav>`, `<main>`, `<footer>` landmarks
- `<main id="main-content">` is the skip-link target
- Navigation uses `<nav>` with descriptive content

### Color Contrast

| Pair | Foreground | Background | Ratio | Status |
|------|-----------|------------|-------|--------|
| Primary text | `#FAFAFA` | `#000000` | 20.1:1 | ✅ AAA |
| Muted text | `#A1A1AA` | `#000000` | 8.2:1 | ✅ AAA |
| Muted text | `#A1A1AA` | `#141414` | 7.2:1 | ✅ AAA |
| Dim text | `#8B8B96` | `#000000` | 6.2:1 | ✅ AA (AAA large) |
| Dim text | `#8B8B96` | `#0A0A0A` | 5.8:1 | ✅ AA |
| Dim text | `#8B8B96` | `#141414` | 5.5:1 | ✅ AA |
| Gold on deep | `#FFD700` | `#000000` | 15.0:1 | ✅ AAA |
| Gold on surface | `#FFD700` | `#0A0A0A` | 14.1:1 | ✅ AAA |
| Success | `#10B981` | `#000000` | 8.3:1 | ✅ AAA |
| Danger | `#EF4444` | `#000000` | 5.6:1 | ✅ AA (AAA large) |
| Warning | `#F59E0B` | `#000000` | 9.8:1 | ✅ AAA |

> **Note:** The dim token was raised from `#71717A` → `#8B8B96` after the v1.0.0 audit
> because `#71717A` measured 4.34:1 / 4.10:1 / 3.81:1 on `#000000` / `#0A0A0A` / `#141414`
> respectively — failing WCAG AA (4.5:1) for normal text on every surface layer.

### ARIA Guidelines

1. Decorative icons: `aria-hidden`
2. Interactive icon-only buttons: `aria-label`
3. Status badges: semantic text content (not icon-only)
4. Loading states: use `role="status"` or `aria-busy`
5. Dialogs: managed by Radix UI (auto ARIA)

---

## 9. Responsive Breakpoints

### Mobile-First Approach

All layouts start at mobile (320px) and enhance upward.

### Tailwind Breakpoints

| Prefix | Min-width | Target |
|--------|-----------|--------|
| (default) | 0px | Mobile (320px–639px) |
| `sm:` | 640px | Large phone / small tablet |
| `md:` | 768px | Tablet (nav appears, bottom nav hides) |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |

### Layout Patterns

**Max-width containers:**

| Context | Max width | Classes |
|---------|-----------|---------|
| Default page | `max-w-7xl` (80rem) | `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` |
| Dashboard | `max-w-6xl` | `mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8` |
| Settings/form | `max-w-3xl` | `mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8` |
| Centered narrow | `max-w-xl` | `mx-auto max-w-xl px-4 py-16 sm:px-6` |

### Navigation Behavior

- **Desktop (`md+`):** Full nav bar in header — Home, Proposals, Create, Dashboard
- **Mobile (`< md`):** Bottom navigation bar ([`bottom-nav.tsx`](src/components/layout/bottom-nav.tsx)) — condensed nav + wallet button
- **Footer:** Always visible, same nav links as header

### Grid System

```tsx
// 3-column stats on desktop, 1-column mobile
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

// 2-column content on large screens
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
```

### Safe Area

- `html` and `body` have `overflow-x: hidden; max-width: 100vw` to prevent horizontal scroll
- Content wrapper uses `overflow-x-hidden` and `max-w-full`

---

## 10. Holder Class Brand System

The holder class system is core brand identity — the **only** emojis retained in the UI (all other UI uses lucide-react icons).

### Classes

| Class | Emoji | Threshold | Color | Badge Class |
|-------|-------|-----------|-------|-------------|
| **Whale** 🐋 | 🐋 | ≥ 1.0% of supply | Amber | `text-amber-400` |
| **Dolphin** 🐬 | 🐬 | ≥ 0.01% of supply | Sky blue | `text-sky-400` |
| **Fish** 🐟 | 🐟 | All others | Slate | `text-slate-400` |

### Configuration

Defined in [`HOLDER_CLASS_CONFIG`](src/lib/constants.ts:64) and classified by [`classifyHolder()`](src/lib/constants.ts:89):

```typescript
export const HOLDER_CLASS_CONFIG: Record<HolderClass, HolderClassConfig> = {
  WHALE:   { label: "Whale",   emoji: "🐋", threshold: 1.0,  colorClass: "text-amber-400" },
  DOLPHIN: { label: "Dolphin", emoji: "🐬", threshold: 0.01, colorClass: "text-sky-400" },
  FISH:    { label: "Fish",    emoji: "🐟", threshold: 0,    colorClass: "text-slate-400" },
};
```

### Distribution (June 7, 2026 Snapshot)

| Class | Count |
|-------|-------|
| Whales | 4 |
| Dolphins | 322 |
| Fish | 25,105 |
| **Total** | **25,431** |

### Usage Rules

1. Holder emojis appear in: profile cards, dashboard, settings, comments, proposal author badges
2. The [`<HolderBadge>`](src/components/shared/holder-badge.tsx) component renders the class label + emoji consistently
3. Avatar circles use gradient backgrounds: `bg-gradient-to-br from-purple/25 to-gold/20`
4. Classification is **cosmetic only** — voting power is strictly balance-weighted (1 token = 1 vote)

---

## Appendix: File References

| Resource | Path |
|----------|------|
| Global CSS | [`src/app/globals.css`](src/app/globals.css) |
| Root layout | [`src/app/layout.tsx`](src/app/layout.tsx) |
| Constants/Config | [`src/lib/constants.ts`](src/lib/constants.ts) |
| Site header | [`src/components/layout/site-header.tsx`](src/components/layout/site-header.tsx) |
| Site footer | [`src/components/layout/site-footer.tsx`](src/components/layout/site-footer.tsx) |
| Button component | [`src/components/ui/button.tsx`](src/components/ui/button.tsx) |
| Card component | [`src/components/ui/card.tsx`](src/components/ui/card.tsx) |
| Holder badge | [`src/components/shared/holder-badge.tsx`](src/components/shared/holder-badge.tsx) |
| DynamicIcon | [`src/components/shared/dynamic-icon.tsx`](src/components/shared/dynamic-icon.tsx) |
| ConnectCta | [`src/components/wallet/connect-cta.tsx`](src/components/wallet/connect-cta.tsx) |
| EmptyState | [`src/components/shared/empty-state.tsx`](src/components/shared/empty-state.tsx) |
| LoadingSkeleton | [`src/components/shared/loading-skeleton.tsx`](src/components/shared/loading-skeleton.tsx) |
