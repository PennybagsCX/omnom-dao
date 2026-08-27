import {
  ErrorCode,
  HolderClass,
  NotificationType,
  ProposalStatus,
  ProposalType,
  VoteChoice,
  type SnapshotMetadata,
} from "@/types";

// ─────────────────────────────────────────────────────────────
// Token / Snapshot constants
// ─────────────────────────────────────────────────────────────

export const OMNOM_TOKEN = {
  /** $OMNOM contract on Dogechain (frozen, dead chain). */
  contractAddress: "0xe3fcA919883950c5cD468156392a6477Ff5d18de",
  decimals: 18,
  symbol: "OMNOM",
  /** Dogechain chain id (sunset chain, snapshot-only reference). */
  chainId: 2000,
  chainName: "Dogechain (Snapshot)",
} as const;

export const SNAPSHOT = {
  blockNumber: 59_922_100,
  timestamp: "2026-06-07T23:59:58.000Z",
  /** Ever-held master list: union of all 11 snapshots (pre-announcement + weekly Jun 14 – Aug 8). */
  totalHolders: 25_686,
  expectedDistribution: {
    krakens: 1,
    whales: 3,
    dolphins: 30,
    sharks: 326,
    octopuses: 1078,
    crabs: 1701,
    seahorses: 22547,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Session / Auth constants
// ─────────────────────────────────────────────────────────────

/** JWT cookie name (httpOnly, Secure, SameSite=Strict). */
export const SESSION_COOKIE = "omnom_token";

/** JWT lifetime in seconds — 7 days (canonical per DESIGN.md + WALLET-FLOW.md). */
export const JWT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Absolute maximum session lifetime before forced re-auth — 90 days. */
export const JWT_ABSOLUTE_MAX_SECONDS = 90 * 24 * 60 * 60;

/** SIWE nonce lifetime — 5 minutes, single-use. */
export const NONCE_TTL_SECONDS = 5 * 60;

// ─────────────────────────────────────────────────────────────
// Holder class configuration
// ─────────────────────────────────────────────────────────────

export interface HolderClassConfig {
  label: string;
  emoji: string;
  /** Minimum percentage of supply to qualify (inclusive). */
  threshold: number;
  /** Human-readable threshold label for UI display. */
  thresholdLabel: string;
  /** Plural form for distribution counts. */
  plural: keyof SnapshotMetadata["distribution"];
  /** Tailwind text color class for the badge. */
  colorClass: string;
  /** Tailwind background class for the badge pill. */
  bgClass: string;
  /** Tailwind border class for the badge pill. */
  borderClass: string;
  /** One-line description of what the class means. */
  description: string;
}

export const HOLDER_CLASS_CONFIG: Record<HolderClass, HolderClassConfig> = {
  [HolderClass.KRAKEN]: {
    label: "Kraken",
    emoji: "🦑",
    threshold: 10.0,
    thresholdLabel: ">= 10%",
    plural: "krakens",
    colorClass: "text-fuchsia-400",
    bgClass: "bg-fuchsia-500/10",
    borderClass: "border-fuchsia-500/30",
    description: "Apex holder — a double-digit share of supply that moves outcomes alone.",
  },
  [HolderClass.WHALE]: {
    label: "Whale",
    emoji: "🐋",
    threshold: 1.0,
    thresholdLabel: ">= 1%",
    plural: "whales",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    description: "Giants of the deep — each can sway a vote single-handedly.",
  },
  [HolderClass.DOLPHIN]: {
    label: "Dolphin",
    emoji: "🐬",
    threshold: 0.1,
    thresholdLabel: ">= 0.1%",
    plural: "dolphins",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/30",
    description: "Large holders with serious weight behind every vote.",
  },
  [HolderClass.SHARK]: {
    label: "Shark",
    emoji: "🦈",
    threshold: 0.01,
    thresholdLabel: ">= 0.01%",
    plural: "sharks",
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-500/30",
    description: "Significant holders — the bar for creating high-impact proposals.",
  },
  [HolderClass.OCTOPUS]: {
    label: "Octopus",
    emoji: "🐙",
    threshold: 0.001,
    thresholdLabel: ">= 0.001%",
    plural: "octopuses",
    colorClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/30",
    description: "Mid-tier holders with many arms in the ecosystem.",
  },
  [HolderClass.CRAB]: {
    label: "Crab",
    emoji: "🦀",
    threshold: 0.0001,
    thresholdLabel: ">= 0.0001%",
    plural: "crabs",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    description: "Small-but-committed holders scuttling along the reef floor.",
  },
  [HolderClass.SEAHORSE]: {
    label: "Seahorse",
    emoji: "🦄",
    threshold: 0,
    thresholdLabel: "any balance",
    plural: "seahorses",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/30",
    description: "The long tail — every ever-held wallet below 0.0001% of supply.",
  },
  /** @deprecated Mirrors SEAHORSE for rendering stale FISH classes from pre-migration JWTs. */
  [HolderClass.FISH]: {
    label: "Fish",
    emoji: "🐟",
    threshold: 0,
    thresholdLabel: "any balance",
    plural: "seahorses",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-500/10",
    borderClass: "border-slate-500/30",
    description: "Legacy pre-migration name for the Seahorse tier.",
  },
};

/**
 * Classify a holder by percentage of supply. Cosmetic only — voting power is
 * strictly balance-weighted (1 token = 1 vote) in v1.
 */
export function classifyHolder(pct: number): HolderClass {
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.KRAKEN].threshold) return HolderClass.KRAKEN;
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.WHALE].threshold) return HolderClass.WHALE;
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.DOLPHIN].threshold) return HolderClass.DOLPHIN;
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.SHARK].threshold) return HolderClass.SHARK;
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.OCTOPUS].threshold) return HolderClass.OCTOPUS;
  if (pct >= HOLDER_CLASS_CONFIG[HolderClass.CRAB].threshold) return HolderClass.CRAB;
  return HolderClass.SEAHORSE;
}

/** Canonical UI iteration order — 7 live tiers in descending rank (no FISH). */
export const HOLDER_CLASS_ORDER: readonly HolderClass[] = [
  HolderClass.KRAKEN,
  HolderClass.WHALE,
  HolderClass.DOLPHIN,
  HolderClass.SHARK,
  HolderClass.OCTOPUS,
  HolderClass.CRAB,
  HolderClass.SEAHORSE,
] as const;

/** Single source of truth for class rank (higher = more governance power). FISH maps to SEAHORSE rank. */
export const HOLDER_CLASS_RANK: Record<HolderClass, number> = {
  [HolderClass.KRAKEN]: 7,
  [HolderClass.WHALE]: 6,
  [HolderClass.DOLPHIN]: 5,
  [HolderClass.SHARK]: 4,
  [HolderClass.OCTOPUS]: 3,
  [HolderClass.CRAB]: 2,
  [HolderClass.SEAHORSE]: 1,
  [HolderClass.FISH]: 1,
} as const;

/** Maps HolderClass to its plural distribution key. FISH maps to "seahorses". */
export const DISTRIBUTION_KEY: Record<HolderClass, keyof SnapshotMetadata["distribution"]> = {
  [HolderClass.KRAKEN]: "krakens",
  [HolderClass.WHALE]: "whales",
  [HolderClass.DOLPHIN]: "dolphins",
  [HolderClass.SHARK]: "sharks",
  [HolderClass.OCTOPUS]: "octopuses",
  [HolderClass.CRAB]: "crabs",
  [HolderClass.SEAHORSE]: "seahorses",
  [HolderClass.FISH]: "seahorses",
} as const;

// ─────────────────────────────────────────────────────────────
// Proposal type metadata
// ─────────────────────────────────────────────────────────────

export interface ProposalTypeConfig {
  label: string;
  /** @deprecated Use `iconName` — retained for backward compatibility. */
  emoji: string;
  /** lucide-react component name rendered via <DynamicIcon />. */
  iconName: string;
  description: string;
  /** Minimum HolderClass required to create a proposal of this type. */
  minHolderClass: HolderClass;
  accentClass: string;
}

export const PROPOSAL_TYPE_CONFIG: Record<ProposalType, ProposalTypeConfig> = {
  [ProposalType.CHAIN_SELECTION]: {
    label: "Chain Selection",
    emoji: "⛓️",
    iconName: "Network",
    description: "Where to relaunch / migrate the token.",
    minHolderClass: HolderClass.SHARK,
    accentClass: "text-gold",
  },
  [ProposalType.TOKENOMICS_CHANGE]: {
    label: "Tokenomics Change",
    emoji: "🔥",
    iconName: "Coins",
    description: "Supply changes, burns, emissions.",
    minHolderClass: HolderClass.SHARK,
    accentClass: "text-rose-400",
  },
  [ProposalType.TREASURY]: {
    label: "Treasury",
    emoji: "💰",
    iconName: "Landmark",
    description: "Fund allocation and spending.",
    minHolderClass: HolderClass.SEAHORSE,
    accentClass: "text-amber-400",
  },
  [ProposalType.GUIDELINE]: {
    label: "Guideline",
    emoji: "📜",
    iconName: "Scroll",
    description: "Community rules, code of conduct.",
    minHolderClass: HolderClass.SEAHORSE,
    accentClass: "text-emerald-400",
  },
  [ProposalType.TECHNICAL]: {
    label: "Technical",
    emoji: "⚙️",
    iconName: "Settings",
    description: "Platform features, integrations.",
    minHolderClass: HolderClass.SHARK,
    accentClass: "text-cyan-400",
  },
  [ProposalType.GENERAL]: {
    label: "General",
    emoji: "💬",
    iconName: "MessageCircle",
    description: "Anything else.",
    minHolderClass: HolderClass.SEAHORSE,
    accentClass: "text-slate-300",
  },
};

// ─────────────────────────────────────────────────────────────
// Proposal status visual config
// ─────────────────────────────────────────────────────────────

export interface ProposalStatusConfig {
  label: string;
  /** @deprecated Use `iconName` — retained for backward compatibility. */
  emoji: string;
  /** lucide-react component name rendered via <DynamicIcon />. */
  iconName: string;
  /** Tailwind classes for a badge pill. */
  badgeClass: string;
  /** Whether votes can currently be cast (active window). */
  votingOpen: boolean;
}

export const PROPOSAL_STATUS_CONFIG: Record<ProposalStatus, ProposalStatusConfig> = {
  [ProposalStatus.DRAFT]: {
    label: "Draft",
    emoji: "✏️",
    iconName: "PenLine",
    badgeClass: "bg-slate-700/60 text-slate-300 border-slate-600",
    votingOpen: false,
  },
  [ProposalStatus.PENDING_REVIEW]: {
    label: "Pending Review",
    emoji: "⏳",
    iconName: "Hourglass",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-600/40",
    votingOpen: false,
  },
  [ProposalStatus.ACTIVE]: {
    label: "Active",
    emoji: "🟢",
    iconName: "CircleDot",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-600/40",
    votingOpen: true,
  },
  [ProposalStatus.CLOSED]: {
    label: "Closed",
    emoji: "🔒",
    iconName: "Lock",
    badgeClass: "bg-slate-700/60 text-slate-300 border-slate-600",
    votingOpen: false,
  },
  [ProposalStatus.PASSED]: {
    label: "Passed",
    emoji: "✅",
    iconName: "CheckCircle2",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-600/50",
    votingOpen: false,
  },
  [ProposalStatus.FAILED]: {
    label: "Failed",
    emoji: "❌",
    iconName: "XCircle",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-600/40",
    votingOpen: false,
  },
  [ProposalStatus.EXPIRED]: {
    label: "Expired",
    emoji: "⌛",
    iconName: "Hourglass",
    badgeClass: "bg-slate-700/60 text-slate-400 border-slate-600",
    votingOpen: false,
  },
};

// ─────────────────────────────────────────────────────────────
// Vote choice visual config
// ─────────────────────────────────────────────────────────────

export interface VoteChoiceConfig {
  label: string;
  /** @deprecated Use `iconName` — retained for backward compatibility. */
  emoji: string;
  /** lucide-react component name rendered via <DynamicIcon />. */
  iconName: string;
  accentClass: string;
  barClass: string;
}

export const VOTE_CHOICE_CONFIG: Record<VoteChoice, VoteChoiceConfig> = {
  [VoteChoice.FOR]: {
    label: "For",
    emoji: "✅",
    iconName: "Check",
    accentClass: "text-emerald-400",
    barClass: "bg-emerald-500",
  },
  [VoteChoice.AGAINST]: {
    label: "Against",
    emoji: "❌",
    iconName: "X",
    accentClass: "text-rose-400",
    barClass: "bg-rose-500",
  },
  [VoteChoice.ABSTAIN]: {
    label: "Abstain",
    emoji: "⬜",
    iconName: "Minus",
    accentClass: "text-slate-400",
    barClass: "bg-slate-500",
  },
};

// ─────────────────────────────────────────────────────────────
// Notification type config
// ─────────────────────────────────────────────────────────────

export interface NotificationTypeConfig {
  label: string;
  /** @deprecated Use `iconName` — retained for backward compatibility. */
  emoji: string;
  /** lucide-react component name rendered via <DynamicIcon />. */
  iconName: string;
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  [NotificationType.PROPOSAL_CREATED]: { label: "Proposal Created", emoji: "📝", iconName: "FilePlus" },
  [NotificationType.VOTING_STARTED]: { label: "Voting Started", emoji: "🗳️", iconName: "Vote" },
  [NotificationType.VOTING_ENDING_SOON]: { label: "Voting Ending Soon", emoji: "⏰", iconName: "Timer" },
  [NotificationType.PROPOSAL_RESULT]: { label: "Proposal Result", emoji: "📊", iconName: "BarChart3" },
  [NotificationType.MENTION]: { label: "Mention", emoji: "💬", iconName: "MessageCircle" },
};

// ─────────────────────────────────────────────────────────────
// Error code map
// ─────────────────────────────────────────────────────────────

export interface ErrorCodeConfig {
  message: string;
  status: number;
}

export const ERROR_CODE_MAP: Record<ErrorCode, ErrorCodeConfig> = {
  [ErrorCode.UNAUTHORIZED]: { message: "Authentication required.", status: 401 },
  [ErrorCode.INVALID_SIGNATURE]: { message: "Wallet signature could not be verified.", status: 401 },
  [ErrorCode.NONCE_EXPIRED]: { message: "Sign-in nonce expired or already used.", status: 401 },
  [ErrorCode.NOT_FOUND]: { message: "Not found.", status: 404 },
  [ErrorCode.PROPOSAL_NOT_FOUND]: { message: "Proposal not found.", status: 404 },
  [ErrorCode.USER_NOT_FOUND]: { message: "User not found.", status: 404 },
  [ErrorCode.NOT_IN_SNAPSHOT]: {
    message: "Address not found in the snapshot.",
    status: 404,
  },
  [ErrorCode.NOT_VERIFIED]: { message: "Wallet not verified.", status: 403 },
  [ErrorCode.VOTING_CLOSED]: { message: "Voting is closed for this proposal.", status: 409 },
  [ErrorCode.ALREADY_VOTED]: { message: "You have already voted on this proposal.", status: 409 },
  [ErrorCode.INVALID_ADDRESS]: { message: "Invalid wallet address.", status: 400 },
  [ErrorCode.INVALID_CHOICE]: { message: "Invalid vote choice.", status: 400 },
  [ErrorCode.MISSING_FIELDS]: { message: "Required fields are missing.", status: 400 },
  [ErrorCode.VALIDATION_ERROR]: { message: "Request validation failed.", status: 400 },
  [ErrorCode.RATE_LIMITED]: { message: "Too many requests. Slow down.", status: 429 },
  [ErrorCode.INTERNAL_ERROR]: { message: "Something went wrong.", status: 500 },
  // Conflict (409) — delegation / notification
  [ErrorCode.DELEGATION_EXISTS]: {
    message: "You already have an active delegation.",
    status: 409,
  },
  [ErrorCode.DELEGATION_LIMIT]: {
    message: "This delegatee has reached the maximum incoming delegations (500).",
    status: 409,
  },
  [ErrorCode.DELEGATION_NOT_FOUND]: { message: "No active delegation to revoke.", status: 404 },
  [ErrorCode.INVALID_DELEGATION]: { message: "Invalid delegation request.", status: 400 },
  [ErrorCode.NOTIFICATION_NOT_FOUND]: { message: "Notification not found.", status: 404 },
};

// ─────────────────────────────────────────────────────────────
// Anti-spam limits
// ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Minimum time between proposals by the same user. */
  proposalMinIntervalMs: 24 * 60 * 60 * 1000,
  /** Max proposals a user may create in a rolling 7-day window. */
  proposalWindowMax: 3,
  proposalWindowMs: 7 * 24 * 60 * 60 * 1000,
  /** Minimum time between comments by the same user. */
  commentMinIntervalMs: 30 * 1000,
  commentMaxLength: 2000,
  /** Fuzzy-duplicate rejection threshold (Levenshtein distance). */
  duplicateDistance: 3,
  duplicateWindowMs: 7 * 24 * 60 * 60 * 1000,
} as const;

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  /** @deprecated Use `iconName` — retained for backward compatibility. */
  emoji: string;
  /** lucide-react component name rendered via <DynamicIcon />. */
  iconName: string;
}

/**
 * Primary nav — the always-visible top-nav links (header, footer, mobile).
 * Dashboard/Settings/Brand are intentionally NOT here; Dashboard and Settings
 * live in the connected-wallet dropdown (ACCOUNT_NAV_ITEMS), and Brand is a
 * standalone page reachable only via its own route.
 */
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/", emoji: "🏠", iconName: "Home" },
  { label: "Proposals", href: "/proposals", emoji: "📋", iconName: "ClipboardList" },
  { label: "Vote", href: "/governance-vote", emoji: "🗳️", iconName: "Vote" },
  { label: "Create", href: "/proposals/create", emoji: "➕", iconName: "Plus" },
  { label: "Explorer", href: "/snapshot-explorer", emoji: "🔍", iconName: "Search" },
  { label: "FAQ", href: "/faq", emoji: "❓", iconName: "HelpCircle" },
] as const;

/**
 * Account nav — shown inside the connected-wallet dropdown menu only.
 * Requires an authenticated session to be meaningful.
 */
export const ACCOUNT_NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", emoji: "📊", iconName: "BarChart3" },
  { label: "Settings", href: "/settings", emoji: "⚙️", iconName: "Settings" },
  { label: "Admin", href: "/admin", emoji: "🛡️", iconName: "ShieldCheck" },
] as const;

/**
 * Nav items rendered in the mobile bottom bar. Excludes the "Create" CTA,
 * which is surfaced as a primary action button rather than a tab.
 */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = PRIMARY_NAV_ITEMS.filter(
  (item) => item.href !== "/proposals/create",
);

/**
 * Backward-compatible alias. Prefer PRIMARY_NAV_ITEMS for new code.
 * @deprecated Use PRIMARY_NAV_ITEMS or ACCOUNT_NAV_ITEMS instead.
 */
export const NAV_ITEMS: readonly NavItem[] = [...PRIMARY_NAV_ITEMS, ...ACCOUNT_NAV_ITEMS];

// ─────────────────────────────────────────────────────────────
// Admin addresses (parsed once from env)
// ─────────────────────────────────────────────────────────────

/**
 * Admin allow-list, parsed from NEXT_PUBLIC_ADMIN_ADDRESSES (comma-separated).
 * Compared case-insensitively against the JWT `sub`.
 *
 * Production hard-fails on launch if the list is empty or contains any
 * well-known anvil test address. See `assertAdminConfigProductionSafe`.
 */
export function getAdminAddresses(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isAdminAddress(address: string): boolean {
  return getAdminAddresses().includes(address.toLowerCase());
}

/**
 * Well-known anvil / hardhat dev addresses that must NEVER appear in prod.
 * Compiled from the anvil deterministic mnemonic (account #0–#9).
 */
const ANVIL_DENYLIST: ReadonlySet<string> = new Set([
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
  "0x976ea74026e726554db657fa54763abd0c3a0aa9",
  "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
  "0x23618e81e3f5cdf9f2f463f4f37f7cacebf11a16",
  "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
]);

/**
 * Production startup assertion: throws if NEXT_PUBLIC_ADMIN_ADDRESSES is
 * missing or contains a known anvil test address. Mirrors db.ts:62-71.
 * Call this once at boot from a server-side entry point.
 */
export function assertAdminConfigProductionSafe(): void {
  if (process.env.NODE_ENV !== "production") return;
  const admins = getAdminAddresses();
  if (admins.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_ADMIN_ADDRESSES is empty in production. " +
        "Set it to a comma-separated list of admin wallet addresses.",
    );
  }
  for (const addr of admins) {
    if (ANVIL_DENYLIST.has(addr)) {
      throw new Error(
        `NEXT_PUBLIC_ADMIN_ADDRESSES contains anvil dev address ${addr}. ` +
          "Remove it before deploying to production.",
      );
    }
  }
}

/**
 * Production startup assertion: throws if NEXT_PUBLIC_ENABLE_DEV_AUTH is
 * truthy in production. The dev-auth stack (auto-connect, mock wallet, dev
 * panel) is gated out at runtime, but a config mistake here would silently
 * re-enable mock SIWE signatures. Fail closed.
 */
export function assertDevAuthDisabledInProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  const flag = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH;
  if (flag === "true" || flag === "1") {
    throw new Error(
      `NEXT_PUBLIC_ENABLE_DEV_AUTH=${flag} in production. ` +
        "Set it to false (or unset) before deploying.",
    );
  }
}

/**
 * Production startup assertion: throws if Vercel KV is not configured in
 * production. Without KV, the rate limiter (`@/lib/rate-limit`) degrades to
 * fail-open for non-critical routes — which lets a single bad deploy expose
 * vote / proposal / election-ballot endpoints to unlimited abuse. Fail
 * closed at boot instead.
 */
export function assertKvConfiguredInProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  const url = process.env.KV_REST_API_URL ?? process.env.KV_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "Vercel KV is not configured in production (KV_REST_API_URL / KV_URL missing). " +
        "Create a KV store and set KV_REST_API_URL + KV_AUTH_TOKEN before deploying. " +
        "Rate limiting cannot be enforced without it.",
    );
  }
}
