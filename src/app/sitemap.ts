import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Dynamic sitemap including static routes. Proposal URLs are added at
 * build/request time (TODO: merge active proposal slugs from DB).
 *
 * Priorities:
 *   1.0  home / governance-vote (election is the headline)
 *   0.9  proposals index
 *   0.8  snapshot-explorer (election utility)
 *   0.7  about
 *   0.6  faq
 *   0.5  brand, terms, privacy
 *   0.4  proposals/create (noindex post-election)
 *
 * changeFrequency guidance:
 *   - election pages flip daily during Aug 29 → Sep 12
 *   - proposals flips hourly (new comments + reactions)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/governance-vote`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
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
}