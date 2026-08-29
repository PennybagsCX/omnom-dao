import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/seo/json-ld";
import { SNAPSHOT } from "@/lib/constants";

import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next";

/**
 * Self-hosted Inter + JetBrains Mono (latin subset, weights 400/500/600/700).
 *
 * Why local instead of `next/font/google`:
 *   - Air-gapped / restricted networks: builds and `next dev` would otherwise
 *     fail to download Google Fonts at runtime (or hang on the first request).
 *   - Production consistency: avoids the surprise of an OCR page falling back
 *     to Arial/SF Mono on a different deploy environment.
 *
 * Files live under `public/fonts/{inter,jetbrains-mono}/`. Sourced from
 * @fontsource (a re-bundled, versioned mirror of the Google Fonts files) so
 * the project doesn't take a runtime dependency on Google's CDN.
 */
const inter = localFont({
  src: [
    { path: "../../public/fonts/inter/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/inter/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/inter/inter-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/inter/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  // Skip preload hints — most pages only use weight 700 (the timer + stat
  // values). Preloading weight 600 produced a noisy "preloaded but not used"
  // console warning in Chrome when it sat idle past the load event.
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OMNOM DAO — Foundational Governance Election",
    template: "%s · OMNOM DAO",
  },
  description:
    "Off-chain governance for $OMNOM. 25,686 eligible wallets vote on the voting math (Aug 29–Sep 12, 2026). Gasless, verifiable.",
  applicationName: "OMNOM DAO",
  keywords: [
    "OMNOM", "DAO", "governance", "Dogechain", "snapshot",
    "SIWE", "election", "FGE", "foundational", "voting",
    "wallet", "proposal",
  ],
  authors: [{ name: "OMNOM DAO Core Team" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OMNOM DAO — Foundational Governance Election",
    description:
      "Off-chain governance for $OMNOM. 25,686 eligible wallets vote on the voting math. Gasless, verifiable.",
    type: "website",
    url: siteUrl,
    siteName: "OMNOM DAO",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMNOM DAO — Foundational Governance Election",
    description:
      "Off-chain governance for $OMNOM. 25,686 eligible wallets vote on the voting math. Gasless, verifiable.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <JsonLd data={[organizationJsonLd(siteUrl), websiteJsonLd(siteUrl)]} />
      </head>
      <body className="min-h-screen bg-bg-deep font-sans text-foreground antialiased">
        <Providers>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <div className="relative flex min-h-screen w-full max-w-full flex-col overflow-x-clip">
            <SiteHeader />
            <main id="main-content" className="w-full max-w-full flex-1 overflow-x-clip pt-16 pb-16 md:pb-0">
              {children}
            </main>
            <SiteFooter />
            <BottomNav />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

// Re-export for tooling that introspects provenance.
export { SNAPSHOT };
