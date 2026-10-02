import type { Metadata } from "next";

/**
 * Private surface (settings) — behind auth and robots-disallowed; the
 * explicit noindex keeps URL-only indexing out of search results too.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
