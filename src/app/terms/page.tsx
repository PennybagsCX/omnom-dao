import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Advisory Governance, No Fiduciary Duty",
  description:
    "Terms governing use of the OMNOM DAO platform — advisory governance, no on-chain execution, no fiduciary duty. NSW Australia jurisdiction.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service · OMNOM DAO",
    description: "Terms governing use of the OMNOM DAO platform.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mb-10 text-base text-muted-foreground">
        Effective: 2026-08-27 · OMNOM DAO Core Team
      </p>

      <Section title="1. Scope">
        <p className="text-foreground/90">
          OMNOM DAO (the "Platform") is an off-chain, advisory governance
          platform for holders of the $OMNOM token. By using the Platform you
          agree to these terms. The Platform is open-source software provided
          as-is; nothing here constitutes investment, legal, or tax advice.
        </p>
      </Section>

      <Section title="2. Advisory, not binding">
        <p className="text-foreground/90">
          The Platform records ballots and tallies them. It does <strong>not</strong>{" "}
          execute any on-chain transactions. Outcomes of the Foundational
          Governance Election and any subsequent proposal are advisory
          recommendations to the protocol maintainers. The Platform makes no
          representation that any recommendation will be implemented.
        </p>
      </Section>

      <Section title="3. Eligibility">
        <p className="text-foreground/90">
          Eligibility to vote, propose, or comment is determined exclusively by
          the frozen snapshot at Dogechain block 59,922,100 (captured 2026-06-07).
          Wallets not present in the snapshot cannot participate regardless of
          their current $OMNOM balance.
        </p>
      </Section>

      <Section title="4. No fiduciary duty">
        <p className="text-foreground/90">
          The OMNOM DAO Core Team operates the Platform in a custodial capacity
          for the community. We owe no fiduciary duty to any individual user.
          We act in good faith on community consensus as expressed through the
          ballot record.
        </p>
      </Section>

      <Section title="5. Snapshot integrity">
        <p className="text-foreground/90">
          The snapshot artifact is published at SHA-256{" "}
          <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-gold">
            6cf2ea9f4bcf7cbbef067ad8b453027b1edbe59b2eefc3eaa9b82078b1ff980f
          </code>{" "}
          and is committed in the production database. Any future rebalance of
          the snapshot requires a supermajority ballot and is recorded in the
          audit log.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p className="text-foreground/90">
          You agree not to:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-foreground/90">
          <li>
            Use the Platform to harass, defraud, or impersonate any other
            holder.
          </li>
          <li>
            Attempt to manipulate the ballot record through coordinated
            vote-buying programs targeting eligible wallets.
          </li>
          <li>
            Submit proposals containing malware, phishing links, or content
            designed to extract private keys from other holders.
          </li>
          <li>
            Circumvent rate limits or attempt denial-of-service against the
            Platform or its dependencies.
          </li>
        </ul>
        <p className="mt-3 text-foreground/90">
          Violations may result in your wallet being flagged for admin review
          and proposals being removed from the public ledger.
        </p>
      </Section>

      <Section title="7. Disclaimers">
        <p className="text-foreground/90">
          The Platform is provided "as is" without warranty of any kind. The
          Core Team is not liable for any losses arising from Platform
          downtime, snapshot disputes, third-party wallet failures, or
          regulatory actions affecting $OMNOM in any jurisdiction.
        </p>
      </Section>

      <Section title="8. Governing law">
        <p className="text-foreground/90">
          These terms are governed by the laws of New South Wales, Australia.
          Disputes are subject to the exclusive jurisdiction of the courts of
          New South Wales.
        </p>
      </Section>

      <Section title="9. Contact">
        <p className="text-foreground/90">
          Questions about these terms:{" "}
          <a
            href="mailto:legal@omnom.dog"
            className="text-gold underline underline-offset-4 hover:text-gold/80"
          >
            legal@omnom.dog
          </a>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
      <div className="text-base leading-relaxed">{children}</div>
    </section>
  );
}