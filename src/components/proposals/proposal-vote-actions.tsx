"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { QuorumProgress } from "@/components/shared/quorum-progress";
import { VoteBar } from "@/components/shared/vote-bar";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { useProposalVote } from "@/lib/use-proposal-vote";
import { cn, formatCompact } from "@/lib/utils";
import { ProposalStatus, VoteChoice } from "@/types";

const CHOICES: VoteChoice[] = [VoteChoice.FOR, VoteChoice.AGAINST, VoteChoice.ABSTAIN];

/**
 * FOR / AGAINST / ABSTAIN button. Shared by the proposal detail page and the
 * /vote hub so both voting surfaces render one set of pixels:
 *
 *  - `variant="stack"` (default) — the detail page's full-width buttons.
 *  - `variant="hero"` — the /vote hub's larger 44px full-width buttons.
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
  variant?: "stack" | "hero";
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
        variant === "stack" ? "px-4 py-2.5" : "min-h-11 w-full px-4 py-3",
        styles[choice],
      )}
    >
      <DynamicIcon name={cfg.iconName} className="h-4 w-4" aria-hidden /> {cfg.label}
    </button>
  );
}

/** Shared hook wiring for both /vote islands (one detail query, deduped). */
function useVoteState(proposalId: string) {
  const vote = useProposalVote(proposalId);
  const isActive = vote.detail
    ? vote.detail.proposal.status === ProposalStatus.ACTIVE
    : true;
  return { vote, isActive };
}

interface ProposalVotePanelProps {
  proposalId: string;
  /** Text shown when voting is closed. */
  closedLabel?: string;
  className?: string;
}

/**
 * Cast/change-vote panel for the /vote hub — the FGE ballot area's design
 * (centered instruction, stacked full-width choice buttons, gold
 * "current ballot" confirmation). Shares {@link useProposalVote} with the
 * detail page, so a cast from either surface updates both.
 */
export function ProposalVotePanel({
  proposalId,
  closedLabel = "Voting has ended",
  className,
}: ProposalVotePanelProps) {
  const { vote, isActive } = useVoteState(proposalId);
  const [isChanging, setIsChanging] = useState(false);

  const userVoted = vote.myVote !== null;
  const changing = userVoted && isChanging;

  const handleVoteChange = async (choice: VoteChoice) => {
    await vote.onChangeVote(choice);
    setIsChanging(false);
  };

  return (
    <div className={cn("space-y-4", className)} data-testid="proposal-vote-panel">
      {!isActive ? (
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">{closedLabel}</p>
        </div>
      ) : !vote.isAuthenticated ? (
        <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
          <p className="mb-1 text-sm font-medium text-foreground">Connect to vote</p>
          <p className="mb-4 text-sm text-muted-foreground">
            One ballot per snapshot wallet — power-weighted by √(balance).
          </p>
          <ConnectCta className="min-h-11">Connect Wallet</ConnectCta>
        </div>
      ) : vote.detailErrored && vote.detail === undefined ? (
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
        // Neutral state while myVote/auth settle — prevents clicking a cast
        // button that would fire a doomed POST (already-voted / not-yet-authed).
        <div
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated/40 p-6 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your vote…
        </div>
      ) : !userVoted || changing ? (
        <>
          <div className="grid grid-cols-1 gap-2">
            {CHOICES.map((choice) => (
              <VoteButton
                key={choice}
                variant="hero"
                choice={choice}
                onVote={changing ? handleVoteChange : vote.onVote}
                disabled={changing ? vote.isChangingVote : vote.isVoting}
              />
            ))}
          </div>
          {changing && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 sm:min-h-9"
                onClick={() => setIsChanging(false)}
                disabled={vote.isChangingVote}
              >
                Cancel
              </Button>
            </div>
          )}
        </>
      ) : (
        vote.myVote && (
          <div
            aria-live="polite"
            className="rounded-xl border border-gold/40 bg-gold/5 p-5 text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-gold">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Current ballot
            </span>
            <p className="mt-2 text-sm font-medium text-foreground">
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
            <p className="mt-1 text-sm text-muted-foreground">
              Your vote has been recorded.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 min-h-11 sm:min-h-9"
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

      {/* Voting-power footnote — mirrors the detail page's VotePanel note. */}
      {isActive && vote.isAuthenticated && vote.votingPower != null && (
        <p
          className="text-center text-xs text-text-dim"
          title="Quadratic voting (community-chosen): your power is the square root of your snapshot balance."
        >
          Your voting power (√ balance):{" "}
          <span className="font-mono text-muted-foreground">
            {formatCompact(vote.votingPower)}
          </span>
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
 * Live results for the /vote hub's "Current results" section — VoteBar,
 * per-choice power cells, and live turnout vs the quorum threshold.
 * Tallies come from the shared detail query, so a cast from the panel above
 * (or the detail page) updates this section in place.
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
  const { vote } = useVoteState(proposalId);
  const live = vote.detail?.proposal;
  const votesFor = live?.votesFor ?? fallbackFor;
  const votesAgainst = live?.votesAgainst ?? fallbackAgainst;
  const votesAbstain = live?.votesAbstain ?? fallbackAbstain;
  const powerVoted = votesFor + votesAgainst + votesAbstain;
  const turnout = totalPower > 0 ? (powerVoted / totalPower) * 100 : 0;

  return (
    <div className={cn("space-y-5", className)} data-testid="proposal-vote-results">
      <VoteBar votesFor={votesFor} votesAgainst={votesAgainst} votesAbstain={votesAbstain} />

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Cell value={votesFor} label="For" valueClass="text-emerald-300" />
        <Cell value={votesAgainst} label="Against" valueClass="text-rose-300" />
        <Cell value={votesAbstain} label="Abstain" valueClass="text-gold" />
        <div>
          <div className="font-mono text-sm font-bold text-gold">
            {turnout.toFixed(1)}
            <span className="text-xs font-normal text-text-dim"> / {quorumRequired}%</span>
          </div>
          <div className="text-xs text-text-dim">Quorum</div>
        </div>
      </div>

      <QuorumProgress achieved={turnout} required={quorumRequired} />
    </div>
  );
}

function Cell({
  value,
  label,
  valueClass,
}: {
  value: number;
  label: string;
  valueClass: string;
}) {
  return (
    <div>
      <div className={cn("font-mono text-sm font-bold", valueClass)}>
        {/* en-US pinned: SSR hydration must match the client for non-en browsers. */}
        {value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-text-dim">{label}</div>
    </div>
  );
}
