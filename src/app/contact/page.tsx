import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact OMNOM DAO — Security, Support & Press",
  description:
    "Reach the OMNOM DAO team for security disclosures, support, partnerships, or press inquiries. PGP key + response SLAs documented.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact · OMNOM DAO",
    description: "Get in touch with the OMNOM DAO team.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Contact
      </h1>
      <p className="mb-10 text-base text-muted-foreground">
        Reach the OMNOM DAO team. Pick the channel that matches your inquiry.
      </p>

      <div className="space-y-6">
        <ContactCard
          heading="Security disclosures"
          detail="Found a vulnerability? Please email us directly — we acknowledge within 24 hours and triage within 72."
          primary="security@omnom.dog"
          primaryLabel="security@omnom.dog"
          note="PGP key: posted at github.com/PennybagsCX/omnom-dao/SECURITY.md"
        />

        <ContactCard
          heading="General support"
          detail="Can't sign in, ballot didn't record, snapshot mismatch? Send wallet address + browser, no private keys."
          primary="support@omnom.dog"
          primaryLabel="support@omnom.dog"
        />

        <ContactCard
          heading="Partnerships & integration"
          detail="Wallets, custodians, or analytics platforms wanting to integrate OMNOM DAO ballots."
          primary="partnerships@omnom.dog"
          primaryLabel="partnerships@omnom.dog"
        />

        <ContactCard
          heading="Press & media"
          detail="Logos, brand assets, and verified statistics for the Foundational Election."
          primary="press@omnom.dog"
          primaryLabel="press@omnom.dog"
          extra={
            <Link
              href="/brand"
              className="text-sm text-gold underline underline-offset-4 hover:text-gold/80"
            >
              See the press kit →
            </Link>
          }
        />

        <ContactCard
          heading="GitHub"
          detail="File a bug, request a feature, or read the source."
          primary="github.com/PennybagsCX/omnom-dao"
          primaryLabel="github.com/PennybagsCX/omnom-dao"
          isExternal
        />

        <ContactCard
          heading="Mailing address"
          detail="For legal correspondence and DMCA notices."
          primary="OMNOM DAO Core Team"
          primaryLabel="DMCA / Legal"
          note="c/o Spaceship · PO Box 1234 · Sydney NSW 2000 · Australia"
        />
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Response SLAs: security disclosures within 24 hours, all other inquiries
        within 5 business days. We do not provide phone support.
      </p>
    </div>
  );
}

function ContactCard({
  heading,
  detail,
  primary,
  primaryLabel,
  note,
  extra,
  isExternal,
}: {
  heading: string;
  detail: string;
  primary: string;
  primaryLabel: string;
  note?: string;
  extra?: React.ReactNode;
  isExternal?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/40 p-5">
      <h2 className="mb-1 text-lg font-semibold text-foreground">{heading}</h2>
      <p className="mb-3 text-sm text-foreground/80">{detail}</p>
      {isExternal ? (
        <a
          href={`https://${primary}`}
          rel="noopener noreferrer"
          className="block font-mono text-sm text-gold underline underline-offset-4 hover:text-gold/80"
        >
          {primaryLabel}
        </a>
      ) : (
        <a
          href={`mailto:${primary}`}
          className="block font-mono text-sm text-gold underline underline-offset-4 hover:text-gold/80"
        >
          {primaryLabel}
        </a>
      )}
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}