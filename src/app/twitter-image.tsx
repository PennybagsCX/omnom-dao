import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/seo/og-image";

export const runtime = "edge";
export const alt = "OMNOM DAO Foundational Governance Election";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Twitter card image — same content as the Open Graph image. Shares the
 * `buildOgCard` helper so a single change updates both surfaces.
 */
export default function TwitterImage() {
  return buildOgCard();
}