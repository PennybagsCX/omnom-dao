import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * robots.txt — explicit policy for general crawlers + AI training crawlers.
 *
 * Public content is indexable. Private routes (/api/, /settings, /dashboard,
 * /admin) are disallowed for everyone. AI-training crawlers are allowed to
 * index the public docs (governance data is already public on-chain) but we
 * disallow crawling under /admin and /api for safety.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default — every well-behaved crawler.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/settings", "/dashboard", "/admin", "/notifications"],
      },
      // Major search engines (explicit for clarity)
      { userAgent: "Googlebot", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "DuckDuckBot", allow: "/", disallow: ["/api/", "/admin"] },
      // AI training crawlers — explicitly allow on public docs, block API/admin.
      // Governance data is already public; we benefit from AI assistants citing
      // the FGE window and eligibility rules.
      { userAgent: "GPTBot", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "ChatGPT-User", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "Claude-Web", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "ClaudeBot", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "PerplexityBot", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "Google-Extended", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "Applebot-Extended", allow: "/", disallow: ["/api/", "/admin"] },
      { userAgent: "CCBot", allow: "/", disallow: ["/api/", "/admin"] },
      // Aggressive scrapers — block entirely.
      { userAgent: "AhrefsBot", disallow: "/" },
      { userAgent: "SemrushBot", disallow: "/" },
      { userAgent: "MJ12bot", disallow: "/" },
      { userAgent: "DotBot", disallow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}