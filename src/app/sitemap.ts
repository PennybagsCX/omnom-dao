import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Dynamic sitemap including static routes.
 * Proposal URLs are added at build/request time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/proposals`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/proposals/create`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
