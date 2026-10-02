import type { Metadata } from "next";

/**
 * Private surface (notifications) — behind auth and robots-disallowed; the
 * explicit noindex keeps URL-only indexing out of search results too.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
