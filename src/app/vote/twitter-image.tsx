import {
  loadActiveVoteCard,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/components/seo/og-image";

/** Live voting data — rendered per request, never prerendered at build time. */
export const dynamic = "force-dynamic";

export const alt = "OMNOM DAO — live governance vote at dao.omnom.dog/vote";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * Twitter card image for /vote — same content as the Open Graph image.
 * Shares `loadActiveVoteCard` so one change updates both surfaces.
 */
export default async function TwitterImage() {
  return loadActiveVoteCard({
    voteCtaUrl: "dao.omnom.dog/vote",
    siteCtaUrl: "dao.omnom.dog/vote",
  });
}
