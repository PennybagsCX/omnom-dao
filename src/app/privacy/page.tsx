import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — How OMNOM DAO Handles Your Data",
  description:
    "How OMNOM DAO collects, stores, and uses data — SIWE messages, JWT sessions, IP addresses, and analytics. GDPR-aligned.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy · OMNOM DAO",
    description: "How OMNOM DAO collects, stores, and uses data.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mb-2 text-base text-muted-foreground">
        Effective: 2026-08-27 · OMNOM DAO Core Team
      </p>
      <p className="mb-10 text-sm text-muted-foreground">
        This policy explains what data OMNOM DAO collects, why, and how long we
        keep it. The short version: we collect the minimum necessary to verify
        your snapshot eligibility and record your ballot; we never sell data; we
        delete what we don't need.
      </p>

      <Section title="1. What we collect">
        <ul className="list-disc space-y-2 pl-6 text-foreground/90">
          <li>
            <strong>SIWE message & signature</strong> — proves wallet control.
            The signed message includes your wallet address, the OMNOM DAO
            domain, an ISO-8601 timestamp, and a one-time nonce.
          </li>
          <li>
            <strong>Wallet address</strong> — used to look up your snapshot
            eligibility and record your ballot. Held for the life of the DAO.
          </li>
          <li>
            <strong>JWT session token</strong> — issued after a successful SIWE
            verify, stored in an HTTP-only Secure cookie. Expires after 8 hours.
          </li>
          <li>
            <strong>IP address</strong> — used for rate-limit counters
            (Vercel KV). Hashed before being stored as a key; never stored raw
            beyond the rolling 5-minute window.
          </li>
          <li>
            <strong>Vercel Analytics</strong> — anonymous page-view aggregates
            (no cookies, no cross-site tracking). Opt-out by disabling
            JavaScript.
          </li>
        </ul>
      </Section>

      <Section title="2. What we do NOT collect">
        <ul className="list-disc space-y-2 pl-6 text-foreground/90">
          <li>No private keys, no seed phrases, no signing material.</li>
          <li>No email addresses, no phone numbers, no names.</li>
          <li>No third-party trackers, no Google Analytics, no Facebook Pixel.</li>
          <li>No fingerprinting, no device-level identifiers.</li>
        </ul>
      </Section>

      <Section title="3. How we use it">
        <p className="text-foreground/90">
          Wallet address + SIWE signature → snapshot lookup → tier assignment →
          JWT session. The JWT is then used to authenticate subsequent ballot
          submissions, comment posting, and proposal creation. Ballots and
          comments are stored in a public ledger so other holders can verify
          turnout and outcomes.
        </p>
      </Section>

      <Section title="4. Cookies">
        <p className="text-foreground/90">
          We set one cookie: <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-sm text-gold">omnom_session</code>{" "}
          (HTTP-only, Secure, SameSite=Lax, 8-hour TTL). It contains a signed JWT
          and nothing else. No analytics cookies, no advertising cookies.
        </p>
      </Section>

      <Section title="5. Third parties">
        <ul className="list-disc space-y-2 pl-6 text-foreground/90">
          <li>
            <strong>Vercel</strong> — hosting. Privacy:
            https://vercel.com/legal/privacy-policy
          </li>
          <li>
            <strong>Turso (libSQL)</strong> — database. Privacy:
            https://turso.tech/privacy
          </li>
          <li>
            <strong>Upstash (Redis)</strong> — rate limiting. Privacy:
            https://upstash.com/privacy
          </li>
          <li>
            <strong>WalletConnect Cloud</strong> — optional, only if you use a
            WalletConnect-relayed wallet. Privacy:
            https://walletconnect.com/privacy
          </li>
        </ul>
        <p className="mt-3 text-foreground/90">
          None of these vendors receive your wallet address or ballot content.
          The wallet address is stored only in our own database (Turso).
        </p>
      </Section>

      <Section title="6. Data retention">
        <ul className="list-disc space-y-2 pl-6 text-foreground/90">
          <li>SIWE messages: 90 days (then deleted; used only for replay-attack forensics).</li>
          <li>JWT session cookies: 8 hours (TTL).</li>
          <li>Ballot events: permanent (public append-only ledger).</li>
          <li>Comments: permanent (public append-only ledger).</li>
          <li>Audit log of admin actions: permanent.</li>
        </ul>
      </Section>

      <Section title="7. Your rights">
        <p className="text-foreground/90">
          You can request export or deletion of any non-public data by emailing{" "}
          <a
            href="mailto:privacy@omnom.dog"
            className="text-gold underline underline-offset-4 hover:text-gold/80"
          >
            privacy@omnom.dog
          </a>
          . We respond within 30 days. Public ballot and comment records are
          append-only and cannot be edited (but your future ballots can override
          past ones).
        </p>
      </Section>

      <Section title="8. Changes to this policy">
        <p className="text-foreground/90">
          Material changes are announced in-app and on the official X account
          (linked from <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-sm text-gold">/brand</code>)
          at least 14 days before they take effect.
        </p>
      </Section>

      <p className="mt-10 text-sm text-muted-foreground">
        Questions?{" "}
        <a
          href="mailto:privacy@omnom.dog"
          className="text-gold underline underline-offset-4 hover:text-gold/80"
        >
          privacy@omnom.dog
        </a>
      </p>
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