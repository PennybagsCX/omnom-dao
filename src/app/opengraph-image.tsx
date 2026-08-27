import type { ImageResponse } from "next/og";

import { buildOgCard, OG_SIZE, OG_RUNTIME, OG_CONTENT_TYPE } from "@/components/seo/og-image";

export const runtime = OG_RUNTIME;
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
export default async function OpenGraphImage(): Promise<ImageResponse> {
  return buildOgCard(
    "OMNOM DAO Foundational Governance Election — vote now at dao.omnom.dog",
  );
}