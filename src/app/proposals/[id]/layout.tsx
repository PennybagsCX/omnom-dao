import type { Metadata } from "next";

import { getProposalById } from "@/lib/proposal-service";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ProposalDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

/**
 * Server layout for the proposal detail route: gives every proposal a
 * permalink-quality browser/OG title and description (the client page can't
 * export metadata). Detail pages stay publicly linked forever — including
 * decided proposals reached from /results — so their titles must be real.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const proposal = await getProposalById(id);
    if (!proposal) return {};
    const plain = proposal.description.replace(/[#*`>\n]+/g, " ").trim();
    return {
      title: `${proposal.title} · OMNOM DAO`,
      description: plain.slice(0, 155),
    };
  } catch {
    // Unfindable id (or transient data error): fall back to the section title.
    return {};
  }
}
