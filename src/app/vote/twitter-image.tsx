import {
  buildVoteOgCard,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/components/seo/og-image";

export const runtime = "edge";
export const alt =
  "OMNOM DAO governance vote is live — Week 1 of 3, Sep 23–30, 2026";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Twitter card image for /vote — same content as the Open Graph image.
 * Shares `buildVoteOgCard` so one change updates both surfaces.
 */
export default async function TwitterImage() {
  return buildVoteOgCard();
}
