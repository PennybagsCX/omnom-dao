import type { Metadata } from "next";

/**
 * Private surface (admin) — behind auth and robots-disallowed; the explicit
 * noindex keeps URL-only indexing out of search results too.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
