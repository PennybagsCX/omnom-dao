import type { Metadata } from "next";

/**
 * /verify/result is a transient post-signature callback page (wallet verify
 * pipeline lands here for a moment, then routes onward). It must never be
 * indexed or served as a canonical destination.
 */
export const metadata: Metadata = {
  title: "Verifying wallet",
  robots: { index: false, follow: false },
  alternates: { canonical: "/verify/result" },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
