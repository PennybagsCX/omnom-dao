import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
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
    default: "$OMNOM DAO — Community Governance",
    template: "%s · $OMNOM DAO",
  },
  description:
    "Off-chain, snapshot-based governance for $OMNOM token holders. Connect your wallet, verify your holdings, and vote on what happens next.",
  applicationName: "$OMNOM DAO",
  keywords: ["OMNOM", "DAO", "governance", "Dogechain", "snapshot", "SIWE"],
  authors: [{ name: "OMNOM DAO Core Team" }],
  openGraph: {
    title: "$OMNOM DAO — Community Governance",
    description: "Snapshot-based governance for $OMNOM token holders.",
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "$OMNOM DAO — Community Governance",
    description: "Snapshot-based governance for $OMNOM | token holders.",
  },
  robots: { index: true, follow: true },
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
