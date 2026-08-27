import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Active Proposals",
  description:
    "Browse active, passed, and failed OMNOM DAO proposals. Comment, react, and view live tallies on every governance proposal.",
  alternates: { canonical: "/proposals" },
  openGraph: {
    title: "Browse Active Proposals · OMNOM DAO",
    description: "Browse active, passed, and failed OMNOM DAO proposals.",
    url: "/proposals",
  },
};

export default function ProposalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}