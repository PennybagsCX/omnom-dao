import {
  loadActiveVoteCard,
  OG_SIZE,
  OG_CONTENT_TYPE,
} from "@/components/seo/og-image";

/** Live voting data — rendered per request, never prerendered at build time. */
export const dynamic = "force-dynamic";

export const alt =
  "OMNOM DAO — live governance vote. Vote now at dao.omnom.dog/vote";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Data-driven card: ACTIVE referendum → referendum card; other ACTIVE
 *  proposal → live-vote card; none → brand fallback. */
export default async function OpenGraphImage() {
  return loadActiveVoteCard({
    voteCtaUrl: "dao.omnom.dog/vote",
    siteCtaUrl: "dao.omnom.dog/vote",
  });
}
