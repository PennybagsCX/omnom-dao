import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/components/seo/json-ld";
import { SNAPSHOT } from "@/lib/constants";

import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
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
