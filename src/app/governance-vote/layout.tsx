import type { Metadata } from "next";

import { JsonLd, electionJsonLd } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Cast Your FGE Ballot",
  description:
    "Cast your one-wallet-one-vote ballot in the OMNOM DAO Foundational Governance Election. Pick linear, tiered, quadratic, or 1W1V voting math.",
  alternates: { canonical: "/governance-vote" },
  openGraph: {
    title: "Cast Your FGE Ballot · OMNOM DAO",
    description:
      "Cast your one-wallet-one-vote ballot in the OMNOM DAO Foundational Governance Election.",
    url: "/governance-vote",
  },
};

export default function GovernanceVoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={electionJsonLd(SITE_URL)} />
      {children}
    </>
  );
}