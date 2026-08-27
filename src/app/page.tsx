"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CircleDot,
  ClipboardList,
  Wallet,
  Vote,
  Search,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { HolderStatsBar } from "@/components/shared/holder-stats-bar";
import { ProposalCard } from "@/components/shared/proposal-card";
import { ProposalRow } from "@/components/shared/proposal-row";
import { EmptyState } from "@/components/shared/empty-state";
import type { ReactNode } from "react";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { useProposals, useCurrentUser } from "@/lib/api";
import { ProposalStatus } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

const HOW_IT_WORKS: ReadonlyArray<{
  step: string;
  title: string;
  desc: string;
  icon: typeof Wallet;
}> = [
  {
    step: "1",
    title: "Connect & Verify",
    desc: "Connect any EVM wallet and sign a free, gas-less message to prove your holdings.",
    icon: Wallet,
  },
  {
    step: "2",
    title: "View Proposals",
    desc: "Browse active and past governance proposals, read the details, and join the discussion.",
    icon: Search,
  },
  {
    step: "3",
    title: "Vote & Govern",
    desc: "Cast your vote on proposals that matter — chain migration, tokenomics, community decisions, and more.",
    icon: Vote,
  },
];

/**
 * Landing page (DESIGN.md §7.1).
 *
 * Hero → snapshot stats bar → how-it-works → active proposals preview →
 * recent proposals → footer CTA. Fully animated with framer-motion and
 * responsive from 320px up.
 */
export default function HomePage() {
  const { data: me } = useCurrentUser({ retry: false });
  const isAuthenticated = Boolean(me);

  const {
    data: activeData,
    isLoading: activeLoading,
    isError: activeError,
  } = useProposals({ status: ProposalStatus.ACTIVE, sortBy: "votingEndsAt", sortOrder: "asc", limit: 3 });
  const {
    data: recentData,
    isLoading: recentLoading,
    isError: recentError,
  } = useProposals({ sortBy: "createdAt", sortOrder: "desc", limit: 5 });

  const activeProposals = activeData?.proposals ?? [];
  const recentProposals = (recentData?.proposals ?? []).filter(
    (p) => p.status !== ProposalStatus.DRAFT,
  );

  // If a query errored (e.g. DB unavailable), don't leave the skeleton spinning
  // — treat it as "no data" so the section degrades gracefully.
  const showActiveSkeleton = activeLoading && !activeError;
  const showRecentSkeleton = recentLoading && !recentError;

  return (
    <div className="relative">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-bg-elevated via-bg-deep to-bg-deep"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 lg:px-8">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden />
          Off-chain · Snapshot-based · No gas fees
        </motion.span>

<motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
          className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl"
        >
          Your voice. Your <span className="text-gold">$OMNOM</span>. Your DAO.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
          className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-xl"
        >
          Community governance for $OMNOM token holders. Verify your snapshot
          holdings, vote on proposals, and have a real say in what happens
          next — all off-chain, no gas required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease: EASE }}
          className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
        >
          {isAuthenticated ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <ConnectCta size="lg" className="w-full sm:w-auto">
              Connect Wallet
            </ConnectCta>
          )}
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="/proposals">
              <Vote className="h-4 w-4" aria-hidden /> View Proposals
            </Link>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text-dim"
        >
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden /> Read-only
          </span>
          <span>·</span>
          <span>Any EVM wallet</span>
          <span>·</span>
          <span>Voting model TBD by community</span>
        </motion.p>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <HolderStatsBar />
        </motion.div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Govern in three simple steps"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45, ease: EASE }}
              className="relative flex flex-col items-center rounded-xl border border-border bg-bg-surface/60 p-6 text-center backdrop-blur-sm transition-colors hover:border-border"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Active proposals preview ───────────────────────── */}
      {showActiveSkeleton ? (
        <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Live now"
            title={
              <>
                <CircleDot className="mr-1.5 inline h-4 w-4 align-[-2px] text-emerald-400" /> Active Proposals
              </>
            }
          />
          <LoadingSkeleton variant="card" count={3} />
        </section>
      ) : activeProposals.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-6 text-center">
            <SectionHeading
              eyebrow="Live now"
              title={
                <>
                  <CircleDot className="mr-1.5 inline h-4 w-4 align-[-2px] text-emerald-400" /> Active Proposals
                </>
              }
            />
            <div className="mt-2">
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/proposals">
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Recent proposals — Direction C: editorial hybrid ─── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <SectionHeading
            eyebrow="History"
            title={
              <>
                <ClipboardList className="mr-1.5 inline h-4 w-4 align-[-2px]" /> Recent Proposals
              </>
            }
          />
          {recentProposals.length > 0 && (
            <div className="mt-2">
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/proposals">
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {showRecentSkeleton ? (
          /* Two skeletons: one card-sized block + rows beneath it */
          <div className="space-y-3">
            <LoadingSkeleton variant="card" count={1} />
            <LoadingSkeleton variant="rows" count={4} />
          </div>
        ) : recentProposals.length > 0 ? (
          <div className="space-y-3">
            {/* Featured: newest proposal as a full card */}
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-text-dim">Newest</p>
              <ProposalCard proposal={recentProposals[0]} />
            </div>
            {/* Remaining proposals as compact rows */}
            {recentProposals.length > 1 && (
              <div className="overflow-hidden rounded-lg border border-border bg-bg-surface/40">
                {recentProposals.slice(1, 5).map((p) => (
                  <ProposalRow key={p.id} proposal={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-12 w-12" />}
            title="No proposals yet"
            description="Be the first to create a governance proposal for the $OMNOM community."
            action={
              <Button asChild size="sm">
                <Link href="/proposals/create">
                  <Vote className="h-4 w-4" aria-hidden /> Create a Proposal
                </Link>
              </Button>
            }
          />
        )}
      </section>

      {/* ── Footer CTA ─────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-8 text-center sm:p-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl"
          />
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to have your say?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Connect your wallet, verify your snapshot holdings, and start voting
            on the future of $OMNOM. It{"'"}s free and takes under a minute.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Button asChild size="lg">
                <Link href="/proposals">
                  Start Voting <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <ConnectCta size="lg">Connect Wallet & Vote</ConnectCta>
            )}
            <Button asChild size="lg" variant="outline">
              <Link href="/proposals">Browse Proposals</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

/* ── Heading helpers ────────────────────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  inline = false,
}: {
  eyebrow: string;
  title: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "mb-6"}>
      <p className="text-xs font-medium uppercase tracking-widest text-gold/80 text-center">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl text-center">{title}</h2>
    </div>
  );
}
