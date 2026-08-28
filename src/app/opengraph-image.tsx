import { buildOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/components/seo/og-image";

export const runtime = "edge";
export const alt =
  "OMNOM DAO Foundational Governance Election — vote now at dao.omnom.dog";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpenGraphImage() {
  return buildOgCard();
}