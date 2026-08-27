import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brand & Press Kit",
  description:
    "OMNOM DAO branding: logo, color palette, typography, and press kit for the Foundational Governance Election.",
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