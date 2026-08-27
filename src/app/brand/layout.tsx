import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand & Press Kit — Logo, Colors & Typography",
  description:
    "OMNOM DAO press kit: logo files, color palette, typography, and verified statistics for the Foundational Governance Election. Free for editorial use.",
  alternates: { canonical: "/brand" },
  openGraph: {
    title: "Brand & Press Kit · OMNOM DAO",
    description: "Logo, color palette, typography, and press kit for OMNOM DAO.",
    url: "/brand",
  },
};

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}