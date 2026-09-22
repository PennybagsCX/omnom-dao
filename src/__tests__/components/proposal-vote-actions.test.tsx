// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ProposalVotePanel,
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

function renderPanel(vote: UseProposalVoteResult, closedLabel?: string) {
  useProposalVoteMock.mockReturnValue(vote);
  return render(
    <ProposalVotePanel
      proposalId="prop-x"
      closedLabel={closedLabel ?? "Voting closed — outcome pending"}
    />,
  );
}

describe("<VoteButton />", () => {
  it("stack variant keeps the detail page's 40px pixels", () => {
    render(
      <VoteButton choice={VoteChoice.FOR} onVote={() => {}} disabled={false} />,
    );
    expect(screen.getByRole("button", { name: /for/i }).className).toContain("py-2.5");
  });

  it("hero variant is a full-width 44px touch target", () => {
    render(
      <VoteButton
        choice={VoteChoice.FOR}
        onVote={() => {}}
        disabled={false}
        variant="hero"
      />,
    );
    const btn = screen.getByRole("button", { name: /for/i });
    expect(btn.className).toContain("min-h-11");
    expect(btn.className).toContain("w-full");
  });
});

describe("<ProposalVotePanel />", () => {
  it("unauthenticated + active: FGE-style connect card, zero choice buttons", () => {
    renderPanel(baseVote());
    expect(screen.getByText("Connect to vote")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });

  it("authenticated but detail unresolved: neutral checking state (no doomed casts)", () => {
    renderPanel(baseVote({ isAuthenticated: true }));
    expect(screen.getByText(/checking your vote…/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });

  it("failed detail query: dead-end branch with a working retry", async () => {
    const user = userEvent.setup();
    const refetchDetail = vi.fn();
    renderPanel(
      baseVote({ isAuthenticated: true, detailErrored: true, refetchDetail }),
    );
    // The rendered text uses a typographic apostrophe (’), so wildcard it.
    expect(screen.getByText(/couldn.t load your ballot status/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchDetail).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });

  it("authenticated + unvoted + resolved: stacked hero buttons + power footnote", () => {
    renderPanel(
      baseVote({
        isAuthenticated: true,
        votingPower: 223_606,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    for (const name of [/^for$/i, /^against$/i, /^abstain$/i]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.className).toContain("min-h-11");
      expect(btn.className).toContain("w-full");
    }
    expect(screen.getByText(/your voting power/i)).toBeInTheDocument();
    expect(screen.getByText("223.61K")).toBeInTheDocument();
  });

  it("clicking FOR calls onVote with VoteChoice.FOR", async () => {
    const user = userEvent.setup();
    const onVote = vi.fn(async () => {});
    renderPanel(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.ACTIVE),
        onVote,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^for$/i }));
    expect(onVote).toHaveBeenCalledWith(VoteChoice.FOR);
  });

  it("voted: gold 'Current ballot' chip and a Change Vote affordance", () => {
    renderPanel(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByText("Current ballot")).toBeInTheDocument();
    expect(screen.getByText(/you voted:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change vote/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^against$/i })).not.toBeInTheDocument();
  });

  it("changing: buttons return with Cancel, and onChangeVote receives the new choice", async () => {
    const user = userEvent.setup();
    const onChangeVote = vi.fn(async () => {});
    renderPanel(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        onChangeVote,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    await user.click(screen.getByRole("button", { name: /change vote/i }));
    expect(screen.getByRole("button", { name: /^against$/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^against$/i }));
    await waitFor(() =>
      expect(onChangeVote).toHaveBeenCalledWith(VoteChoice.AGAINST),
    );
  });

  it("casting: buttons disabled with a status-announced indicator", () => {
    renderPanel(
      baseVote({
        isAuthenticated: true,
        isVoting: true,
        detail: detailWith(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByRole("button", { name: /^for$/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/casting vote…/i);
  });

  it("closed (server status resolved): shows the closedLabel and no affordances", () => {
    renderPanel(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.PASSED),
      }),
    );
    expect(screen.getByText("Voting closed — outcome pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
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

  it("renders the bar, per-choice power cells, and live turnout vs quorum", () => {
    // No detail query resolved — the server fallback tallies render.
    useProposalVoteMock.mockReturnValue(baseVote());
    render(<ProposalVoteResults {...RESULTS_PROPS} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "For 60.0%, Against 30.0%, Abstain 10.0%",
    );
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    // Turnout = (60+30+10)/1000 = 10.0% vs required 5% — the value shows in
    // both the quorum cell and the VoteBar legend, and the progressbar pins it.
    expect(screen.getAllByText(/10\.0/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Quorum reached/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });

  it("prefers the detail query's tallies once resolved (live bar after a cast)", () => {
    useProposalVoteMock.mockReturnValue(
      baseVote({
        isAuthenticated: true,
        detail: detailWith(ProposalStatus.ACTIVE, {
          for: 100,
          against: 10,
          abstain: 5,
        }),
      }),
    );
    render(<ProposalVoteResults {...RESULTS_PROPS} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "For 87.0%, Against 8.7%, Abstain 4.3%",
    );
  });

  it("renders zero-state turnout without dividing by a zero denominator", () => {
    useProposalVoteMock.mockReturnValue(baseVote());
    render(
      <ProposalVoteResults
        {...RESULTS_PROPS}
        votesFor={0}
        votesAgainst={0}
        votesAbstain={0}
        totalPower={0}
      />,
    );
    expect(screen.getByText("0.0")).toBeInTheDocument();
  });
});
