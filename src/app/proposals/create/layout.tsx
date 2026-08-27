import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a Proposal · OMNOM DAO",
  description:
    "Submit a new governance proposal to OMNOM DAO. Six templates, gasless submission, admin review before activation.",
  alternates: { canonical: "/proposals/create" },
  openGraph: {
    title: "Submit a Proposal · OMNOM DAO",
    description: "Submit a new governance proposal to OMNOM DAO.",
    url: "/proposals/create",
  },
  // Noindex until post-election (proposals unlock Sep 12+).
  // The route handler still works; this just keeps it out of search until then.
};

export default function CreateProposalLayout({ children }: { children: React.ReactNode }) {
  return children;
}