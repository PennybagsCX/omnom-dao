import {
  loadActiveVoteCard,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/components/seo/og-image";

/** Live voting data — rendered per request, never prerendered at build time. */
export const dynamic = "force-dynamic";

export const alt = "OMNOM DAO — community governance for $OMNOM holders";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Data-driven card: an ACTIVE referendum/vote leads the homepage share;
 *  with nothing live it falls back to the evergreen brand statement. */
export default async function OpenGraphImage() {
  return loadActiveVoteCard({
    voteCtaUrl: "dao.omnom.dog/vote",
    siteCtaUrl: "dao.omnom.dog",
  });
}
