# $OMNOM DAO — Design System

> **Source of truth** for all visual design, typography, spacing, components, and theming decisions across the $OMNOM DAO governance platform.

**Version:** 1.0.0  
**Last updated:** 2026-06-26  
**Theme:** Dark-only (no light mode in v1)

---

## Table of Contents

1. [Color Palette](#1-color-palette)
2. [Typography](#2-typography)
3. [Spacing System](#3-spacing-system)
4. [Border Radius](#4-border-radius)
5. [Component Styling Guidelines](#5-component-styling-guidelines)
6. [Dark Theme Specification](#6-dark-theme-specification)
7. [Icon System](#7-icon-system)
8. [Animation Guidelines](#8-animation-guidelines)
9. [Accessibility Requirements](#9-accessibility-requirements)
10. [Responsive Breakpoints](#10-responsive-breakpoints)

---

## 1. Color Palette

The palette is defined as CSS custom properties in `@theme` in [`globals.css`](src/app/globals.css) and mapped to semantic Tailwind v4 tokens.

### Brand Colors

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Gold** | `#FFD700` | `gold` | Primary brand color — CTAs, accents, logo, active states |
| **Gold Hover** | `#E6C200` | `gold-hover` | Hover state for gold elements |
| **Purple** | `#8B5CF6` | `purple` | Secondary brand — gradients, borders, hover accents |

> **Purple contrast constraint.** `#8B5CF6` on `--color-bg-elevated #141414` measures 4.35:1, which **fails** WCAG AA (4.5:1) for normal text. Purple is therefore approved for **gradients, borders, icon backgrounds, and ambient glows only** — never as standalone body text on any surface layer. Use `text-gold` or `text-foreground` for text that needs a brand accent.

### Surface Colors (Dark Theme Layers)

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **BG Deep** | `#000000` | `bg-deep` | Page background (true black, deepest layer) |
| **BG Surface** | `#0A0A0A` | `bg-surface` | Cards, panels, primary surfaces (rich off-black) |
| **BG Elevated** | `#141414` | `bg-elevated` | Hovered cards, dropdowns, elevated elements |
| **Border** | `#262626` | `border` (default) | All borders, dividers |

### Text Colors

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Text Primary** | `#FAFAFA` | `foreground` | Headings, primary body text |
| **Text Secondary** | `#A1A1AA` | `muted-foreground` | Secondary text, descriptions |
| **Text Muted** | `#8B8B96` | `text-dim` | Tertiary text, timestamps, meta info |

### Status / Semantic Colors

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| **Success** | `#10B981` | `success` | Passed proposals, verified states |
| **Danger** | `#EF4444` | `danger` / `destructive` | Failed proposals, errors, destructive actions |
| **Warning** | `#F59E0B` | `warning` | Pending states, caution |

### shadcn/ui Semantic Mapping

These map the brand colors to shadcn/ui's expected tokens:

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

- **Hero heading:** `from-gold via-gold to-purple` (text gradient)
- **CTA cards:** `from-purple/15 via-bg-surface to-bg-surface`
- **Icon backgrounds:** `from-gold/20 to-purple/20`
- **Ambient glow:** `bg-gold/10 blur-[120px]` or `bg-purple/20`

---

## 2. Typography

### Font Families

| Role | Font | CSS Variable | Tailwind Class |
|------|------|--------------|----------------|
| **Body / UI** | Inter | `--font-inter` | `font-sans` |
| **Code / Mono** | JetBrains Mono | `--font-jetbrains-mono` | `font-mono` |

Both loaded via `next/font/google` with `display: swap` for optimal loading.

### Type Scale

| Level | Classes | Usage |
|-------|---------|-------|
| **Hero** | `text-4xl sm:text-6xl font-extrabold tracking-tight` | Landing page H1 |
| **H1** | `text-2xl sm:text-3xl font-bold` | Page titles |
| **H2** | `text-xl sm:text-2xl font-bold` | Section headings |
| **H3** | `text-lg font-semibold` | Card titles, subsections |
| **Body** | `text-base` or `text-sm` | Default body text |
| **Body Large** | `text-base sm:text-xl` | Hero descriptions |
| **Caption** | `text-xs` | Eyebrow labels, timestamps, meta |
| **Eyebrow** | `text-xs font-medium uppercase tracking-widest text-gold/80` | Section pre-titles |

### Font Weights

- `font-medium` (500) — Buttons, nav items
- `font-semibold` (600) — Card titles, subsections
- `font-bold` (700) — Headings, section titles
- `font-extrabold` (800) — Hero text only

### Line Heights

- Default: `leading-normal` (1.5) for body text
- `leading-snug` (1.375) for card titles
- `leading-tight` (1.25) for large headings

---

## 3. Spacing System

Uses Tailwind's default 4px-base scale:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` / `p-1` | 4px | Icon gaps, tight spacing |
| `gap-2` / `p-2` | 8px | Badge padding, small gaps |
| `gap-3` / `p-3` | 12px | Card internal spacing |
| `gap-4` / `p-4` | 16px | Standard spacing |
| `gap-5` / `p-5` | 20px | Card padding (default) |
| `gap-6` / `p-6` | 24px | Section spacing |
| `gap-8` | 32px | Large section gaps |
| `pb-16` / `pb-20` | 64–80px | Section bottom padding |
| `pb-24` | 96px | Footer CTA bottom |

### Container Max-Widths

- `max-w-4xl` (896px) — Hero, centered text sections
- `max-w-5xl` (1024px) — Standard content sections
- `max-w-7xl` (1280px) — Full-width header/footer
- `max-w-md` (448px) — Dialogs, modals

---

## 4. Border Radius

| Token | Value | Tailwind Class | Usage |
|-------|-------|----------------|-------|
| **SM** | `0.375rem` (6px) | `rounded-sm` | Badges, small chips |
| **MD** | `0.5rem` (8px) | `rounded-md` / `rounded-lg` | Buttons, inputs |
| **LG** | `0.75rem` (12px) | `rounded-xl` | Cards |
| **XL** | `1rem` (16px) | `rounded-2xl` | Hero CTAs, large panels |
| **Full** | `9999px` | `rounded-full` | Pills, avatars, icon badges |

---

## 5. Component Styling Guidelines

### Buttons

| Variant | Classes | Usage |
|---------|---------|-------|
| **Primary** | `bg-primary text-primary-foreground` (gold on dark) | Main CTAs |
| **Outline** | `border border-border bg-transparent hover:bg-accent` | Secondary actions |
| **Ghost** | `hover:bg-accent hover:text-accent-foreground` | Tertiary actions |
| **Destructive** | `bg-destructive text-destructive-foreground` | Delete, disconnect |

Sizes: `sm`, `default`, `lg`, `icon`

### Cards

```tsx
<Card className="transition-all duration-200 hover:border-purple/50 hover:shadow-lg hover:shadow-purple/5">
```

- Background: `bg-bg-surface` (via `--color-card`)
- Border: `border` (defaults to `--color-border`)
- Padding: `p-5` (CardContent)
- Hover: `border-purple/50` + subtle purple glow shadow

### Badges

- Status badges use colored opacity backgrounds: `bg-success/15 border-success/40`
- Type badges use muted backgrounds: `bg-bg-elevated text-muted-foreground`
- Active state pulse: `.animate-pulse-glow` class

### Inputs

- Background: `bg-bg-elevated` (via `--color-input`)
- Focus ring: `ring-gold` (via `--color-ring`)
- Border: `border-border`

### Dialogs

- Max width: `max-w-md` for standard dialogs
- Padding: `p-0` on DialogContent with custom internal padding
- Background gradient header: `bg-gradient-to-b from-purple/10 to-transparent`

### Skeletons

Use the `LoadingSkeleton` component with variants: `card`, `list`.
Skeleton elements use the `.skeleton-shimmer` class for gradient sweep animation.

---

## 6. Dark Theme Specification

### Rules

1. **Dark is the default and only theme** in v1. No light mode toggle.
2. The `<html>` element always carries `className="dark"`.
3. `color-scheme: dark` is set on `:root`.
4. All colors are defined in the `@theme` block (not inside a `.dark` selector) so they apply globally.
5. The `@custom-variant dark (&:where(.dark, .dark *))` ensures `dark:` Tailwind utilities work.

### Background Layer Hierarchy

```
Page Background     #000000 (bg-deep)     ← true black, body, html
Card Surface        #0A0A0A (bg-surface)   ← rich off-black, cards, panels
Elevated Surface    #141414 (bg-elevated)  ← hover, dropdowns
Border              #262626                ← all borders
```

### Ambient Effects

- **Top glow:** `bg-gradient-to-b from-purple/20 via-bg-deep to-bg-deep`
- **Floating orbs:** `bg-gold/10 blur-[120px]`
- **Backdrop blur:** Header uses `bg-bg-deep/80 backdrop-blur-md`

### RainbowKit Theme

RainbowKit is configured with a custom dark theme matching the OMNOM palette:

```ts
const omnomTheme = {
  ...darkTheme({
    accentColor: "#FFD700",
    accentColorForeground: "#000000",
    borderRadius: "medium",
    overlayBlur: "small",
  }),
  fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
};
```

### Forbidden Patterns

- ❌ `bg-white`, `text-black` (use semantic tokens)
- ❌ Hardcoded hex colors in component classes (use CSS variables)
- ❌ `color-scheme: light`
- ❌ Light-colored borders without opacity modifiers

---

## 7. Icon System

### Library

All icons use [`lucide-react`](https://lucide.dev). The package is optimized via `experimental.optimizePackageImports` in `next.config.ts`.

### Common Icons

| Icon | Component | Usage |
|------|-----------|-------|
| Dog | `Dog` | Brand mascot / logo |
| Wallet | `Wallet` / `Wallet2` | Wallet actions |
| Vote | `Vote` | Voting, proposals |
| Search | `Search` | Search, browse |
| ArrowRight | `ArrowRight` | CTAs, navigation |
| ShieldCheck | `ShieldCheck` | Verification, security |
| Sparkles | `Sparkles` | Highlights, features |
| CircleDot | `CircleDot` | Active/live indicators |
| ClipboardList | `ClipboardList` | Proposals list |
| Timer / Clock | `Timer` / `Clock` | Countdowns, time |
| Bell | `Bell` | Notifications |
| CheckCircle2 | `CheckCircle2` | Success states |
| X | `X` | Close, error states |
| Loader2 | `Loader2` | Loading spinners (`animate-spin`) |

### Dynamic Icons

For data-driven icon names (e.g., notification types), use the [`DynamicIcon`](src/components/shared/dynamic-icon.tsx) component:

```tsx
<DynamicIcon name="Vote" className="h-4 w-4" />
```

### Icon Sizing Convention

| Size | Class | Usage |
|------|-------|-------|
| XS | `h-3.5 w-3.5` | Inline badges, small accents |
| SM | `h-4 w-4` | Button icons, nav items |
| MD | `h-5 w-5` | List items, card icons |
| LG | `h-7 w-7` | Header logo |
| XL | `h-12 w-12` to `h-24 w-24` | Empty states, hero |

---

## 8. Animation Guidelines

### Library

[framer-motion](https://www.framer.com/motion/) v12 is used for all animations.

### Standard Easing

```ts
const EASE = [0.22, 1, 0.36, 1] as const;
```

### Common Patterns

#### Entrance Animations

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: EASE }}
>
```

#### Scroll-Triggered (While In View)

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.45, ease: EASE }}
>
```

#### Staggered Children

```tsx
transition={{ delay: i * 0.1, duration: 0.45, ease: EASE }}
```

#### Phase Transitions (AnimatePresence)

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={phase}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
```

### CSS Animations

| Class | Description |
|-------|-------------|
| `.animate-pulse-glow` | Pulsing green box-shadow for "Active" badges |
| `.skeleton-shimmer` | Gradient sweep for loading skeletons |
| `animate-spin` | Rotating spinner (Loader2 icon) |

### Reduced Motion

All animations are disabled when `prefers-reduced-motion: reduce` is active:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Accessibility Requirements

### WCAG 2.1 AA Compliance

- **Color contrast:** All text meets 4.5:1 minimum against backgrounds
- **Focus indicators:** `*:focus-visible` shows `2px solid #FFD700` outline with `2px` offset
- **Keyboard navigation:** All interactive elements are keyboard-accessible
- **Screen readers:** `aria-label` on icon-only buttons, `aria-hidden` on decorative icons

### Skip Link

```html
<a href="#main-content" className="skip-link">Skip to content</a>
```

Visible only when focused. Positioned at top-left with high contrast.

### Dialog Accessibility

- Every dialog includes a `DialogTitle` (visually hidden if custom header is used)
- `DialogDescription` provides context
- Focus trap and Escape-to-close handled by Radix UI primitives

### Semantic HTML

- `<main id="main-content">` wraps page content
- `<header>`, `<nav>`, `<footer>` used appropriately
- `<section>` with `aria-label` for distinct page regions

---

## 10. Responsive Breakpoints

Tailwind's default breakpoints:

| Prefix | Min Width | Target |
|--------|-----------|--------|
| (default) | 0px | Mobile (320px+) |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktops |
| `xl:` | 1280px | Large desktops |

### Mobile-First Approach

All base styles target mobile (320px+). Use `sm:`, `md:`, `lg:` prefixes to enhance for larger screens.

### Minimum Text Size

- **Body text floor:** 14px (`text-sm`) on mobile. Never use `text-xs` (12px) or arbitrary `text-[NNpx]` for primary reading content.
- **Meta/decorative floor:** `text-[10px]` and `text-xs` are permitted **only** for counters, badge numerals, bottom-nav labels, and uppercase tracking labels (e.g. `DELEGATES`). These strings are short, non-prose, and accompanied by icon or position context.
- **Hard rule:** if a user must *read* a sentence to understand the UI, that sentence is ≥ `text-sm`.

### Key Patterns

- **Grid:** `grid-cols-1 sm:grid-cols-3` (cards stack on mobile)
- **Flex direction:** `flex-col sm:flex-row` (stack → row)
- **Text size:** `text-4xl sm:text-6xl` (responsive hero)
- **Padding:** `px-4 sm:px-6 lg:px-8` (progressive padding)
- **Bottom nav:** Visible on mobile (`md:hidden`), hidden on desktop

### Overflow Safety

```css
html, body {
  overflow-x: hidden;
  max-width: 100vw;
}
```

Prevents horizontal scroll at narrow viewports from wide content or animations.

---

*This document is the definitive source of truth for the $OMNOM DAO design system. When making visual changes, update this document first, then implement.*
