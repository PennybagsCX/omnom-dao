// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ProposalBallotCards,
  ProposalVoteResults,
  VoteButton,
} from "@/components/proposals/proposal-vote-actions";
import type { ProposalDetailData } from "@/lib/api";
import type { UseProposalVoteResult } from "@/lib/use-proposal-vote";
import { ProposalStatus, VoteChoice } from "@/types";

const useProposalVoteMock = vi.fn();
vi.mock("@/lib/use-proposal-vote", () => ({
  useProposalVote: (id: string) => useProposalVoteMock(id),
}));

// ConnectCta pulls the wallet dialog context (wagmi) — stub the button.
vi.mock("@/components/wallet/connect-cta", () => ({
  ConnectCta: (props: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {props.children ?? "Connect Wallet"}
    </button>
  ),
}));

const TALLIES = { votesFor: 9_867_109, votesAgainst: 5_348_732, votesAbstain: 14_524 };

function detailWith(
  status: ProposalStatus,
  tallies: { for: number; against: number; abstain: number } = {
    for: 0,
    against: 0,
    abstain: 0,
  },
): ProposalDetailData {
  return {
    proposal: {
      status,
      votesFor: tallies.for,
      votesAgainst: tallies.against,
      votesAbstain: tallies.abstain,
    } as unknown as ProposalDetailData["proposal"],
    votes: { totalFor: tallies.for, totalAgainst: tallies.against, totalAbstain: tallies.abstain },
    voterCount: 0,
    comments: [],
    myVote: null,
  };
}

function baseVote(overrides: Partial<UseProposalVoteResult> = {}): UseProposalVoteResult {
  return {
    isAuthenticated: false,
    votingPower: undefined,
    myVote: null,
    onVote: vi.fn(async () => {}),
    onChangeVote: vi.fn(async () => {}),
    isVoting: false,
    isChangingVote: false,
    detail: undefined,
    detailErrored: false,
    refetchDetail: vi.fn(),
    ...overrides,
  };
}

function renderCards(vote: UseProposalVoteResult, props: { isActive?: boolean } = {}) {
  useProposalVoteMock.mockReturnValue(vote);
  return render(
    <ProposalBallotCards
      proposalId="prop-x"
      isActive={props.isActive ?? true}
      closedLabel="Voting closed — outcome pending"
      {...TALLIES}
    />,
  );
}

describe("<VoteButton />", () => {
  it("keeps the detail page's ballot button pixels", () => {
    render(<VoteButton choice={VoteChoice.FOR} onVote={() => {}} disabled={false} />);
    expect(screen.getByRole("button", { name: /for/i }).className).toContain("py-2.5");
  });
});

describe("<ProposalBallotCards />", () => {
  it("renders three FGE-style choice cards with live per-card percentages", () => {
    renderCards(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.ACTIVE, { for: 9_867_109, against: 5_348_732, abstain: 14_524 }),
      }),
    );
    for (const name of ["For", "Against", "Abstain"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    // Share of power voted: 9,867,109 / 15,230,365 = 64.8%.
    expect(screen.getAllByText("64.8%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Current results").length).toBe(3);
  });

  it("unauthenticated + active: connect box shown, cards inert (no Select)", () => {
    renderCards(baseVote());
    expect(screen.getByText("Connect to vote")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^select$/i })).not.toBeInTheDocument();
  });

  it("authenticated but detail unresolved: neutral checking state (no doomed casts)", () => {
    renderCards(baseVote({ isAuthenticated: true }));
    expect(screen.getByText(/checking your vote…/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^select$/i })).not.toBeInTheDocument();
  });

  it("failed detail query: dead-end branch with a working retry", async () => {
    const user = userEvent.setup();
    const refetchDetail = vi.fn();
    renderCards(baseVote({ isAuthenticated: true, detailErrored: true, refetchDetail }));
    expect(screen.getByText(/couldn.t load your ballot status/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchDetail).toHaveBeenCalledTimes(1);
  });

  it("clicking an unvoted card casts FOR", async () => {
    const user = userEvent.setup();
    const onVote = vi.fn(async () => {});
    renderCards(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.ACTIVE),
        onVote,
      }),
    );
    await user.click(screen.getByTestId("ballot-card-for"));
    expect(onVote).toHaveBeenCalledWith(VoteChoice.FOR);
  });

  it("already-voted: gold 'Current ballot' on the chosen card; clicking another card changes the vote", async () => {
    const user = userEvent.setup();
    const onChangeVote = vi.fn(async () => {});
    renderCards(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        onChangeVote,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByText("Current ballot")).toBeInTheDocument();
    // Gold "Selected" state (inert by design — the card-level guard no-ops it).
    expect(screen.getByRole("button", { name: /^selected$/i })).toBeInTheDocument();

    await user.click(screen.getByTestId("ballot-card-against"));
    await waitFor(() =>
      expect(onChangeVote).toHaveBeenCalledWith(VoteChoice.AGAINST),
    );
  });

  it("clicking the already-selected card does not re-cast", async () => {
    const user = userEvent.setup();
    const onVote = vi.fn(async () => {});
    const onChangeVote = vi.fn(async () => {});
    renderCards(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        onVote,
        onChangeVote,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    await user.click(screen.getByTestId("ballot-card-for"));
    expect(onVote).not.toHaveBeenCalled();
    expect(onChangeVote).not.toHaveBeenCalled();
  });

  it("closed (server status resolved): shows the closedLabel, no Select buttons", () => {
    renderCards(
      baseVote({ isAuthenticated: true, detail: detailWith(ProposalStatus.PASSED) }),
    );
    expect(screen.getByText("Voting closed — outcome pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^select$/i })).not.toBeInTheDocument();
  });
});

describe("<ProposalVoteResults />", () => {
  const RESULTS_PROPS = {
    proposalId: "prop-x",
    votesFor: 60,
    votesAgainst: 30,
    votesAbstain: 10,
    quorumRequired: 5,
    totalPower: 1000,
  };

  it("renders FGE-style per-choice bars with shares and power counts", () => {
    useProposalVoteMock.mockReturnValue(baseVote());
    render(<ProposalVoteResults {...RESULTS_PROPS} />);
    // Shares of 100 power voted: 60% / 30% / 10%.
    expect(screen.getAllByText("60.0%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Voting power for")).toBeInTheDocument();
    expect(screen.getByText("Voting power withheld")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    // Turnout = 100/1000 = 10% vs required 5%.
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByText(/Quorum reached/i)).toBeInTheDocument();
  });

  it("prefers the detail query's tallies once resolved (live bars after a cast)", () => {
    useProposalVoteMock.mockReturnValue(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.ACTIVE, { for: 100, against: 10, abstain: 5 }),
      }),
    );
    render(<ProposalVoteResults {...RESULTS_PROPS} />);
    // Shares of 115 power voted: 87.0% / 8.7% / 4.3%.
    expect(screen.getAllByText("87.0%").length).toBeGreaterThanOrEqual(1);
  });
});
