"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  HelpCircle,
  Home,
  ExternalLink,
  MessageCircle,
  Search,
  ShieldCheck,
  Vote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HolderBadge } from "@/components/shared/holder-badge";
import { CopyAddress } from "@/components/shared/copy-address";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useCurrentUser, ApiRequestError } from "@/lib/api";
import { SNAPSHOT } from "@/lib/constants";
import { formatCompact } from "@/lib/utils";
import { ErrorCode } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Verification result page (DESIGN.md §7.3).
 *
 * Reads the authenticated user from GET /api/v1/me and renders:
 *   - Loading: skeleton of the result card.
 *   - Success: green check, holder class badge, balance, rank, voting power.
 *   - Not found: the wallet isn't in the snapshot — guidance + help links.
 *   - Unauthorized: bounces the user back to connect.
 */
export default function VerifyResultPage() {
  const router = useRouter();
  const { data, isLoading, isError, error } = useCurrentUser();

  // If the user isn't authenticated at all, send them to the landing page.
  useEffect(() => {
    if (isError && error instanceof ApiRequestError && error.status === 401) {
      router.replace("/?login=1&next=/verify/result");
    }
  }, [isError, error, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  const notFound =
    isError &&
    error instanceof ApiRequestError &&
    (error.code === ErrorCode.NOT_IN_SNAPSHOT ||
      error.code === ErrorCode.USER_NOT_FOUND ||
      error.status === 404);

  if (notFound) {
    return <NotFoundState />;
  }

  if (isError || !data) {
    return <ErrorState />;
  }

  return <SuccessState data={data} />;
}

/* ── Success ────────────────────────────────────────────────── */

function SuccessState({
  data,
}: {
  data: {
    address: string;
    balanceFormatted: string;
    rank: number;
    votingPower: number;
    class: import("@/types").HolderClass;
    displayName: string;
    createdAt: string;
  };
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <Card className="overflow-hidden border-success/30">
          <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-success/10 to-transparent px-6 pb-2 pt-10 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/10"
            >
              <ShieldCheck className="h-11 w-11 text-success" aria-hidden />
            </motion.div>
            <h1 className="text-2xl font-bold text-success">You{"'"}re verified!</h1>
            <p className="text-sm text-muted-foreground">
              Your snapshot holdings are confirmed.
            </p>
            <HolderBadge holderClass={data.class} size="lg" />
          </div>

          <CardContent className="px-6 pb-6 pt-4">
            <dl className="divide-y divide-border rounded-lg border border-border bg-bg-elevated/40">
              <DataRow label="Wallet">
                <CopyAddress address={data.address} />
              </DataRow>
              <DataRow label="Display Name">
                <span className="font-medium text-foreground">{data.displayName}</span>
              </DataRow>
              <DataRow label="Balance">
                <span className="font-mono font-semibold text-foreground">
                  {formatCompact(data.balanceFormatted)} OMNOM
                </span>
              </DataRow>
              <DataRow label="Rank">
                <span className="font-mono font-semibold text-foreground">
                  #{data.rank.toLocaleString()} of {SNAPSHOT.totalHolders.toLocaleString()}
                </span>
              </DataRow>
              <DataRow label="Voting Power">
                <span className="font-mono font-semibold text-gold">
                  {formatCompact(data.votingPower)}
                </span>
              </DataRow>
            </dl>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1 h-12 sm:h-auto sm:px-6">
                <Link href="/dashboard">
                  <Home className="h-4 w-4" aria-hidden /> Go to Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 h-12 sm:h-auto sm:px-6">
                <Link href="/proposals">
                  <Vote className="h-4 w-4" aria-hidden /> View Proposals
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-text-dim">
              Snapshot · Block {SNAPSHOT.blockNumber.toLocaleString()} ·{" "}
              {new Date(SNAPSHOT.timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              . Holdings are drawn from the ever-held snapshot corpus.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ── Not found ──────────────────────────────────────────────── */

function NotFoundState() {
  const items: ReadonlyArray<{ label: string; href: string; icon: React.ReactNode; external?: boolean }> = [
    {
      label: "Try Another Wallet",
      href: "/?login=1",
      icon: <ArrowRightLeft className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Blockscout Explorer",
      href: "https://github.com/DBOT-DC/omnom-snapshot",
      icon: <Search className="h-4 w-4" aria-hidden />,
      external: true,
    },
    {
      label: "Get Help on Telegram",
      href: "https://t.me/omnomtoken_dc",
      icon: <MessageCircle className="h-4 w-4" aria-hidden />,
      external: true,
    },
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
            <HelpCircle className="h-11 w-11 text-warning" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold">We couldn{"'"}t find this wallet</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            This wallet address was not found in the $OMNOM holder snapshot
            taken on{" "}
            <span className="font-medium text-foreground">
              June 7, 2026 (Block {SNAPSHOT.blockNumber.toLocaleString()})
            </span>
            .
          </p>

          <div className="w-full rounded-lg border border-border bg-bg-elevated/40 p-4 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-dim">
              Possible reasons
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>You acquired $OMNOM after the snapshot date.</li>
              <li>You{"'"}re using a different wallet address.</li>
              <li>Your tokens were on an exchange (not counted in the snapshot).</li>
            </ul>
          </div>

          <div className="mt-2 flex w-full flex-col gap-2">
            {items.map((it) => (
              <Button
                key={it.label}
                asChild
                variant="outline"
                className="justify-between"
              >
                <Link
                  href={it.href}
                  {...(it.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <span className="inline-flex items-center gap-2">
                    {it.icon}
                    {it.label}
                  </span>
                  {it.external ? (
                    <ExternalLink className="h-4 w-4 text-text-dim" aria-hidden />
                  ) : null}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Generic error ──────────────────────────────────────────── */

function ErrorState() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
            <AlertTriangle className="h-9 w-9 text-danger" aria-hidden />
          </div>
          <h1 className="text-xl font-bold">Verification failed</h1>
          <p className="text-sm text-muted-foreground">
            We couldn{"'"}t complete the verification. Please try again.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/">
                <MessageCircle className="h-4 w-4" aria-hidden /> Back to Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
