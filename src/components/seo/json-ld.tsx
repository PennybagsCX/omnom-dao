/**
 * JSON-LD structured-data helpers, emitted as `<script type="application/ld+json">`.
 * Used to surface rich results in Google Search (Organization card, FAQ rich
 * snippets, BreadcrumbList, Election/GovernmentOrganization markup).
 *
 * Server-rendered only — these tags need to be in the initial HTML for
 * crawlers, so they are passed via the layout/page tree.
 */
export type JsonLdObject = Record<string, unknown>;

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  // dangerouslySetInnerHTML is the canonical way to embed JSON-LD in Next.js.
  // The data is hard-coded here (server-side, trusted), not user input.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

/** Organization + GovernmentOrganization (since this is a DAO). */
export function organizationJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "GovernmentOrganization"],
    "@id": `${siteUrl}/#organization`,
    name: "OMNOM DAO",
    alternateName: "$OMNOM DAO",
    url: siteUrl,
    logo: `${siteUrl}/icon`,
    description:
      "Off-chain, snapshot-anchored governance platform for $OMNOM token holders.",
    foundingDate: "2026-06-07",
    sameAs: [
      "https://github.com/PennybagsCX/omnom-dao",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@omnom.dog",
        availableLanguage: ["en"],
      },
      {
        "@type": "ContactPoint",
        contactType: "security",
        email: "security@omnom.dog",
        availableLanguage: ["en"],
      },
    ],
    knowsAbout: [
      "Decentralized Autonomous Organizations",
      "Token-based governance",
      "Snapshot voting",
      "EIP-4361 (Sign-In with Ethereum)",
    ],
  };
}

/** WebSite schema with SearchAction — surfaces sitelinks search box. */
export function websiteJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "OMNOM DAO",
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/snapshot-explorer?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/** Election event — surfaces as a Google Election rich result. */
export function electionJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Election",
    "@id": `${siteUrl}/governance-vote#election`,
    name: "OMNOM DAO Foundational Governance Election",
    description:
      "Vote on the voting math for all future OMNOM DAO proposals. Pick from linear, one-wallet-one-vote, tiered, or quadratic.",
    electionDate: "2026-08-29",
    startDate: "2026-08-29T00:00:00.000Z",
    endDate: "2026-09-12T00:00:00.000Z",
    votingMethod: ["LINEAR", "ONE_WALLET_ONE_VOTE", "TIERED", "QUADRATIC"],
    eligibleVoterCount: 25686,
    location: { "@type": "VirtualLocation", url: `${siteUrl}/governance-vote` },
    organizer: { "@id": `${siteUrl}/#organization` },
    candidate: [
      { "@type": "Option", name: "Linear (whale-weighted)" },
      { "@type": "Option", name: "One Wallet, One Vote (egalitarian)" },
      { "@type": "Option", name: "Tiered (capped stake-weighting)" },
      { "@type": "Option", name: "Quadratic (anti-plutocratic)" },
    ],
  };
}

/** FAQPage schema — surfaces FAQ rich snippets in Google. */
export function faqJsonLd(
  items: Array<{ question: string; answer: string }>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

/** BreadcrumbList — surfaces breadcrumbs in Google Search. */
export function breadcrumbJsonLd(
  siteUrl: string,
  crumbs: Array<{ name: string; path: string }>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path}`,
    })),
  };
}