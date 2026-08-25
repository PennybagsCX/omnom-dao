"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Palette,
  Type,
  Component,
  Sparkles,
  ArrowRight,
  Home,
  ClipboardList,
  Plus,
  BarChart3,
  Settings,
  Wallet,
  Vote,
  Trophy,
  Zap,
  Lock,
  Bell,
  Copy,
  CircleDot,
  CheckCircle2,
  XCircle,
  Hourglass,
  Network,
  Coins,
  Landmark,
  Scroll,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HolderBadge } from "@/components/shared/holder-badge";
import { HolderClass } from "@/types";
import { SNAPSHOT } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Shared animation                                                    */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      variants={itemVariants}
      className="scroll-mt-24 border-t border-border/60 py-14 sm:py-20"
    >
      <div className="mb-8 sm:mb-12">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-gold">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Color swatch                                                        */
/* ------------------------------------------------------------------ */

interface SwatchDef {
  name: string;
  hex: string;
  varName: string;
  usage: string;
}

function ColorSwatch({ swatch }: { swatch: SwatchDef }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-bg-elevated/40">
      <div
        className="h-24 w-full transition-transform duration-300 group-hover:scale-[1.02] sm:h-28"
        style={{ backgroundColor: swatch.hex }}
        aria-hidden
      />
      <div className="space-y-1 p-3 sm:p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            {swatch.name}
          </span>
          <span className="font-mono text-xs text-gold">{swatch.hex}</span>
        </div>
        <div className="font-mono text-[0.65rem] text-text-dim">
          {swatch.varName}
        </div>
        <p className="text-xs text-muted-foreground">{swatch.usage}</p>
      </div>
    </div>
  );
}

function ColorGroup({
  label,
  swatches,
}: {
  label: string;
  swatches: SwatchDef[];
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {swatches.map((s) => (
          <ColorSwatch key={s.name} swatch={s} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Type sample                                                         */
/* ------------------------------------------------------------------ */

function TypeRow({
  label,
  classes,
  mono,
  children,
}: {
  label: string;
  classes: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-4 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <div className="shrink-0 sm:w-40">
        <p className="text-xs font-medium text-gold">{label}</p>
        <p className="font-mono text-[0.65rem] text-text-dim">{classes}</p>
      </div>
      <div className={`min-w-0 flex-1 ${mono ? "font-mono" : ""} ${classes}`}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Holder class card                                                   */
/* ------------------------------------------------------------------ */

const HOLDER_CARDS: {
  holderClass: HolderClass;
  count: number;
  accent: string;
  ring: string;
}[] = [
  {
    holderClass: HolderClass.WHALE,
    count: SNAPSHOT.expectedDistribution.whales,
    accent: "text-amber-400",
    ring: "ring-amber-500/30",
  },
  {
    holderClass: HolderClass.DOLPHIN,
    count: SNAPSHOT.expectedDistribution.dolphins,
    accent: "text-sky-400",
    ring: "ring-sky-500/30",
  },
  {
    holderClass: HolderClass.FISH,
    count: SNAPSHOT.expectedDistribution.fish,
    accent: "text-slate-400",
    ring: "ring-slate-500/30",
  },
];

/* ------------------------------------------------------------------ */
/* Icon system groups                                                  */
/* ------------------------------------------------------------------ */

const ICON_GROUPS: { category: string; icons: { Icon: LucideIcon; name: string }[] }[] = [
  {
    category: "Navigation",
    icons: [
      { Icon: Home, name: "Home" },
      { Icon: ClipboardList, name: "ClipboardList" },
      { Icon: Plus, name: "Plus" },
      { Icon: BarChart3, name: "BarChart3" },
      { Icon: Settings, name: "Settings" },
    ],
  },
  {
    category: "Status",
    icons: [
      { Icon: CircleDot, name: "CircleDot" },
      { Icon: CheckCircle2, name: "CheckCircle2" },
      { Icon: XCircle, name: "XCircle" },
      { Icon: Hourglass, name: "Hourglass" },
      { Icon: Lock, name: "Lock" },
    ],
  },
  {
    category: "Actions",
    icons: [
      { Icon: Vote, name: "Vote" },
      { Icon: Wallet, name: "Wallet" },
      { Icon: Copy, name: "Copy" },
      { Icon: Zap, name: "Zap" },
      { Icon: Trophy, name: "Trophy" },
    ],
  },
  {
    category: "Communication",
    icons: [
      { Icon: Bell, name: "Bell" },
      { Icon: MessageCircle, name: "MessageCircle" },
      { Icon: Network, name: "Network" },
      { Icon: Coins, name: "Coins" },
      { Icon: Landmark, name: "Landmark" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const BRAND: SwatchDef[] = [
  { name: "Gold", hex: "#FFD700", varName: "--color-gold", usage: "Primary brand — CTAs, accents, logo" },
  { name: "Gold Hover", hex: "#E6C200", varName: "--color-gold-hover", usage: "Hover state for gold buttons" },
];

const SURFACE: SwatchDef[] = [
  { name: "BG Deep", hex: "#000000", varName: "--color-bg-deep", usage: "Page background (true black, deepest layer)" },
  { name: "BG Surface", hex: "#0A0A0A", varName: "--color-bg-surface", usage: "Cards, panels, primary surfaces (rich off-black)" },
  { name: "BG Elevated", hex: "#141414", varName: "--color-bg-elevated", usage: "Hovered cards, dropdowns, inputs" },
  { name: "Border", hex: "#262626", varName: "--color-border", usage: "All borders, dividers (WCAG-visible separation)" },
];

const TEXT: SwatchDef[] = [
  { name: "Primary", hex: "#FAFAFA", varName: "--color-text-primary", usage: "Headings, primary body text" },
  { name: "Secondary", hex: "#A1A1AA", varName: "--color-text-muted", usage: "Secondary text, descriptions" },
  { name: "Muted", hex: "#8B8B96", varName: "--color-text-dim", usage: "Tertiary text, timestamps, meta (WCAG AA on all layers)" },
];

const STATUS: SwatchDef[] = [
  { name: "Success", hex: "#10B981", varName: "--color-success", usage: "Passed proposals, verified, confirmed" },
  { name: "Danger", hex: "#EF4444", varName: "--color-danger", usage: "Failed proposals, errors, destructive" },
  { name: "Warning", hex: "#F59E0B", varName: "--color-warning", usage: "Pending review, caution, expiry" },
];

export default function BrandPage() {
  return (
    <motion.main
      variants={containerVariants}
      initial="visible"
      className="omnom-fade-in-up relative mx-auto w-full max-w-6xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:pt-20"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gold/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-32 -z-10 h-80 w-80 bg-bg-elevated blur-[100px]"
      />

      {/* ── 1. Hero ────────────────────────────────────────────── */}
      <motion.header variants={itemVariants} className="relative">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/30">
            <Palette aria-hidden className="h-7 w-7 text-gold" />
          </span>
          <Badge variant="outline" className="border-gold/40 text-gold">
            v1.0.0
          </Badge>
        </div>
        <h1 className="mt-6 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
          <Palette aria-hidden className="h-9 w-9 text-gold sm:h-11 sm:w-11" />
          <span className="text-foreground">
            Brand Guidelines
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          The definitive source of truth for the design system of $OMNOM DAO —
          colors, typography, components, and the holder-class brand identity.
        </p>
      </motion.header>

      {/* ── 2. Brand Identity ──────────────────────────────────── */}
      <Section id="identity" eyebrow="Identity" title="Brand Identity">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gold/5 blur-3xl"
            />
            <CardContent className="relative flex flex-col items-center justify-center gap-5 py-14">
              <span className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/25 to-gold/5 ring-1 ring-gold/30">
                <Palette aria-hidden className="h-16 w-16 text-gold" />
              </span>
              <p className="text-xs uppercase tracking-[0.2em] text-text-dim">
                Logo Icon
              </p>
              <p className="font-mono text-xs text-gold">lucide-react · Palette</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Wordmark</CardTitle>
              <CardDescription>The canonical project name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-4xl font-bold tracking-tight text-gold">
                $OMNOM DAO
              </p>
              <div className="space-y-2 border-t border-border/60 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tagline
                </p>
                <p className="text-sm text-foreground">
                  Off-chain · Snapshot-based · No gas fees
                </p>
              </div>
              <div className="space-y-2 border-t border-border/60 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Brand Voice
                </p>
                <p className="text-sm text-muted-foreground">
                  Approachable but credible. Playful identity, serious mechanics.
                  Transparent — snapshot data and provenance always visible.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── 3. Color Palette ───────────────────────────────────── */}
      <Section id="colors" eyebrow="Color System" title="Color Palette">
        <div className="space-y-10">
          <ColorGroup label="Brand Colors" swatches={BRAND} />
          <ColorGroup label="Surface Colors" swatches={SURFACE} />
          <ColorGroup label="Text Colors" swatches={TEXT} />
          <ColorGroup label="Status Colors" swatches={STATUS} />
        </div>
      </Section>

      {/* ── 4. Typography ──────────────────────────────────────── */}
      <Section id="typography" eyebrow="Type System" title="Typography">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Type aria-hidden className="h-5 w-5 text-gold" />
              <div>
                <CardTitle>Inter</CardTitle>
                <CardDescription>Sans — primary UI font</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TypeRow label="Display" classes="text-4xl font-bold tracking-tight sm:text-5xl">
                $OMNOM DAO
              </TypeRow>
              <TypeRow label="H1" classes="text-3xl font-bold tracking-tight">
                Governance
              </TypeRow>
              <TypeRow label="H2" classes="text-2xl font-bold">
                Active Proposals
              </TypeRow>
              <TypeRow label="H3" classes="text-xl font-bold">
                Proposal Details
              </TypeRow>
              <TypeRow label="Body" classes="text-sm">
                Cast your vote — weighted by your snapshot balance — and shape
                the future of $OMNOM.
              </TypeRow>
              <TypeRow label="Caption" classes="text-xs text-text-dim">
                Snapshot · Block 59,922,100 · Jun 7, 2026
              </TypeRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <span aria-hidden className="font-mono text-lg text-gold">{"</>"}</span>
              <div>
                <CardTitle>JetBrains Mono</CardTitle>
                <CardDescription>Mono — data, addresses, code</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TypeRow label="Address" classes="text-xs" mono>
                0xe3fcA919883950c5cD468156392a6477Ff5d18de
              </TypeRow>
              <TypeRow label="Balance" classes="text-sm" mono>
                1,250,000.00 OMNOM
              </TypeRow>
              <TypeRow label="Block" classes="text-xs" mono>
                59,922,100
              </TypeRow>
              <TypeRow label="Code" classes="text-xs" mono>
                {`const symbol = "OMNOM";`}
              </TypeRow>
              <div className="pt-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Type Scale
                </p>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-text-dim">
                  {["0.75rem", "0.875rem", "1rem", "1.25rem", "1.5rem", "1.875rem", "2.25rem", "3rem"].map(
                    (size) => (
                      <span key={size} className="text-xs">
                        {size}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── 5. Holder Class System ─────────────────────────────── */}
      <Section
        id="holders"
        eyebrow="Brand Identity"
        title="Holder Class System"
      >
        <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
          Core brand identity. Color-coded holder tiers add personality while
          voting power remains strictly balance-weighted (1 token = 1 vote).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOLDER_CARDS.map(({ holderClass, count, accent, ring }) => {
            const cfg = HOLDER_CFG[holderClass];
            return (
              <Card key={holderClass} className={`ring-1 ${ring}`}>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <span aria-hidden className="text-5xl">
                    {cfg.emoji}
                  </span>
                  <HolderBadge holderClass={holderClass} size="lg" />
                  <p className={`text-2xl font-bold ${accent}`}>
                    {count.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-dim">
                    Threshold ≥ {cfg.threshold}% of supply
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* ── 6. Component Showcase ──────────────────────────────── */}
      <Section
        id="components"
        eyebrow="Building Blocks"
        title="Component Showcase"
      >
        <div className="space-y-6">
          {/* Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Component aria-hidden className="h-5 w-5 text-gold" />
                Buttons
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>Default (Gold)</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles aria-hidden className="h-5 w-5 text-gold" />
                Badges
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-text-dim">
                  Status:
                </span>
                <Badge variant="success">Passed</Badge>
                <Badge variant="destructive">Failed</Badge>
                <Badge variant="secondary">Active</Badge>
                <Badge variant="outline">Draft</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-text-dim">
                  Type:
                </span>
                <Badge variant="outline" className="border-gold/40 text-gold">
                  <Network aria-hidden className="mr-1 h-3 w-3" /> Chain Selection
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                  <Coins aria-hidden className="mr-1 h-3 w-3" /> Tokenomics
                </Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                  <Scroll aria-hidden className="mr-1 h-3 w-3" /> Guideline
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-text-dim">
                  Holder:
                </span>
                <HolderBadge holderClass={HolderClass.WHALE} />
                <HolderBadge holderClass={HolderClass.DOLPHIN} />
                <HolderBadge holderClass={HolderClass.FISH} />
              </div>
            </CardContent>
          </Card>

          {/* Card + Inputs */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card Example</CardTitle>
                <CardDescription>A standard content surface.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cards use the surface background (<span className="font-mono text-gold">#0A0A0A</span>)
                  with subtle borders for separation from the deep page layer.
                </p>
                <Input placeholder="Search proposals…" aria-label="Search proposals" />
                <Textarea placeholder="Add a comment (markdown supported)…" rows={3} aria-label="Add a comment" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Input & Textarea</CardTitle>
                <CardDescription>Form field styling.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Wallet Address
                  </label>
                  <Input
                    readOnly
                    aria-label="Wallet address"
                    value="0xe3fcA919883950c5cD468156392a6477Ff5d18de"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Proposal Body
                  </label>
                  <Textarea placeholder="Describe your proposal…" rows={3} aria-label="Proposal description" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      {/* ── 7. Icon System ─────────────────────────────────────── */}
      <Section id="icons" eyebrow="Iconography" title="Icon System">
        <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
          All UI icons use{" "}
          <span className="font-mono text-gold">lucide-react</span>. Decorative
          icons carry <span className="font-mono text-gold">aria-hidden</span>.
          Holder-class emojis (🐋🐬🐟) are the only intentional exception to the
          no-emoji rule.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {ICON_GROUPS.map((group) => (
            <Card key={group.category}>
              <CardHeader>
                <CardTitle className="text-base">{group.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  {group.icons.map(({ Icon, name }) => (
                    <div
                      key={name}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-bg-elevated/30 p-3 text-center"
                    >
                      <Icon aria-hidden className="h-5 w-5 text-foreground" />
                      <span className="font-mono text-[0.6rem] leading-tight text-text-dim">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── 8. Footer note ─────────────────────────────────────── */}
      <motion.footer
        variants={itemVariants}
        className="mt-16 border-t border-border/60 pt-12"
      >
        <div className="flex flex-col items-start gap-6 rounded-2xl border border-gold/20 bg-bg-surface p-8 sm:p-10">
          <Palette aria-hidden className="h-10 w-10 text-gold" />
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">
              The ultimate source of truth.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              These guidelines are the ultimate source of truth for all $OMNOM
              DAO design decisions. For the complete specification, refer to the
              full Brand Standards document.
            </p>
          </div>
          <Button asChild>
            <Link
              href="https://github.com/omnom-dao/omnom-dao/blob/main/DOCS/BRAND_STANDARDS.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Palette aria-hidden className="mr-2 h-4 w-4" />
              Read Full Brand Standards
              <ArrowRight aria-hidden className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-8 text-center text-xs text-text-dim">
          $OMNOM DAO · Brand Guidelines v1.0.0 · Dark-only theme
        </p>
      </motion.footer>
    </motion.main>
  );
}

/* Local holder config mirror for the brand showcase (avoids importing the
   full constants record just for emoji/threshold display). */
const HOLDER_CFG: Record<HolderClass, { emoji: string; threshold: number }> = {
  [HolderClass.WHALE]: { emoji: "🐋", threshold: 1.0 },
  [HolderClass.DOLPHIN]: { emoji: "🐬", threshold: 0.01 },
  [HolderClass.FISH]: { emoji: "🐟", threshold: 0 },
};
