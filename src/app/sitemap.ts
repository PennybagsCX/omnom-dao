import type { MetadataRoute } from "next";

import { ProposalStatus } from "@/types";
import { listFinalizedProposals, listProposals } from "@/lib/proposal-service";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Per-request generation: proposal permalinks stay fresh without a rebuild. */
export const dynamic = "force-dynamic";

/**
 * Dynamic sitemap: static routes plus every public proposal permalink
 * (live + decided — never drafts, which aren't publicly reachable).
 *
 * Priorities:
 *   1.0  home / vote (voting hub: live votes + past-votes archive)
 *   0.9  proposals index
 *   0.8  snapshot-explorer (election utility)
 *   0.7  about, results
 *   0.6  faq, governance-vote (FGE archive/deep-dive), proposal permalinks
 *   0.5  brand, terms, privacy
 *   0.3  proposals/create (noindex post-election)
 *
 * changeFrequency guidance:
 *   - vote flips whenever a voting window opens/closes
 *   - proposals flips hourly (new comments + reactions)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/vote`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/results`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/governance-vote`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/proposals`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/snapshot-explorer`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/brand`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/proposals/create`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [finalized, active] = await Promise.all([
      listFinalizedProposals(),
      listProposals({ status: ProposalStatus.ACTIVE, limit: 100, offset: 0 }),
    ]);
    const seen = new Set<string>();
    const permalinks: MetadataRoute.Sitemap = [];
    for (const p of [...active.proposals, ...finalized]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      permalinks.push({
        url: `${siteUrl}/proposals/${p.id}`,
        lastModified: p.votingEndsAt ? new Date(p.votingEndsAt) : new Date(p.createdAt),
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
    return [...statics, ...permalinks];
  } catch {
    // Sitemap must never 500 over data trouble — static routes alone are fine.
    return statics;
  }
}
