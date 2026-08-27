"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  HelpCircle,
  Wallet,
  Vote,
  Coins,
  ShieldCheck,
  Users,
  Gavel,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SNAPSHOT, OMNOM_TOKEN } from "@/lib/constants";

const EASE = [0.22, 1, 0.36, 1] as const;

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  id: string;
  icon: typeof Wallet;
  title: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "getting-started",
    icon: HelpCircle,
    title: "Getting Started",
    items: [
      {
        q: "What is $OMNOM DAO?",
        a: `$OMNOM DAO is an off-chain, snapshot-based governance platform for $OMNOM token holders. After Dogechain announced its sunset on June 8, 2026, the community needed a way to make collective decisions about what happens next — including chain migration, tokenomics changes, and treasury allocation. This platform provides a transparent, verifiable, and gas-free way for every holder to participate. It covers ${SNAPSHOT.totalHolders.toLocaleString()} holder addresses from the ever-held master list — a union of 11 snapshots taken between June 7 and August 8, 2026, anchored to Dogechain block ${SNAPSHOT.blockNumber.toLocaleString()}.`,
      },
      {
        q: "Do I need to pay gas fees to participate?",
        a: "No. The entire platform is off-chain. Identity is proven via Sign-In with Ethereum (SIWE) — a gas-less message signature that verifies you own your wallet without initiating any on-chain transaction. Voting, proposing, and delegating are all free.",
      },
      {
        q: "What is a snapshot and why does it matter?",
        a: `The platform uses an ever-held master list: a union of 11 weekly snapshots taken from June 7 through August 8, 2026 (Dogechain block 59,922,100 through 62,576,248). It covers ${SNAPSHOT.totalHolders.toLocaleString()} unique holder addresses — anyone who held $OMNOM at any point during that window. Your voting power is based on your maximum balance across all snapshots. The snapshot data is verified using SHA-256 integrity checking and sourced from the public repository at github.com/DBOT-DC/omnom-snapshot.`,
      },
      {
        q: "Can anyone participate?",
        a: "Anyone can browse proposals, results, and discussions as a public observer. However, only addresses that held at least 1 $OMNOM in the snapshot are eligible to vote, propose, or delegate. If your address isn't in the snapshot, you can still read everything — you just can't cast votes.",
      },
      {
        q: "Are governance outcomes binding / automatically executed?",
        a: "No. Governance outcomes are advisory decisions, not auto-executed transactions. A passed proposal is a legitimate community decision recorded transparently, but execution (where applicable, such as a future token migration) is a separate, human-coordinated step. The platform records the community's will; acting on it requires real-world coordination.",
      },
    ],
  },
  {
    id: "wallet-verification",
    icon: Wallet,
    title: "Wallet & Verification",
    items: [
      {
        q: "How do I connect my wallet?",
        a: 'Click "Connect Wallet" in the top-right corner. The platform supports any EVM-compatible wallet through RainbowKit, including MetaMask, Rabby, Coinbase Wallet, WalletConnect, Trust Wallet, Phantom, Ledger, Trezor, SafePal, OKX, and 20+ more. Dogechain is an EVM chain, so any EVM wallet works. You can connect from any network — the connection is chain-agnostic.',
      },
      {
        q: "What is SIWE (Sign-In with Ethereum)?",
        a: "SIWE (EIP-4361) is an Ethereum Foundation standard for authenticating users by signing a human-readable message with their wallet's private key. The signature proves wallet ownership without exposing your private key or requiring a transaction. It works regardless of which chain your wallet is connected to, which is essential since Dogechain is sunset.",
      },
      {
        q: "Is my wallet safe? Do you store my private keys?",
        a: "Yes, your wallet is safe. The platform never sees, stores, or transmits your private keys. The SIWE signature is a local operation performed entirely within your wallet app. All verification is read-only — we only check whether your address appears in the snapshot and look up its balance. No transactions are ever initiated on your behalf.",
      },
      {
        q: "Why do I need to 'verify' after connecting?",
        a: "Connecting your wallet only proves you have a wallet — it doesn't prove you own $OMNOM. The verification step (signing the SIWE message) cryptographically links your wallet address to a server-side session, allowing the platform to check your snapshot balance and unlock voting, proposing, and dashboard features.",
      },
      {
        q: "How long does my session last?",
        a: "Your verified session lasts 7 days via an httpOnly JWT cookie. After that, you'll need to re-sign to continue participating. For security, sessions are capped at an absolute maximum of 90 days regardless of activity.",
      },
      {
        q: "What prevents someone from stealing my session?",
        a: "The session JWT is stored in an httpOnly, Secure, SameSite=Strict cookie — meaning it cannot be read by JavaScript (protecting against XSS attacks) and is only transmitted over HTTPS. The nonce used during sign-in is single-use with a 5-minute TTL, preventing replay attacks where a captured signature could be resubmitted.",
      },
    ],
  },
  {
    id: "voting",
    icon: Vote,
    title: "Voting & Proposals",
    items: [
      {
        q: "How is voting power calculated?",
        a: "In v1, voting power is strictly linear: 1 token = 1 vote. Your voting power equals your $OMNOM balance at the snapshot block (Block 59,922,100). Holder-class badges (🦑 Kraken, 🐋 Whale, 🐬 Dolphin, 🦈 Shark, 🐙 Octopus, 🦀 Crab, 🦄 Seahorse) are cosmetic — they do not change your voting power. A Quadratic Token Voting model (which compresses whale influence) is proposed for v2 but is not yet implemented.",
      },
      {
        q: "What can I vote on?",
        a: "There are six proposal types: Chain Selection (where to relaunch), Tokenomics Change (supply changes, burns), Treasury (fund allocation), Community Guideline (rules), Technical (platform features), and General Discussion (anything else). Each type has its own quorum, voting period, and pass threshold — see the tables below.",
      },
      {
        q: "What are For, Against, and Abstain?",
        a: '"For" means you support the proposal. "Against" means you oppose it. "Abstain" means you want to participate in quorum without affecting the For/Against outcome — useful when you want a proposal to reach quorum but don\'t have a strong opinion on the result.',
      },
      {
        q: "What is quorum and why does it matter?",
        a: "Quorum is the minimum percentage of total token supply that must participate for a vote to be valid. Without quorum, a small group of active voters could pass decisions most holders never saw. If quorum isn't met, the proposal expires regardless of the For/Against ratio. Quorum is measured as (For + Against + Abstain) / total supply × 100%.",
      },
      {
        q: "What are the quorum and pass thresholds for each proposal type?",
        a: `Here are the current v1 defaults:\n\n• Chain Selection — 15% quorum, 60% supermajority to pass, 7-day voting\n• Tokenomics Change — 15% quorum, 60% supermajority, 7-day voting\n• Treasury — 10% quorum, simple majority (>50%), 72h voting\n• Community Guideline — 10% quorum, simple majority, 72h voting\n• Technical Spec — 10% quorum, 60% supermajority, 72h voting\n• General Discussion — 10% quorum, simple majority, 72h voting\n\nSupermajority means FOR must be ≥60% of (FOR + AGAINST) votes cast. Simple majority means FOR must simply exceed AGAINST. Abstain votes count toward quorum but not toward the pass/fail outcome.`,
      },
      {
        q: "How are proposals finalized after voting ends?",
        a: "When the voting period ends, the proposal is automatically evaluated: if quorum was met AND the pass threshold was reached, it transitions to PASSED. If quorum was not met, it becomes EXPIRED. If quorum was met but the threshold wasn't reached, it becomes FAILED. This happens both via a scheduled cron job (every 15–30 minutes) and lazily when anyone views the proposal page.",
      },
      {
        q: "Can I change my vote?",
        a: "Yes. You may change your vote as many times as you like while voting is open. Your latest ballot is the one counted. Once voting closes, your ballot is locked.",
      },
      {
        q: "How long do votes last?",
        a: "Voting periods depend on the proposal type: high-impact proposals (Chain Selection, Tokenomics) run for a minimum of 7 days (up to 14), while standard proposals (Treasury, Guideline, Technical, General) run for a minimum of 72 hours (up to 7 days). The proposer selects the duration at creation within the allowed range.",
      },
      {
        q: "What is the Voting Model Reform poll?",
        a: "The community is currently voting on whether to change how voting power is calculated. Right now, the top 4 wallets (1 kraken + 3 whales) control ~87.1% of all votes under the linear (1 token = 1 vote) model. The reform poll at /governance-vote lets every verified holder cast 1 vote to choose between: Quadratic Voting (compresses whale power), One Wallet One Vote (pure democracy), or Tiered Voting (equal blocks per class). This meta-poll uses 1-wallet-1-vote by design — every holder gets equal say in how future voting works.",
      },
    ],
  },
  {
    id: "proposing",
    icon: Gavel,
    title: "Creating Proposals",
    items: [
      {
        q: "Who can create a proposal?",
        a: "Any verified holder can create Treasury, Guideline, or General proposals. However, high-impact proposal types (Chain Selection, Tokenomics Change, Technical) require at least Shark-class status — meaning you hold ≥0.01% of total supply. This tiered system ensures that decisions with major consequences are proposed by stakeholders with meaningful economic exposure.",
      },
      {
        q: "What are the holder classes?",
        a: `Holders are classified into seven tiers based on snapshot balance: 🦑 Kraken (≥10% of supply, ${SNAPSHOT.expectedDistribution.krakens.toLocaleString()} address), 🐋 Whale (≥1%, ${SNAPSHOT.expectedDistribution.whales.toLocaleString()} addresses), 🐬 Dolphin (≥0.1%, ${SNAPSHOT.expectedDistribution.dolphins.toLocaleString()} addresses), 🦈 Shark (≥0.01%, ${SNAPSHOT.expectedDistribution.sharks.toLocaleString()} addresses), 🐙 Octopus (≥0.001%, ${SNAPSHOT.expectedDistribution.octopuses.toLocaleString()} addresses), 🦀 Crab (≥0.0001%, ${SNAPSHOT.expectedDistribution.crabs.toLocaleString()} addresses), and 🦄 Seahorse (any balance, ${SNAPSHOT.expectedDistribution.seahorses.toLocaleString()} addresses). In v1, classes are cosmetic for voting power — they only gate which proposal types you can create.`,
      },
      {
        q: "Are there anti-spam protections?",
        a: "Yes. To prevent proposal spam, the platform enforces: a minimum 24-hour interval between proposals by the same user, a maximum of 3 proposals per user in any rolling 7-day window, and fuzzy-duplicate detection that rejects near-identical proposals within a 7-day window. Comments are rate-limited to one per 30 seconds. Vote attempts are rate-limited to 10 per 5 minutes.",
      },
      {
        q: "What happens after I submit a proposal?",
        a: 'New proposals start in "Pending Review" status. An admin reviews the proposal for compliance (not for opinion — the content is not censored). Once approved, it moves to "Active" status and the voting clock begins. If rejected, the proposer is notified with the reason. All admin actions (approvals and rejections) are recorded in a public audit log.',
      },
    ],
  },
  {
    id: "delegation",
    icon: Users,
    title: "Delegation",
    items: [
      {
        q: "What is delegation?",
        a: "Delegation lets you publicly signal that another verified holder represents your voting interests. If you don't have time to research every proposal, you can delegate to someone you trust.",
      },
      {
        q: "How does delegation work in v1?",
        a: "IMPORTANT: In v1, delegation is informational and trackable — it does NOT automatically transfer your voting power to the delegatee. You still cast your own vote, weighted by your own snapshot balance. The delegation record simply shows who represents whom, for transparency and for future protocol upgrades where delegation may become functional. This means a delegatee's recorded vote weight is never boosted by incoming delegations in v1.",
      },
      {
        q: "Can I still vote if I've delegated?",
        a: "Yes. Because delegation is informational in v1, you always retain your full voting power. Your delegation is an expression of trust, not a transfer of power. You can vote on any proposal regardless of your delegation status.",
      },
      {
        q: "Can I revoke a delegation?",
        a: "Yes, at any time. Revocation is instant — no time-lock. However, new delegations are subject to a 24-hour time-lock before becoming active (to prevent last-minute delegation swaps to manipulate votes). A delegatee can receive a maximum of 500 incoming delegations.",
      },
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Security & Manipulation Prevention",
    items: [
      {
        q: "How does the platform prevent vote manipulation?",
        a: "Multiple layers protect governance integrity:\n\n• Snapshot immutability — balances are frozen at Block 59,922,100; no new wallets can be created to gain voting power\n• SHA-256 integrity check — the snapshot file is hash-verified at startup; a mismatch in production halts governance rather than loading a tampered file\n• Single-use nonces — each SIWE sign-in nonce can only be used once (5-minute TTL), preventing replay attacks\n• One-vote enforcement — a database UNIQUE constraint on (proposal_id, voter_address) makes double-voting physically impossible\n• Rate limiting — all endpoints are rate-limited; critical routes (vote, proposal, delegation) fail-closed when the rate-limiter is unavailable, blocking abuse during outages\n• Quorum enforcement — proposals that don't meet minimum participation thresholds are automatically expired\n• Supermajority gates — high-impact proposals require 60% FOR, preventing narrow whale coalitions from forcing outcomes",
      },
      {
        q: "Can the snapshot be tampered with?",
        a: "The snapshot file (holders.json) is verified against its embedded SHA-256 hash at startup. In production, if the hash doesn't match (indicating tampering, corruption, or a supply-chain attack), the platform refuses to load the snapshot — governance is disabled until the issue is resolved. In development, a warning is logged but the file is still loaded for convenience.",
      },
      {
        q: "What happens if the rate limiter goes down?",
        a: "For critical governance routes (casting votes, creating proposals, managing delegations), the rate limiter fails closed — meaning requests are DENIED when the backing store (Vercel KV) is unavailable. This prevents an attacker from exploiting an outage to spam votes or brute-force the API. For read-only and non-critical routes, the limiter fails open (allows requests) to keep the platform usable.",
      },
      {
        q: "Can admins manipulate votes?",
        a: "Admins can approve or reject proposals during the Pending Review phase, but they cannot: cast votes on behalf of users, alter vote counts, change the outcome of an active vote, or modify a proposal once it is Active. All admin actions are recorded in a publicly viewable audit log (accessible at /api/v1/audit-log). The system is designed for transparency — all proposals, votes, and results are publicly visible.",
      },
      {
        q: "Is there a single point of failure?",
        a: 'Yes, and you should know about it. The platform currently has a single administrator who gates which proposals reach the ballot. This means: (1) the admin wallet is a high-value target — if compromised, an attacker could suppress proposals; (2) if the admin is unavailable, new proposals cannot be approved. To mitigate this, all admin actions are publicly logged in the audit trail, and the platform is designed to transition to multi-admin or community-elected governance in the future. This is acknowledged as a known limitation of v1.',
      },
      {
        q: "What about vote buying or bribery?",
        a: "Vote buying is an inherent risk in any off-chain governance system — there is no cryptographic way to prevent a holder from being bribed to vote a certain way. The platform mitigates this by: making all votes transparent and auditable, requiring quorum and supermajority thresholds that make buying enough votes expensive, and recording the timing of all votes so suspicious last-minute swings can be identified. A commit-reveal voting scheme (where votes are hidden until the window closes) is proposed for a future version.",
      },
      {
        q: "What data does the platform collect about me?",
        a: "The platform stores your wallet address (from the snapshot), your verified session, and your activity (votes, proposals, comments, delegations). No private keys, no transaction data, and no personal information beyond what's necessary for governance. Your address is public on-chain data — it was already in the snapshot.",
      },
    ],
  },
  {
    id: "tokenomics",
    icon: Coins,
    title: "Token & Snapshot Details",
    items: [
      {
        q: "What happened with Dogechain?",
        a: `On June 7, 2026, Dogechain (chain ID 2000) announced its sunset. All $OMNOM tokens (contract ${OMNOM_TOKEN.contractAddress}) became effectively frozen — holders still own their tokens, but the chain they live on is shutting down. The platform's snapshot was captured at block ${SNAPSHOT.blockNumber.toLocaleString()}, the final usable state.`,
      },
      {
        q: "What was the Vitalik burn?",
        a: "Vitalik Buterin publicly burned 68.9% of the total $OMNOM supply, which elevated the project's visibility and meme-cultural significance. This burn also concentrated the remaining supply among a smaller group of holders — approximately 31.1% of the original supply remains in circulation among the ${SNAPSHOT.totalHolders.toLocaleString()} current holders.",
      },
      {
        q: "How is the snapshot verified?",
        a: `The snapshot is a static JSON file containing all ${SNAPSHOT.totalHolders.toLocaleString()} holder addresses and balances. At startup, the platform computes a SHA-256 hash of the file and compares it against the hash stored in the file's metadata. If they match, the snapshot is loaded. In production, a mismatch halts governance operations. Every balance lookup uses O(log n) binary search against this sorted snapshot for fast verification.`,
      },
      {
        q: "What is the token distribution?",
        a: `Based on the latest snapshot data, the supply is distributed across seven tiers: ${SNAPSHOT.expectedDistribution.krakens.toLocaleString()} kraken (≥10%), ${SNAPSHOT.expectedDistribution.whales.toLocaleString()} whales (≥1%), ${SNAPSHOT.expectedDistribution.dolphins.toLocaleString()} dolphins (≥0.1%), ${SNAPSHOT.expectedDistribution.sharks.toLocaleString()} sharks (≥0.01%), ${SNAPSHOT.expectedDistribution.octopuses.toLocaleString()} octopuses (≥0.001%), ${SNAPSHOT.expectedDistribution.crabs.toLocaleString()} crabs (≥0.0001%), and ${SNAPSHOT.expectedDistribution.seahorses.toLocaleString()} seahorses (any balance). One kraken holds 68.9% of supply; the top four wallets (1 kraken + 3 whales) hold ~87.1%. This concentration is why the governance system implements quorum requirements and supermajority thresholds — to ensure decisions have broad backing and feel legitimate to all holders, not just the largest.`,
      },
    ],
  },
  {
    id: "limitations",
    icon: AlertTriangle,
    title: "Known Limitations & Caveats",
    items: [
      {
        q: "What are the current limitations of the platform?",
        a: "The following are known limitations of v1 that holders should understand:\n\n1. Single administrator — One person currently gates which proposals reach the ballot. All admin actions are publicly audited, but this is a centralization point.\n2. Linear voting — Voting power is strictly 1 token = 1 vote, meaning the top 4 wallets (1 kraken + 3 whales) control ~87.1% of votes. A community poll is currently open at /governance-vote to choose between Quadratic, One-Wallet-One-Vote, or Tiered models.\n3. Informational delegation — Delegation records who represents whom but does not transfer voting power in v1.\n4. Advisory outcomes — Passed proposals are community decisions, not auto-executed transactions.\n5. Off-chain governance — There is no on-chain enforcement; the platform records the community's will, but acting on it requires coordination.\n6. No secret ballot — All votes are transparent and visible. This enables auditability but also means votes can be observed in real-time, which theoretically enables coercion.",
      },
      {
        q: "What safeguards are in place despite these limitations?",
        a: "Despite the limitations above, the platform implements: SHA-256 snapshot integrity verification, fail-closed rate limiting on critical routes, single-use sign-in nonces, one-vote-per-proposal database enforcement, quorum + supermajority thresholds, public admin audit logging, per-user vote rate limits, and automatic proposal finalization. These collectively make governance manipulation difficult and detectable.",
      },
      {
        q: "What's planned for future versions?",
        a: "Future enhancements under consideration include: Quadratic Token Voting (with identity verification for Sybil resistance), functional delegation (where delegatees actually receive voting power), commit-reveal voting (to mitigate vote buying), multi-admin or DAO-elected governance guardians, and a minimum-balance threshold for self-service proposal activation (reducing admin dependency).",
      },
      {
        q: "Why doesn't the platform use on-chain governance?",
        a: "Because Dogechain is sunset — there is no live chain to deploy governance contracts on. The snapshot-based approach was chosen deliberately as the only viable path forward. Once the community votes on a chain migration (via a Chain Selection proposal), on-chain governance may become possible on the new chain.",
      },
    ],
  },
];

export default function FAQPage() {
  const [search, setSearch] = useState("");

  const filtered = FAQ_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((section) => section.items.length > 0);

  const totalQuestions = FAQ_SECTIONS.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-gradient-to-b from-bg-elevated via-bg-deep to-bg-deep"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-20 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
      />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 lg:px-8">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
        >
          <HelpCircle className="h-3.5 w-3.5 text-gold" aria-hidden />
          {totalQuestions} questions answered
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
          className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl"
        >
          Governance Guide & FAQ
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
          className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Everything you need to know about $OMNOM DAO — how verification works,
          voting mechanics, thresholds, security measures, and known limitations.
          The complete, transparent guide to how governance operates.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          className="mt-8 w-full max-w-md"
        >
          <input
            type="search"
            placeholder="Search questions..."
            aria-label="Search FAQ questions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-surface/60 px-4 py-2.5 text-sm text-foreground placeholder:text-text-dim focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </motion.div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <section.icon className="h-3.5 w-3.5" aria-hidden />
              {section.title}
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-text-dim" aria-hidden />
            <p className="mt-4 text-sm text-muted-foreground">
              No questions match &ldquo;{search}&rdquo;.
            </p>
          </div>
        ) : (
          filtered.map((section, sectionIdx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: sectionIdx * 0.05, duration: 0.4, ease: EASE }}
              className="scroll-mt-24 border-t border-border/60 py-10 first:border-t-0"
              id={section.id}
            >
              <div className="mb-6 flex items-center justify-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <section.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                  {section.title}
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-3">
                {section.items.map((item, idx) => (
                  <AccordionItem
                    key={`${section.id}-${idx}`}
                    value={`${section.id}-${idx}`}
                    className="overflow-hidden rounded-lg border border-border bg-bg-surface/40"
                  >
                    <AccordionTrigger className="px-5 py-4 text-left text-sm font-semibold text-foreground hover:no-underline hover:text-gold [&[data-state=open]]:text-gold">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line px-5 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))
        )}
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-8 text-center sm:p-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
          />
          <h2 className="text-2xl font-bold sm:text-3xl">Still have questions?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Join the community on Telegram, or connect your wallet to start
            participating in governance.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/proposals">Browse Proposals</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://t.me/omnomtoken_dc"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join Telegram
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
