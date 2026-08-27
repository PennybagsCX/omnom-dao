import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/seo/og-image";

// Next.js requires `runtime` to be a literal string in the route file
// (it can't trace a re-export through a helper). Inline the value here.
export const runtime = "edge";
export const alt =
  "OMNOM DAO Foundational Governance Election — vote now at dao.omnom.dog";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Dynamic Open Graph image for Facebook, LinkedIn, Discord, Slack,
 * Telegram, iMessage, Farcaster, and any other platform that consumes
 * the Open Graph protocol. Uses Inter (matching the live site) via the
 * shared `buildOgCard` helper.
 */
export default async function OpenGraphImage() {
  return buildOgCard();
}