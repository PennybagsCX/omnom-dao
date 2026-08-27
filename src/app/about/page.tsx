import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About OMNOM DAO — Mission, Team & Tech",
  description:
    "OMNOM DAO is an off-chain, snapshot-based governance platform for $OMNOM holders, anchored to Dogechain block 59,922,100.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About OMNOM DAO",
    description: "Off-chain, snapshot-based governance for $OMNOM token holders.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        About OMNOM DAO
      </h1>
      <p className="mb-8 text-base text-muted-foreground">
        An off-chain, snapshot-anchored governance platform for the $OMNOM community.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-foreground">Mission</h2>
        <p className="text-base leading-relaxed text-foreground/90">
          OMNOM DAO exists to give every verified $OMNOM holder a credible voice
          in how the protocol evolves — without requiring on-chain execution, gas
          fees, or trusting a multisig. The platform records ballots off-chain
          against a <strong>frozen, cryptographically-pinned snapshot</strong> of
          historical Dogechain holdings (block 59,922,100, captured 2026-06-07).
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-foreground">Why off-chain</h2>
        <p className="text-base leading-relaxed text-foreground/90">
          Dogechain (where $OMNOM was issued) is no longer actively maintained. We
          could not deploy a Governor contract that holders could meaningfully
          call. Off-chain governance anchored to an immutable snapshot preserves
          the legitimacy of the vote while remaining auditable: every ballot is
          signed (SIWE), tied to a snapshot-verified holder address, and stored
          in a public append-only ledger.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-foreground">How it works</h2>
        <ol className="list-decimal space-y-2 pl-6 text-base leading-relaxed text-foreground/90">
          <li>
            <strong>Connect a wallet</strong> via RainbowKit (MetaMask, Rabby, Brave,
            WalletConnect).
          </li>
          <li>
            <strong>Sign in with Ethereum (SIWE, EIP-4361)</strong> — proves wallet
            control without revealing the private key.
          </li>
          <li>
            <strong>Verify eligibility</strong> — the server looks up your address
            in <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-sm text-gold">holders.json</code>{" "}
            (25,686 wallets, SHA-256 pinned) and assigns your tier
            (Kraken → Seahorse).
          </li>
          <li>
            <strong>Vote</strong> — every ballot is one-wallet-one-vote for the
            Foundational Election, then tier-weighted for future proposals
            (depending on the winning math).
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-foreground">Open source</h2>
        <p className="text-base leading-relaxed text-foreground/90">
          The full source code is public at{" "}
          <a
            href="https://github.com/PennybagsCX/omnom-dao"
            className="text-gold underline underline-offset-4 hover:text-gold/80"
            rel="noopener noreferrer"
          >
            github.com/PennybagsCX/omnom-dao
          </a>
          . No closed-source components, no telemetry beyond Vercel Analytics,
          no off-chain vote-buying oracles.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-foreground">Team</h2>
        <p className="text-base leading-relaxed text-foreground/90">
          Built and maintained by the OMNOM DAO Core Team. Anonymous-by-default;
          admin operations are gated by a single multisig-ready admin address
          (<code className="rounded bg-bg-elevated px-1.5 py-0.5 text-sm text-gold">0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a</code>)
          and every admin action is logged in a public audit table.
        </p>
      </section>

      <section className="mb-10 rounded-xl border border-border bg-bg-elevated/40 p-6">
        <h2 className="mb-3 text-xl font-semibold text-foreground">Get involved</h2>
        <ul className="space-y-2 text-base text-foreground/90">
          <li>
            <Link href="/governance-vote" className="text-gold hover:text-gold/80">
              Vote in the Foundational Governance Election →
            </Link>
          </li>
          <li>
            <Link href="/snapshot-explorer" className="text-gold hover:text-gold/80">
              Verify your snapshot eligibility →
            </Link>
          </li>
          <li>
            <Link href="/faq" className="text-gold hover:text-gold/80">
              Read the FAQ →
            </Link>
          </li>
          <li>
            <Link href="/contact" className="text-gold hover:text-gold/80">
              Contact the team →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}