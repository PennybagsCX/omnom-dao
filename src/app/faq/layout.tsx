import type { Metadata } from "next";

import { JsonLd, faqJsonLd } from "@/components/seo/json-ld";

/**
 * FAQPage schema — surfaces FAQ rich snippets in Google Search.
 * Items must mirror the FAQ content rendered by the client component below
 * (src/app/faq/page.tsx). Keep them in sync when adding/removing questions.
 */
const FAQ_ITEMS = [
  {
    question: "What is OMNOM DAO?",
    answer:
      "OMNOM DAO is an off-chain, advisory governance platform for holders of the $OMNOM token. It uses Sign-In with Ethereum (EIP-4361) for authentication and a frozen snapshot of historical Dogechain holdings (block 59,922,100, captured 2026-06-07) for eligibility verification.",
  },
  {
    question: "How is eligibility determined?",
    answer:
      "Eligibility is determined exclusively by the frozen snapshot at Dogechain block 59,922,100. A wallet must have held $OMNOM at that block to be eligible to vote or propose. The snapshot artifact is published with a SHA-256 hash that is pinned in the production database.",
  },
  {
    question: "What is the Foundational Governance Election?",
    answer:
      "The Foundational Governance Election (FGE) runs from August 29 to September 12, 2026. Every eligible wallet picks one of four voting math options: linear, one-wallet-one-vote, tiered, or quadratic. The option that wins becomes the voting math for all future proposals.",
  },
  {
    question: "How do I sign in?",
    answer:
      "Click Connect Wallet on any page, choose MetaMask, Rabby, Brave, or a WalletConnect-relayed wallet (Trust, Ledger, OKX), and sign the SIWE message. The platform never sees your private key or seed phrase.",
  },
  {
    question: "What are the tier classifications?",
    answer:
      "Eligible wallets are classified into seven tiers by historical $OMNOM balance: Kraken (≥1B), Whale (≥100M), Dolphin (≥10M), Shark (≥1M), Octopus (≥100K), Crab (≥10K), Seahorse (<10K). Tier affects voting weight under the tiered and quadratic math options.",
  },
  {
    question: "Are ballots editable?",
    answer:
      "Yes. While the election is OPEN (Aug 29 – Sep 12) you can change your ballot as many times as you like. The final tally uses your most recent ballot at the moment the election closes.",
  },
  {
    question: "Is there an fee to to vote?",
    answer:
      "No. Voting is gasless — all ballots are recorded off-chain against the pinned snapshot.",
  },
  {
    question: "What happens after the election?",
    answer:
      "The winning voting math is locked in and applied to all subsequent proposals. Proposal creation unlocks for verified holders. The full ballot audit CSV is published within 7 days.",
  },
];

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Common questions about the OMNOM DAO platform: SIWE sign-in, snapshot verification, voting math, election eligibility, and more.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Frequently Asked Questions · OMNOM DAO",
    description: "Common questions about the OMNOM DAO platform.",
    url: "/faq",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />
      {children}
    </>
  );
}