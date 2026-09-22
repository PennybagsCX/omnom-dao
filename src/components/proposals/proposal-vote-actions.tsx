"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { VoteBar } from "@/components/shared/vote-bar";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { useProposalVote } from "@/lib/use-proposal-vote";
import { cn } from "@/lib/utils";
import { ProposalStatus, VoteChoice } from "@/types";

const CHOICES: VoteChoice[] = [VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN];

/**
 * FOR / AGAINST / ABSTAIN button. Moved verbatim from the proposal detail
 * page so both voting surfaces share one component and one set of pixels:
 *
 *  - `variant="stack"` (default) — the detail page's full-width buttons.
 *  - `variant="row"` — compact 3-up grid cell with `min-h-11` (44px) touch
 *    target, used on the /vote hub's live cards.
 */
export function VoteButton({
  choice,
  onVote,
  disabled,
  variant = "stack",
}: {
  choice: VoteChoice;
  onVote: (c: VoteChoice) => void;
  disabled: boolean;
  variant?: "stack" | "row";
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
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        variant === "stack" ? "px-4 py-2.5" : "min-h-11 px-1.5",
        styles[choice],
      )}
    >
      <DynamicIcon name={cfg.iconName} className="h-4 w-4" aria-hidden /> {cfg.label}
    </button>
  );
}

interface ProposalVoteActionsProps {
  proposalId: string;
  /** Server-rendered ACTIVE hint, trusted only until the detail query resolves. */
  isActive: boolean;
  /** Text shown when voting is closed. */
  closedLabel?: string;
  /** Server-rendered fallback tallies — shown until the detail query resolves,
   *  after which the live (invalidation-updated) numbers take over. */
  votesFor?: number;
  votesAgainst?: number;
  votesAbstain?: number;
  className?: string;
}

/**
 * Compact cast/change-vote controls for the /vote hub's live cards — the
 * detail page's VotePanel state machine condensed. Shares the
 * {@link useProposalVote} code path with the detail page, so a cast from
 * either surface updates both (same query key + invalidation).
 *
 * Once the detail query resolves, the component trusts the server's status,
 * so a stale ACTIVE card (window passed, cast triggered the route's lazy
 * finalize) flips itself to the closed state without a reload.
 */
export function ProposalVoteActions({
  proposalId,
  isActive: serverIsActive,
  closedLabel = "Voting has ended",
  votesFor = 0,
  votesAgainst = 0,
  votesAbstain = 0,
  className,
}: ProposalVoteActionsProps) {
  const vote = useProposalVote(proposalId);
  const [isChanging, setIsChanging] = useState(false);

  const isActive = resolveIsActive(vote.detail, serverIsActive);
  const userVoted = vote.myVote !== null;
  const changing = userVoted && isChanging;
  // Server tallies until the detail query resolves; then the live numbers,
  // so a cast from this card (or the detail page) updates the bar instantly
  // via the shared proposalDetail invalidation.
  const live = vote.detail?.proposal;
  const bar = {
    votesFor: live?.votesFor ?? votesFor,
    votesAgainst: live?.votesAgainst ?? votesAgainst,
    votesAbstain: live?.votesAbstain ?? votesAbstain,
  };

  const handleVoteChange = async (choice: VoteChoice) => {
    await vote.onChangeVote(choice);
    setIsChanging(false);
  };

  return (
    <div className={cn("space-y-3", className)} data-testid="proposal-vote-actions">
      <VoteBar {...bar} />

      {!isActive ? (
        <p className="text-center text-sm text-muted-foreground">{closedLabel}</p>
      ) : !vote.isAuthenticated ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to vote on this proposal.
          </p>
          <ConnectCta className="min-h-11 w-full">Connect to Vote</ConnectCta>
        </div>
      ) : vote.detail === undefined ? (
        // Neutral state while myVote/auth settle — prevents clicking a cast
        // button that would fire a doomed POST (already-voted / not-yet-authed).
        <p role="status" className="text-center text-sm text-muted-foreground">
          Checking your vote…
        </p>
      ) : !userVoted || changing ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {changing ? "Change your vote" : "Cast your vote"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CHOICES.map((choice) => (
              <VoteButton
                key={choice}
                variant="row"
                choice={choice}
                onVote={changing ? handleVoteChange : vote.onVote}
                disabled={changing ? vote.isChangingVote : vote.isVoting}
              />
            ))}
          </div>
          {changing && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full min-h-11 sm:min-h-9"
              onClick={() => setIsChanging(false)}
              disabled={vote.isChangingVote}
            >
              Cancel
            </Button>
          )}
        </div>
      ) : (
        vote.myVote && (
          <div
            aria-live="polite"
            className="space-y-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-3 text-center"
          >
            <p className="text-sm font-medium text-foreground">
              You voted:{" "}
              <span
                className={`inline-flex items-center gap-1 ${VOTE_CHOICE_CONFIG[vote.myVote].accentClass}`}
              >
                <DynamicIcon
                  name={VOTE_CHOICE_CONFIG[vote.myVote].iconName}
                  className="h-3.5 w-3.5"
                  aria-hidden
                />
                {VOTE_CHOICE_CONFIG[vote.myVote].label}
              </span>
            </p>
            <p className="text-xs text-text-dim">Your vote has been recorded.</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full min-h-11 sm:min-h-9"
              onClick={() => setIsChanging(true)}
            >
              Change Vote
            </Button>
          </div>
        )
      )}

      {(vote.isVoting || vote.isChangingVote) && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Casting vote…
        </div>
      )}
    </div>
  );
}

/** Server status until the detail query resolves, then the live server truth. */
function resolveIsActive(
  detail: ReturnType<typeof useProposalVote>["detail"],
  serverIsActive: boolean,
): boolean {
  if (!detail) return serverIsActive;
  return detail.proposal.status === ProposalStatus.ACTIVE;
}
