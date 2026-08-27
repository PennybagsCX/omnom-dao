"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Bookmark,
  HelpCircle,
  ListChecks,
  PenLine,
  PlusCircle,
  Trophy,
  Vote,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { HolderBadge } from "@/components/shared/holder-badge";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CopyAddress } from "@/components/shared/copy-address";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { useDashboard, ApiRequestError } from "@/lib/api";
import { formatCompact, formatDate, timeAgo } from "@/lib/utils";
import { HOLDER_CLASS_CONFIG, SNAPSHOT } from "@/lib/constants";
import { ErrorCode, VoteChoice } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Holder dashboard (DESIGN.md §7.4).
 *
 * Renders profile card, 3-column stats row, voting activity, authored
 * proposals, and quick actions. Unauthenticated users see a "Connect Wallet"
 * CTA instead of the dashboard content.
 */
export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingSkeleton variant="dashboard" />
      </div>
    );
  }

  // Not in snapshot / session issues → friendly message + connect CTA.
  if (isError || !data) {
    const code = error instanceof ApiRequestError ? error.code : undefined;
    const notInSnapshot =
      code === ErrorCode.NOT_IN_SNAPSHOT || code === ErrorCode.USER_NOT_FOUND;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={
            notInSnapshot ? (
              <HelpCircle className="h-12 w-12" />
            ) : (
              <Wallet className="h-12 w-12" />
            )
          }
          title={notInSnapshot ? "Wallet not in snapshot" : "Connect your wallet"}
          description={
            notInSnapshot
              ? "This wallet isn't in the ever-held snapshot corpus, so there's no dashboard to show."
              : "Connect your wallet to access your dashboard."
          }
          action={
            notInSnapshot ? (
              <Button asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            ) : (
              <ConnectCta size="lg">Connect Wallet</ConnectCta>
            )
          }
        />
      </div>
    );
  }

  const { profile, recentVotes, authoredProposals, notifications } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {/* ── Profile card ─────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/10 text-3xl">
                {HOLDER_CLASS_CONFIG[profile.class].emoji}
              </div>
              <div className="min-w-0">
                <div className="mb-1.5">
                  <HolderBadge holderClass={profile.class} size="md" />
                </div>
                <h1 className="truncate text-xl font-bold text-foreground">
                  {profile.displayName}
                </h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <CopyAddress address={profile.address} />
                </div>
                <p className="mt-1 text-xs text-text-dim">
                  Member since {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Button asChild>
                <Link href="/proposals/create">
                  <PlusCircle className="h-4 w-4" aria-hidden /> Create Proposal
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/proposals">
                  <ListChecks className="h-4 w-4" aria-hidden /> All Proposals
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Stats row ────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Balance"
            value={formatCompact(profile.balanceFormatted)}
            subtitle="Frozen from snapshot"
            icon={<Wallet className="h-5 w-5" />}
            accent="gold"
          />
          <StatCard
            label="Rank"
            value={`#${profile.rank.toLocaleString()}`}
            subtitle={`of ${SNAPSHOT.totalHolders.toLocaleString()} holders`}
            icon={<Trophy className="h-5 w-5" />}
            accent="gold2"
          />
          <StatCard
            label="Voting Power"
            value={formatCompact(profile.votingPower)}
            subtitle="1 token = 1 vote"
            icon={<Zap className="h-5 w-5" />}
            accent="green"
          />
        </div>

        {/* ── Voting activity + authored proposals ─────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent votes */}
          <Card>
            <CardHeader className="items-center text-center space-y-0">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Vote className="h-4 w-4" aria-hidden /> Your Votes
              </CardTitle>
              {recentVotes.length > 0 && (
                <span className="font-mono text-xs text-text-dim">
                  {recentVotes.length} cast
                </span>
              )}
            </CardHeader>
            <CardContent>
              {recentVotes.length === 0 ? (
                <EmptyState
                  icon={<Vote className="h-12 w-12" />}
                  title="No votes yet"
                  description="Browse active proposals and cast your first vote."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/proposals">Browse Proposals</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recentVotes.slice(0, 6).map((vote) => (
                    <VoteRow key={vote.proposalId + vote.createdAt} vote={vote} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Authored proposals */}
          <Card>
            <CardHeader className="items-center text-center space-y-0">
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <PenLine className="h-4 w-4" aria-hidden /> Your Proposals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authoredProposals.length === 0 ? (
                <EmptyState
                  icon={<PenLine className="h-12 w-12" />}
                  title="No proposals authored"
                  description="Create your first governance proposal for the community."
                  action={
                    <Button asChild size="sm">
                      <Link href="/proposals/create">Create Proposal</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {authoredProposals.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/proposals/${p.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 py-3 transition-colors hover:text-gold focus-visible:outline-none"
                      >
                        <span className="line-clamp-1 text-sm font-medium">
                          {p.title}
                        </span>
                        <ProposalStatusBadge status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Notifications ────────────────────────────────── */}
        {notifications.recent.length > 0 && (
          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" aria-hidden /> Notifications
              </CardTitle>
              {notifications.unread > 0 && (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                  {notifications.unread} unread
                </span>
              )}
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {notifications.recent.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="line-clamp-1 text-foreground">{n.title}</span>
                    <span className="shrink-0 text-xs text-text-dim">
                      {timeAgo(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ── Bookmarks (v1 empty state) ───────────────────── */}
        <div className="mt-6">
          <h2 className="mb-3 block w-full text-center !text-center sm:!text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center justify-center gap-2 sm:justify-start">
              <Bookmark className="h-4 w-4 flex-shrink-0" aria-hidden /> 
              Bookmarked Proposals
            </span>
          </h2>
          <EmptyState
            icon={<Bookmark className="h-12 w-12" />}
            title="No bookmarks yet"
            description="Bookmark proposals to quickly return to them later."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/proposals">
                  Explore Proposals <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          />
        </div>
      </motion.div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

function VoteRow({
  vote,
}: {
  vote: { proposalId: string; choice: string; votingPower: number; createdAt: string };
}) {
  const cfg = VOTE_META[vote.choice as VoteChoice] ?? VOTE_META[VoteChoice.ABSTAIN];
  return (
    <li>
      <Link
        href={`/proposals/${vote.proposalId}`}
        className="flex min-h-11 items-center justify-between gap-3 py-3 transition-colors hover:text-gold focus-visible:outline-none"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`${cfg.text}`} aria-hidden>
            <DynamicIcon name={cfg.iconName} className="h-4 w-4" />
          </span>
          <span className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {vote.proposalId.slice(0, 8)}…
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
          <span className="font-mono text-xs text-text-dim">
            {formatCompact(vote.votingPower)} vp
          </span>
          <span className="text-xs text-text-dim">{timeAgo(vote.createdAt)}</span>
        </div>
      </Link>
    </li>
  );
}

const VOTE_META: Record<VoteChoice, { iconName: string; label: string; text: string }> = {
  [VoteChoice.FOR]: { iconName: "Check", label: "For", text: "text-success" },
  [VoteChoice.AGAINST]: { iconName: "X", label: "Against", text: "text-danger" },
  [VoteChoice.ABSTAIN]: { iconName: "Minus", label: "Abstain", text: "text-muted-foreground" },
};
