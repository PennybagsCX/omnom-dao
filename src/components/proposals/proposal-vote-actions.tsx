"use client";

import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommentsSection } from "@/components/shared/comments-section";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { QuorumProgress } from "@/components/shared/quorum-progress";
import { ConnectCta } from "@/components/wallet/connect-cta";
import {
  useCreateComment,
  useToggleCommentEmojiReaction,
  useToggleReaction,
  useCurrentUser,
  useProposalDetail,
} from "@/lib/api";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { useProposalVote } from "@/lib/use-proposal-vote";
import { cn, formatDateTime } from "@/lib/utils";
import { ProposalStatus, VoteChoice, type ProposalComment } from "@/types";

const CHOICES: VoteChoice[] = [VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN];

/**
 * What each ballot choice means — the per-choice card copy, mirroring the
 * FGE ballot cards' structure (title + summary + live % + Select button).
 */
const CHOICE_SUMMARIES: Record<VoteChoice, string> = {
  [VoteChoice.FOR]:
    "Adopt the proposal. If quorum is met and FOR wins, the outcome is recorded and the change proceeds.",
  [VoteChoice.AGAINST]:
    "Reject the proposal. The current rules stay in force — nothing changes.",
  [VoteChoice.ABSTAIN]:
    "Skip the outcome but count toward turnout — abstentions help reach quorum.",
};

/**
 * FOR / AGAINST / ABSTAIN button — the proposal detail page's ballot button,
 * exported here so the detail page and the /vote card flow share one set of
 * pixels and one import site.
 */
export function VoteButton({
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

/** Total voting power across all choices, for per-choice percentages. */
function powerVoted(tallies: { for: number; against: number; abstain: number }): number {
  return tallies.for + tallies.against + tallies.abstain;
}

export function shareOfPower(choice: VoteChoice, tallies: {
  for: number;
  against: number;
  abstain: number;
}): number {
  const total = powerVoted(tallies);
  if (total <= 0) return 0;
  const value = tallies[choice === VoteChoice.FOR ? "for" : choice === VoteChoice.AGAINST ? "against" : "abstain"];
  return (value / total) * 100;
}

interface ProposalBallotCardsProps {
  proposalId: string;
  /** Server-rendered ACTIVE hint, trusted only until the detail query resolves. */
  isActive: boolean;
  /** Text shown when voting is closed. */
  closedLabel?: string;
  /** Window opens in the future? Ballot shows "Voting opens at …" until then. */
  votingStartsAt?: string | null;
  /** Server-rendered fallback tallies for the per-card live percentages. */
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  className?: string;
}

/**
 * The ballot — FGE choice cards adapted to a FOR/AGAINST/ABSTAIN proposal:
 * one card per choice with a summary, its live share of voting power on the
 * right, and click-to-vote (clicking a different card changes an existing
 * ballot, exactly like the election page). Shares {@link useProposalVote}
 * with the detail page, so a cast from either surface updates both.
 */
export function ProposalBallotCards({
  proposalId,
  isActive: serverIsActive,
  closedLabel = "Voting has ended",
  votingStartsAt = null,
  votesFor: fallbackFor,
  votesAgainst: fallbackAgainst,
  votesAbstain: fallbackAbstain,
  className,
}: ProposalBallotCardsProps) {
  const vote = useProposalVote(proposalId);
  const isActive = vote.detail
    ? vote.detail.proposal.status === ProposalStatus.ACTIVE
    : serverIsActive;
  const userVoted = vote.myVote !== null;
  const isMutating = vote.isVoting || vote.isChangingVote;

  const live = vote.detail?.proposal;
  const tallies = {
    for: live?.votesFor ?? fallbackFor,
    against: live?.votesAgainst ?? fallbackAgainst,
    abstain: live?.votesAbstain ?? fallbackAbstain,
  };

  // Window opens in the future? (server-side window: casts 409 until then —
  // so the ballot must not offer choices yet)
  const startMs = votingStartsAt ? Date.parse(votingStartsAt) : null;
  const notStarted = isActive && startMs !== null && new Date().getTime() < startMs;

  const canVote =
    isActive &&
    !notStarted &&
    vote.isAuthenticated &&
    vote.detail !== undefined &&
    !vote.detailErrored &&
    !isMutating;

  const handleChoice = (choice: VoteChoice) => {
    if (!canVote || choice === vote.myVote) return;
    if (userVoted) {
      void vote.onChangeVote(choice);
    } else {
      void vote.onVote(choice);
    }
  };

  return (
    <div className={cn("space-y-4", className)} data-testid="proposal-vote-ballot">
      {!isActive ? (
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">{closedLabel}</p>
        </div>
      ) : null}

      {notStarted && votingStartsAt ? (
        // Window opens in the future — the server rejects casts until then.
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="mb-1 text-sm font-medium text-foreground">Voting has not started yet</p>
          <p className="text-sm text-muted-foreground">
            Voting opens {formatDateTime(votingStartsAt)} — the ballot unlocks
            automatically.
          </p>
        </div>
      ) : null}

      {!vote.isAuthenticated && isActive && !notStarted && (
        // FGE parity: the connect box sits above the (browsable) cards.
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="mb-1 text-sm font-medium text-foreground">Connect to vote</p>
          <p className="mb-4 text-sm text-muted-foreground">
            One ballot per snapshot wallet, weighted by √(balance).
          </p>
          <ConnectCta>Connect Wallet</ConnectCta>
        </div>
      )}

      {isActive && vote.detailErrored && vote.detail === undefined ? (
        // The detail query never retries on its own — without this branch a
        // single failed fetch would leave the ballot stuck on "Checking".
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Couldn&rsquo;t load your ballot status.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={vote.refetchDetail}
          >
            Try again
          </Button>
        </div>
      ) : vote.detail === undefined ? (
        // Neutral state while myVote/auth settle — prevents a click that
        // would fire a doomed POST (already-voted / not-yet-authed).
        <div
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated/40 p-6 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your vote…
        </div>
      ) : null}

      {CHOICES.map((choice) => {
        const cfg = VOTE_CHOICE_CONFIG[choice];
        const selected = vote.myVote === choice;
        const share = shareOfPower(choice, tallies);
        return (
          <Card
            key={choice}
            data-testid={`ballot-card-${choice.toLowerCase()}`}
            className={cn(
              "transition-all cursor-pointer",
              selected && "border-gold/40 bg-gold/5",
              canVote && !selected && "hover:border-border/50",
            )}
            onClick={() => handleChoice(choice)}
          >
            <CardContent className="p-5">
              {/* Centered on mobile / small screens (owner mark m8); the
                  sm: breakpoint restores the left-aligned desktop layout. */}
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <h3
                      className={cn(
                        "inline-flex items-center gap-1.5 text-base font-semibold",
                        selected ? "text-gold" : "text-foreground",
                      )}
                    >
                      <DynamicIcon name={cfg.iconName} className="h-4 w-4" aria-hidden />
                      {cfg.label}
                    </h3>
                    {selected && (
                      <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        Current ballot
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {CHOICE_SUMMARIES[choice]}
                  </p>
                  {choice === VoteChoice.ABSTAIN && (
                    <p className="mt-2 text-xs text-text-dim">
                      Turnout counts every ballot against total quadratic power
                      (√ of snapshot balance).
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
                  <div className="text-center">
                    <div className="font-mono text-lg font-bold text-gold">
                      {share.toFixed(1)}%
                    </div>
                    <div className="text-xs text-text-dim">Current results</div>
                  </div>
                  {canVote && (
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className={cn("shrink-0", selected && "bg-gold text-gold-foreground hover:bg-gold/90")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChoice(choice);
                      }}
                    >
                      {selected ? "Selected" : "Select"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(vote.isVoting || vote.isChangingVote) && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Casting vote…
        </div>
      )}

      {/* Voting-power footnote — mirrors the detail page's VotePanel note. */}
      {isActive && vote.isAuthenticated && vote.votingPower != null && (
        <p
          className="text-center text-xs text-text-dim"
          title="Quadratic voting (community-chosen): your power is the square root of your snapshot balance."
        >
          Your voting power (√ balance):{" "}
          <span className="font-mono text-muted-foreground">{vote.votingPower.toLocaleString("en-US")}</span>
        </p>
      )}
    </div>
  );
}

interface ProposalVoteResultsProps {
  proposalId: string;
  /** Server-rendered fallback tallies — shown until the detail query resolves,
   *  after which the live (invalidation-updated) numbers take over. */
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
  /** Total snapshot voting power — the quorum denominator. */
  totalPower: number;
  className?: string;
}

/**
 * Live results in the FGE per-choice bar style: one gold-percentage row per
 * choice, then the turnout-vs-quorum progress. Tallies come from the shared
 * detail query, so a cast from the ballot above (or the detail page) updates
 * this section in place.
 */
export function ProposalVoteResults({
  proposalId,
  votesFor: fallbackFor,
  votesAgainst: fallbackAgainst,
  votesAbstain: fallbackAbstain,
  quorumRequired,
  totalPower,
  className,
}: ProposalVoteResultsProps) {
  const vote = useProposalVote(proposalId);
  const live = vote.detail?.proposal;
  const tallies = {
    for: live?.votesFor ?? fallbackFor,
    against: live?.votesAgainst ?? fallbackAgainst,
    abstain: live?.votesAbstain ?? fallbackAbstain,
  };
  const voted = powerVoted(tallies);
  const turnout = totalPower > 0 ? (voted / totalPower) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)} data-testid="proposal-vote-results">
      {CHOICES.map((choice) => {
        const share = shareOfPower(choice, tallies);
        const value =
          tallies[choice === VoteChoice.FOR ? "for" : choice === VoteChoice.AGAINST ? "against" : "abstain"];
        const selected = vote.myVote === choice;
        return (
          <div key={choice} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={cn("font-medium", selected ? "text-gold" : "text-foreground")}>
                {VOTE_CHOICE_CONFIG[choice].label}
              </span>
              <span className="font-mono font-bold text-gold">{share.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className={cn("h-full transition-all duration-500", VOTE_CHOICE_CONFIG[choice].barClass)}
                style={{ width: `${share}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-dim">
              <span>{choice === VoteChoice.FOR ? "Voting power for" : choice === VoteChoice.AGAINST ? "Voting power against" : "Voting power withheld"}</span>
              <span>{value.toLocaleString("en-US")}</span>
            </div>
          </div>
        );
      })}

      <QuorumProgress className="pt-2" achieved={turnout} required={quorumRequired} />
    </div>
  );
}

interface ProposalVoteDiscussionProps {
  proposalId: string;
  className?: string;
}

/**
 * Discussion island for the /vote page — the same shared CommentsSection the
 * detail page uses, fed by the shared detail query (no extra fetch) and the
 * same comment mutations, so both surfaces see one thread.
 */
export function ProposalVoteDiscussion({
  proposalId,
  className,
}: ProposalVoteDiscussionProps) {
  const { data: me } = useCurrentUser({ retry: false });
  const { data: detail, isError } = useProposalDetail(proposalId);
  const createComment = useCreateComment(proposalId);
  const toggleReaction = useToggleReaction(proposalId);
  const toggleCommentEmoji = useToggleCommentEmojiReaction(proposalId);

  if (isError) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Comments are unavailable right now.
      </p>
    );
  }

  return (
    <div className={className}>
      <CommentsSection<ProposalComment>
        comments={detail?.comments ?? []}
        isAuthenticated={Boolean(me)}
        myAddress={me?.address}
        onSubmit={async (content) => {
          await createComment.mutateAsync({ content });
        }}
        onReply={async (parentId, content) => {
          await createComment.mutateAsync({ content, parentId });
        }}
        onReact={(commentId, type) => toggleReaction.mutate({ commentId, type })}
        onReactEmoji={(commentId, emoji) =>
          toggleCommentEmoji.mutate({ commentId, emoji })
        }
        isSubmitting={createComment.isPending}
        isReacting={toggleReaction.isPending}
        isReactingEmoji={toggleCommentEmoji.isPending}
      />
    </div>
  );
}
