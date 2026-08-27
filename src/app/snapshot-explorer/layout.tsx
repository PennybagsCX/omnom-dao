import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify $OMNOM Holdings",
  description:
    "Verify your $OMNOM wallet holdings against the frozen Dogechain snapshot (block 59,922,100, captured 2026-06-07). 25,686 eligible wallets.",
  alternates: { canonical: "/snapshot-explorer" },
  openGraph: {
    title: "Verify $OMNOM Holdings · OMNOM DAO",
    description:
      "Verify your $OMNOM wallet against the frozen snapshot. 25,686 eligible wallets.",
    url: "/snapshot-explorer",
  },
};

export default function SnapshotExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}