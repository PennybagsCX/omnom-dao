"use client";

import { useMemo } from "react";
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
  Hourglass,
  MessageSquare,
  PenLine,
  Rocket,
  Scale,
  Users,
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
import { ShareButtons } from "@/components/shared/share-buttons";
import { VoteBar } from "@/components/shared/vote-bar";
import { AdminRejectionBanner } from "@/components/proposals/admin-rejection-banner";
import { AdoptConsensusControl } from "@/components/proposals/adopt-consensus-control";
import { ConsensusFallbackBanner } from "@/components/proposals/consensus-fallback-banner";
import { ProposalBallotCards, ProposalVoteResults } from "@/components/proposals/proposal-vote-actions";
import { ProposalClassRow } from "@/components/shared/class-breakdown";
import { DeleteProposalDialog } from "@/components/proposals/delete-proposal-dialog";
import {
  useCreateComment,
  useToggleReaction,
  useToggleCommentEmojiReaction,
  useCurrentUser,
  useProposalDetail,
} from "@/lib/api";
import {
  formatDate,
  formatDateTime,
  shortenAddress,
  versionFromDate,
} from "@/lib/utils";
import {
  ErrorCode,
  ProposalStatus,
  type Proposal,
  type ProposalComment,
} from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Proposal detail page (DESIGN.md §7.6).
 *
 * Public read; voting/commenting requires auth. Single-column layout (same
 * width as the other pages): the live ballot is the SAME selectable-card
 * component the /vote hub uses (ProposalBallotCards), so voting and changing
 * a vote work identically on every screen size. Renders the markdown body,
 * vote breakdown + quorum, lifecycle timeline, and threaded comments.
 */
export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const proposalId = params.id;

  const { data, isLoading, isError, error } = useProposalDetail(proposalId);
  const { data: me } = useCurrentUser({ retry: false });
  const createComment = useCreateComment(proposalId);
  const toggleReaction = useToggleReaction(proposalId);
  const toggleCommentEmoji = useToggleCommentEmojiReaction(proposalId);

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
    ProposalStatus.EXECUTED,
  ].includes(proposal.status);
  const totalVotes = votes.totalFor + votes.totalAgainst + votes.totalAbstain;
  // Proposals that opened a voting window get the full results treatment
  // (power-based results + "Who has voted" breakdown), active or closed —
  // matching /vote and /governance-vote. Drafts/pending never voted.
  const hasVotingWindow = proposal.votingStartsAt !== null || totalVotes > 0;
  // Quorum achieved = total voted power / total quadratic power (%) — computed
  // server-side at finalize and recorded on the proposal. We fall back to 0
  // until the proposal's recorded quorum fields are available.
  const quorumAchieved = proposal.quorumAchieved ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
        className="space-y-6"
      >
        {/* ── Single column — same width as the other pages. Voting lives
                inline (ballot cards below), not in a sidebar, so every screen
                size gets the same ballot. ────────────────────────────── */}
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
              {/* Outcome of record for decided votes — the line the old
                  sidebar carried (status-driven, never tally-derived). */}
              {isClosed && (
                <div className="mt-3 flex justify-center">
                  <FinalResultLabel
                    status={proposal.status}
                    adoptedAs={proposal.metadata?.adoptedAs}
                  />
                </div>
              )}
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

              {/* Share row — every read is a potential reach multiplier. */}
              {isActive && (
                <ShareButtons
                  path={`/proposals/${proposalId}`}
                  version={versionFromDate(proposal.votingEndsAt)}
                  title={`${proposal.title} — $OMNOM DAO governance`}
                  className="mt-4 justify-center"
                />
              )}
            </CardContent>
          </Card>

          {/* Rejection Banner */}
          {proposal.status === ProposalStatus.FAILED && (
            <AdminRejectionBanner proposal={proposal} />
          )}

          {/* Admin-only hard delete for FAILED proposals (self-gating; renders
              nothing for non-admins). */}
          {proposal.status === ProposalStatus.FAILED && (
            <div className="flex justify-center">
              <DeleteProposalDialog proposal={proposal} />
            </div>
          )}

          {/* Consensus-fallback adoption (admin-only; renders nothing unless
              the viewer is an admin and the vote finalized EXPIRED). */}
          <AdoptConsensusControl proposal={proposal} />

          {/* Execution outcome banner — the consensus-fallback disclosure takes
              precedence: its "quorum missed" copy must not be buried under the
              generic "carried out and recorded" banner. */}
          {proposal.status === ProposalStatus.EXECUTED &&
            (proposal.metadata?.adoptedAs === "consensus-fallback" ? (
              <ConsensusFallbackBanner proposal={proposal} />
            ) : (
              <ExecutedOutcomeBanner proposal={proposal} />
            ))}

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

          {/* Cast your ballot — the SAME selectable cards the /vote hub uses
              (one component, one code path): tap For/Against/Abstain to vote
              or change your vote at any time while the window is open. Works
              on every screen size — this replaced the desktop-only sidebar
              panel + mobile bottom bar, which left small screens with no way
              to vote at all. */}
          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle className="inline-flex items-center justify-center gap-2 text-base">
                  <Scale className="h-4 w-4" aria-hidden /> Cast your ballot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proposal.votingEndsAt && (
                  <div className="mb-4 flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Time remaining</span>
                    <CountdownTimer endsAt={proposal.votingEndsAt} />
                  </div>
                )}
                <ProposalBallotCards
                  proposalId={proposalId}
                  isActive={isActive}
                  votingStartsAt={proposal.votingStartsAt}
                  votesFor={proposal.votesFor}
                  votesAgainst={proposal.votesAgainst}
                  votesAbstain={proposal.votesAbstain}
                />
              </CardContent>
            </Card>
          )}

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

              {/* Full power-based per-choice results — same component as the
                  /vote page, so past votes read identically. */}
              {hasVotingWindow && (
                <div className="mt-4 border-t border-border pt-4">
                  <ProposalVoteResults
                    proposalId={proposalId}
                    votesFor={votes.totalFor}
                    votesAgainst={votes.totalAgainst}
                    votesAbstain={votes.totalAbstain}
                    quorumRequired={proposal.quorumRequired}
                    totalPower={data.totalPower}
                  />
                </div>
              )}

              {/* Who has voted — holder-class turnout, same as /vote and
                  /governance-vote (rows only; the Vote Breakdown card above
                  already carries the header). */}
              {hasVotingWindow && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4 text-gold" aria-hidden /> Who has voted
                  </p>
                  <div className="space-y-2">
                    {data.classTallies.map((row) => (
                      <ProposalClassRow key={row.holderClass} row={row} />
                    ))}
                  </div>
                </div>
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

      </motion.div>
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

/**
 * Status-driven outcome label for a closed vote. NEVER derives the result
 * from the raw tally: a proposal whose FOR led can still be EXPIRED
 * (quorum not met) — Week 1 (2026-09-30) displayed "Passed" that way. The
 * recorded status is the outcome of record.
 */
function FinalResultLabel({
  status,
  adoptedAs,
}: {
  status: ProposalStatus;
  adoptedAs?: string;
}) {
  if (status === ProposalStatus.PASSED) {
    return (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden /> Passed
      </span>
    );
  }
  if (status === ProposalStatus.FAILED) {
    return (
      <span className="inline-flex items-center gap-1">
        <XCircle className="h-4 w-4 text-rose-400" aria-hidden /> Rejected
      </span>
    );
  }
  if (status === ProposalStatus.EXPIRED) {
    return (
      <span className="inline-flex items-center gap-1">
        <Hourglass className="h-4 w-4 text-slate-400" aria-hidden /> Quorum not met — expired,
        no change adopted
      </span>
    );
  }
  if (status === ProposalStatus.EXECUTED) {
    return adoptedAs === "consensus-fallback" ? (
      <span className="inline-flex items-center gap-1">
        <Scale className="h-4 w-4 text-gold" aria-hidden /> Adopted as working consensus (quorum
        fallback)
      </span>
    ) : (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden /> Executed — outcome
        recorded
      </span>
    );
  }
  return <span className="text-muted-foreground">Outcome pending</span>;
}

/* ── Execution outcome banner ─────────────────────────────────── */

/**
 * Execution transparency banner — the PASSED counterpart of
 * <AdminRejectionBanner>. Renders once the outcome was recorded (§6.1:
 * "Outcome recorded (off-chain action taken)"): the note, the recording
 * admin, and when it was recorded.
 */
function ExecutedOutcomeBanner({ proposal }: { proposal: Proposal }) {
  const note = proposal.metadata?.executionNote;
  const executedBy = proposal.metadata?.executedBy;
  const executedAt = proposal.metadata?.executedAt;

  return (
    <Card className="border-success/30 bg-success/10">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0">
          <Rocket className="h-5 w-5 text-success" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Outcome Recorded</h3>
            <div className="flex items-center gap-1.5 rounded-full bg-success/20 px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3 text-success" aria-hidden />
              <span className="text-xs font-medium text-success">Executed</span>
            </div>
          </div>
          {note ? (
            <p className="text-sm text-muted-foreground">{note}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              The community decision has been carried out and its outcome recorded.
            </p>
          )}
          {(executedBy || executedAt) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
              {executedBy && (
                <span className="inline-flex items-center gap-1">
                  <span>Recorded by</span>
                  <span className="font-mono text-muted-foreground">
                    {shortenAddress(executedBy)}
                  </span>
                </span>
              )}
              {executedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>•</span>
                  <span>{formatDateTime(executedAt)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
          ProposalStatus.EXECUTED,
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

    // Add execution event once the outcome was recorded (§6.1: off-chain action taken)
    if (proposal.status === ProposalStatus.EXECUTED) {
      items.push({
        label: "Outcome recorded",
        iconName: "Rocket",
        date: proposal.metadata?.executedAt || null,
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
