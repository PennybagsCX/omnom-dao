"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  PenLine,
  Scale,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { CommentsSection } from "@/components/shared/comments-section";
import { EmojiReactionsBar } from "@/components/shared/emoji-reactions/emoji-reactions-bar";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { HolderBadge } from "@/components/shared/holder-badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Markdown } from "@/components/shared/markdown";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { ProposalTypeBadge } from "@/components/shared/proposal-type-badge";
import { QuorumProgress } from "@/components/shared/quorum-progress";
import { VoteBar } from "@/components/shared/vote-bar";
import { AdminRejectionBanner } from "@/components/proposals/admin-rejection-banner";
import {
  useCastVote,
  useChangeVote,
  useCreateComment,
  useToggleReaction,
  useToggleCommentEmojiReaction,
  useCurrentUser,
  useProposalDetail,
  type ProposalDetailData,
} from "@/lib/api";
import {
  formatCompact,
  formatDate,
  formatDateTime,
  shortenAddress,
} from "@/lib/utils";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { ConnectCta } from "@/components/wallet/connect-cta";
import {
  ErrorCode,
  ProposalStatus,
  VoteChoice,
  type Proposal,
  type ProposalComment,
} from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Proposal detail page (DESIGN.md §7.6).
 *
 * Public read; voting/commenting requires auth. Sticky vote panel on desktop
 * (right sidebar, CSS sticky), sticky bottom bar on mobile. Renders the
 * markdown body, vote breakdown + quorum, lifecycle timeline, and threaded
 * comments.
 */
export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalId = params.id;

  const { data, isLoading, isError, error } = useProposalDetail(proposalId);
  const { data: me } = useCurrentUser({ retry: false });
  const castVote = useCastVote(proposalId);
  const changeVote = useChangeVote(proposalId);
  const createComment = useCreateComment(proposalId);
  const toggleReaction = useToggleReaction(proposalId);
  const toggleCommentEmoji = useToggleCommentEmojiReaction(proposalId);

  // Track the user's vote. The detail payload now includes the current user's
  // ballot (C2.1) so returning voters see their choice on load; we also update
  // it optimistically after a successful cast.
  const [myVote, setMyVote] = useState<VoteChoice | null>(
    () => data?.myVote?.choice ?? null,
  );
  const [prevServerChoice, setPrevServerChoice] = useState(data?.myVote?.choice);

  // Keep local state in sync if the API result changes (e.g. refetch, navigation).
  // Uses the "adjust state during render" pattern recommended by the React team
  // to avoid setState-in-effect cascading renders.
  const serverChoice = data?.myVote?.choice;
  if (serverChoice !== prevServerChoice) {
    setPrevServerChoice(serverChoice);
    setMyVote(serverChoice ?? null);
  }

  const onVote = useCallback(
    async (choice: VoteChoice) => {
      try {
        await castVote.mutateAsync(choice);
        setMyVote(choice);
      } catch {
        // toast surfaced by the mutation hook; keep button state clean.
      }
    },
    [castVote],
  );

  const onChangeVote = useCallback(
    async (choice: VoteChoice) => {
      try {
        await changeVote.mutateAsync(choice);
        setMyVote(choice);
      } catch {
        // toast surfaced by the mutation hook.
      }
    },
    [changeVote],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (isError || !data) {
    const notFound =
      error && "code" in error && error.code === ErrorCode.PROPOSAL_NOT_FOUND;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={
            notFound ? (
              <HelpCircle className="h-12 w-12" />
            ) : (
              <AlertTriangle className="h-12 w-12" />
            )
          }
          title={notFound ? "Proposal not found" : "Couldn't load proposal"}
          description={
            notFound
              ? "This proposal may have been removed or never existed."
              : "Something went wrong. Please try again."
          }
          action={
            <Button asChild>
              <Link href="/proposals">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Proposals
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { proposal, votes, voterCount, comments } = data;
  const isActive = proposal.status === ProposalStatus.ACTIVE;
  const isClosed = [
    ProposalStatus.PASSED,
    ProposalStatus.FAILED,
    ProposalStatus.EXPIRED,
    ProposalStatus.CLOSED,
  ].includes(proposal.status);
  const totalVotes = votes.totalFor + votes.totalAgainst + votes.totalAbstain;
  // Quorum achieved = (total votes) / total supply % — we don't have total supply
  // client-side, so derive from proposal.quorumRequired vs. the bar. We pass the
  // proposal's recorded quorum fields when available.
  const quorumAchieved = proposal.quorumAchieved ?? 0;
  const userVoted = myVote !== null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/proposals">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All Proposals
        </Link>
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]"
      >
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {/* Header */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ProposalStatusBadge status={proposal.status} pulse={isActive} />
                <ProposalTypeBadge type={proposal.type} />
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {proposal.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <PenLine className="h-3.5 w-3.5" aria-hidden />
                  <Link
                    href={`/snapshot-explorer?address=${proposal.authorAddress.toLowerCase()}`}
                    title={proposal.authorAddress}
                    className="font-mono underline-offset-2 hover:underline hover:text-foreground"
                  >
                    {shortenAddress(proposal.authorAddress)}
                  </Link>
                  {proposal.authorHolderClass && (
                    <HolderBadge holderClass={proposal.authorHolderClass} size="sm" plain />
                  )}
                </span>
                <span className="text-text-dim">·</span>
                <span>{formatDate(proposal.createdAt)}</span>
                <span className="text-text-dim">·</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  {comments.filter((c) => !c.deletedAt).length} comments
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Rejection Banner */}
          {proposal.status === ProposalStatus.FAILED && (
            <AdminRejectionBanner proposal={proposal} />
          )}

          {/* Body */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
                <FileText className="h-4 w-4" aria-hidden /> Proposal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{proposal.description}</Markdown>

              {/* Emoji reactions on the proposal itself (separate from up/down
                  arrows on comments). */}
              <div className="mt-6 border-t border-border pt-4">
                <EmojiReactionsBar
                  surface="proposal"
                  proposalId={proposal.id}
                  emojiReactionCounts={proposal.emojiReactionCounts}
                  myEmojiReaction={proposal.myEmojiReaction}
                  isAuthenticated={Boolean(me)}
                />
              </div>

              {/* Parameters */}
              <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center text-sm sm:grid-cols-4">
                <Param label="Quorum" value={`${proposal.quorumRequired}%`} />
                <Param
                  label="Quorum reached"
                  value={
                    proposal.quorumAchieved != null
                      ? `${proposal.quorumAchieved.toFixed(1)}%`
                      : "—"
                  }
                />
                <Param
                  label="Voting ends"
                  value={
                    proposal.votingEndsAt ? formatDateTime(proposal.votingEndsAt) : "—"
                  }
                />
                <Param label="Total votes" value={voterCount.toLocaleString()} />
              </dl>
            </CardContent>
          </Card>

          {/* Vote breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" aria-hidden /> Vote Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VoteBar
                votesFor={votes.totalFor}
                votesAgainst={votes.totalAgainst}
                votesAbstain={votes.totalAbstain}
              />
              <div className="grid grid-cols-3 gap-3 text-center">
                <VoteStat
                  label="For"
                  value={votes.totalFor}
                  color="text-emerald-400"
                />
                <VoteStat
                  label="Against"
                  value={votes.totalAgainst}
                  color="text-rose-400"
                />
                <VoteStat
                  label="Abstain"
                  value={votes.totalAbstain}
                  color="text-slate-400"
                />
              </div>
              <QuorumProgress
                achieved={quorumAchieved}
                required={proposal.quorumRequired}
              />
              {totalVotes === 0 && (
                <p className="text-center text-xs text-text-dim">
                  No votes cast yet. Be the first to vote.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Timeline proposal={proposal} />

          {/* Comments — shared <CommentsSection> in src/components/shared. */}
          <CommentsSection<ProposalComment>
            comments={comments}
            isAuthenticated={Boolean(me)}
            myAddress={me?.address}
            onSubmit={async (content) => {
              await createComment.mutateAsync({ content });
            }}
            onReply={async (parentId, content) => {
              await createComment.mutateAsync({ content, parentId });
            }}
            onReact={(commentId, type) =>
              toggleReaction.mutate({ commentId, type })
            }
            onReactEmoji={(commentId, emoji) =>
              toggleCommentEmoji.mutate({ commentId, emoji })
            }
            isSubmitting={createComment.isPending}
            isReacting={toggleReaction.isPending}
            isReactingEmoji={toggleCommentEmoji.isPending}
          />
        </div>

        {/* ── Sticky vote panel (desktop sidebar) ─────────────── */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <VotePanel
              proposal={proposal}
              votes={votes}
              isActive={isActive}
              isClosed={isClosed}
              userVoted={userVoted}
              myVote={myVote}
              isAuthenticated={Boolean(me)}
              votingPower={me?.votingPower}
              onVote={onVote}
              isVoting={castVote.isPending}
              onChangeVote={onChangeVote}
              isChangingVote={changeVote.isPending}
            />
          </div>
        </aside>
      </motion.div>

      {/* ── Mobile sticky bottom vote bar ─────────────────────── */}
      {(isActive || isClosed) && (
        <MobileVoteBar
          isActive={isActive}
          userVoted={userVoted}
          myVote={myVote}
          isAuthenticated={Boolean(me)}
          onVote={onVote}
          isVoting={castVote.isPending}
          onChangeVote={onChangeVote}
          isChangingVote={changeVote.isPending}
        />
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <dt className="text-xs text-text-dim">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}

function VoteStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/50 p-3">
      <div className={`text-lg font-bold ${color}`}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-text-dim">{label}</div>
    </div>
  );
}

interface VotePanelProps {
  proposal: Proposal;
  votes: ProposalDetailData["votes"];
  isActive: boolean;
  isClosed: boolean;
  userVoted: boolean;
  myVote: VoteChoice | null;
  isAuthenticated: boolean;
  votingPower?: number;
  onVote: (choice: VoteChoice) => void;
  isVoting: boolean;
  onChangeVote: (choice: VoteChoice) => void;
  isChangingVote: boolean;
}

function VotePanel({
  proposal,
  votes,
  isActive,
  isClosed,
  userVoted,
  myVote,
  isAuthenticated,
  votingPower,
  onVote,
  isVoting,
  onChangeVote,
  isChangingVote,
}: VotePanelProps) {
  const [isChanging, setIsChanging] = useState(false);

  const handleVoteChange = async (choice: VoteChoice) => {
    await onChangeVote(choice);
    setIsChanging(false);
  };
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* Countdown */}
        {isActive && proposal.votingEndsAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Time remaining</span>
            <CountdownTimer endsAt={proposal.votingEndsAt} />
          </div>
        )}

        {/* Voting actions */}
        {isActive && !userVoted && (
          <>
            {!isAuthenticated ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Connect your wallet to vote on this proposal.
                </p>
                <ConnectCta className="w-full">Connect to Vote</ConnectCta>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Cast your vote</p>
                <div className="grid grid-cols-1 gap-2">
                  <VoteButton
                    choice={VoteChoice.FOR}
                    onVote={onVote}
                    disabled={isVoting}
                  />
                  <VoteButton
                    choice={VoteChoice.AGAINST}
                    onVote={onVote}
                    disabled={isVoting}
                  />
                  <VoteButton
                    choice={VoteChoice.ABSTAIN}
                    onVote={onVote}
                    disabled={isVoting}
                  />
                </div>
                {votingPower != null && (
                  <p className="pt-1 text-center text-xs text-text-dim">
                    Your voting power:{" "}
                    <span className="font-mono text-muted-foreground">
                      {formatCompact(votingPower)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Already voted / changing vote */}
        {isActive && userVoted && myVote && !isChanging && (
          <div className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-3 text-center">
            <p className="text-sm font-medium text-foreground">
              You voted:{" "}
              <span className={`inline-flex items-center gap-1 ${VOTE_CHOICE_CONFIG[myVote].accentClass}`}>
                <DynamicIcon name={VOTE_CHOICE_CONFIG[myVote].iconName} className="h-3.5 w-3.5" aria-hidden />
                {VOTE_CHOICE_CONFIG[myVote].label}
              </span>
            </p>
            <p className="text-xs text-text-dim">Your vote has been recorded.</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setIsChanging(true)}>
              Change Vote
            </Button>
          </div>
        )}

        {/* Changing vote */}
        {isActive && userVoted && isChanging && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Change your vote</p>
            <div className="grid grid-cols-1 gap-2">
              <VoteButton
                choice={VoteChoice.FOR}
                onVote={handleVoteChange}
                disabled={isChangingVote}
              />
              <VoteButton
                choice={VoteChoice.AGAINST}
                onVote={handleVoteChange}
                disabled={isChangingVote}
              />
              <VoteButton
                choice={VoteChoice.ABSTAIN}
                onVote={handleVoteChange}
                disabled={isChangingVote}
              />
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setIsChanging(false)} disabled={isChangingVote}>
              Cancel
            </Button>
          </div>
        )}

        {/* Closed / not active */}
        {!isActive && (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              {isClosed ? "Voting has ended" : "Voting is not open yet"}
            </p>
            {isClosed && (
              <div className="rounded-lg border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-xs text-text-dim">Final result</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {votes.totalFor > votes.totalAgainst ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden /> Passed
                    </span>
                  ) : votes.totalAgainst > votes.totalFor ? (
                    <span className="inline-flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-rose-400" aria-hidden /> Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Scale className="h-4 w-4 text-muted-foreground" aria-hidden /> Tied
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {isVoting && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Casting vote…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VoteButton({
  choice,
  onVote,
  disabled,
}: {
  choice: VoteChoice;
  onVote: (c: VoteChoice) => void;
  disabled: boolean;
}) {
  const cfg = VOTE_CHOICE_CONFIG[choice];
  const styles: Record<VoteChoice, string> = {
    [VoteChoice.FOR]: "border-emerald-600/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    [VoteChoice.AGAINST]: "border-rose-600/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
    [VoteChoice.ABSTAIN]: "border-slate-600/50 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20",
  };
  return (
    <button
      type="button"
      onClick={() => onVote(choice)}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${styles[choice]}`}
    >
      <DynamicIcon name={cfg.iconName} className="h-4 w-4" aria-hidden /> {cfg.label}
    </button>
  );
}

function MobileVoteBar({
  isActive,
  userVoted,
  isAuthenticated,
  onVote,
  isVoting,
  onChangeVote,
  isChangingVote,
  myVote,
}: Pick<
  VotePanelProps,
  "isActive" | "userVoted" | "isAuthenticated" | "onVote" | "isVoting" | "onChangeVote" | "isChangingVote"
> & {
  myVote: VoteChoice | null;
}) {
  // Compact three-button row fixed to the bottom on mobile.
  const [isChanging, setIsChanging] = useState(false);

  const handleVoteChange = async (choice: VoteChoice) => {
    await onChangeVote(choice);
    setIsChanging(false);
  };

  if (isActive && userVoted && myVote && !isChanging) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <span className="text-sm text-text-dim">You voted:</span>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${VOTE_CHOICE_CONFIG[myVote].accentClass}`}>
              <DynamicIcon name={VOTE_CHOICE_CONFIG[myVote].iconName} className="h-3.5 w-3.5" aria-hidden />
              {VOTE_CHOICE_CONFIG[myVote].label}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsChanging(true)} disabled={isChangingVote}>
            Change
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
      {isActive && !isAuthenticated ? (
        <ConnectCta className="w-full">Connect to Vote</ConnectCta>
      ) : isActive && isChanging ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {([VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN] as VoteChoice[]).map((c) => (
              <VoteButton key={c} choice={c} onVote={handleVoteChange} disabled={isChangingVote} />
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setIsChanging(false)} disabled={isChangingVote}>
            Cancel
          </Button>
        </div>
      ) : isActive ? (
        <div className="grid grid-cols-3 gap-2">
          {([VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN] as VoteChoice[]).map((c) => (
            <VoteButton key={c} choice={c} onVote={onVote} disabled={isVoting} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Timeline ─────────────────────────────────────────────────── */

function Timeline({ proposal }: { proposal: Proposal }) {
  const events = useMemo(() => {
    const items: { label: string; iconName: string; date: string | null; done: boolean }[] = [
      {
        label: "Proposal created",
        iconName: "PenLine",
        date: proposal.createdAt,
        done: true,
      },
      {
        label: "Submitted for review",
        iconName: "Hourglass",
        date:
          proposal.status !== ProposalStatus.DRAFT ? proposal.createdAt : null,
        done: proposal.status !== ProposalStatus.DRAFT,
      },
      {
        label: "Voting opened",
        iconName: "Vote",
        date: proposal.votingStartsAt,
        done: proposal.votingStartsAt !== null,
      },
      {
        label: "Voting closed",
        iconName: "Lock",
        date: proposal.votingEndsAt,
        done: [
          ProposalStatus.PASSED,
          ProposalStatus.FAILED,
          ProposalStatus.EXPIRED,
          ProposalStatus.CLOSED,
        ].includes(proposal.status),
      },
    ];

    // Add rejection event if proposal was rejected
    if (proposal.status === ProposalStatus.FAILED && proposal.metadata?.rejectionReason) {
      items.push({
        label: "Rejected by admin",
        iconName: "ShieldX",
        date: proposal.metadata.rejectedAt || null,
        done: true,
      });
    }

    return items;
  }, [proposal]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
          <Clock className="h-4 w-4" aria-hidden /> Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <ol className="relative space-y-5 pl-6">
          <span
            aria-hidden
            className="absolute left-[7px] top-1 bottom-1 w-px bg-border"
          />
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className={`absolute -left-[22px] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                  e.done
                    ? "border-gold bg-gold"
                    : "border-border bg-bg-surface"
                }`}
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex items-center text-sm font-medium text-foreground">
                  <DynamicIcon
                    name={e.iconName}
                    aria-hidden
                    className="mr-1.5 h-3.5 w-3.5"
                  />
                  {e.label}
                </span>
                {e.date && (
                  <span className="shrink-0 text-xs text-text-dim">
                    {formatDate(e.date)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
