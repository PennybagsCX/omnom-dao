// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProposalVoteActions } from "@/components/proposals/proposal-vote-actions";
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

function detailWithStatus(status: ProposalStatus): ProposalDetailData {
  return {
    proposal: { status } as unknown as ProposalDetailData["proposal"],
    votes: { totalFor: 0, totalAgainst: 0, totalAbstain: 0 },
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
    ...overrides,
  };
}

function renderActions(
  vote: UseProposalVoteResult,
  props: { isActive?: boolean; closedLabel?: string } = {},
) {
  useProposalVoteMock.mockReturnValue(vote);
  return render(
    <ProposalVoteActions
      proposalId="prop-x"
      isActive={props.isActive ?? true}
      closedLabel={props.closedLabel ?? "Voting closed — outcome pending"}
    />,
  );
}

describe("<ProposalVoteActions />", () => {
  it("renders the live VoteBar from the server fallback tallies", () => {
    useProposalVoteMock.mockReturnValue(baseVote());
    render(
      <ProposalVoteActions
        proposalId="prop-x"
        isActive
        votesFor={60}
        votesAgainst={30}
        votesAbstain={10}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "For 60.0%, Against 30.0%, Abstain 10.0%",
    );
  });

  it("prefers the detail query's tallies once resolved (live bar after a cast)", () => {
    const detail = detailWithStatus(ProposalStatus.ACTIVE);
    detail.proposal = {
      ...detail.proposal,
      votesFor: 100,
      votesAgainst: 10,
      votesAbstain: 5,
    } as ProposalDetailData["proposal"];
    useProposalVoteMock.mockReturnValue(baseVote({ isAuthenticated: true, detail }));
    render(
      <ProposalVoteActions
        proposalId="prop-x"
        isActive
        votesFor={60}
        votesAgainst={30}
        votesAbstain={10}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "For 87.0%, Against 8.7%, Abstain 4.3%",
    );
  });

  it("unauthenticated + active: shows the connect prompt and zero choice buttons", () => {
    renderActions(baseVote());
    expect(screen.getByText(/connect your wallet to vote/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect to vote/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });

  it("authenticated but detail unresolved: neutral checking state (no doomed casts)", () => {
    renderActions(baseVote({ isAuthenticated: true }));
    expect(screen.getByText(/checking your vote…/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });

  it("authenticated + unvoted + resolved: three 44px row-variant choice buttons", () => {
    renderActions(
      baseVote({
        isAuthenticated: true,
        detail: detailWithStatus(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByText("Cast your vote")).toBeInTheDocument();
    for (const name of [/^for$/i, /^against$/i, /^abstain$/i]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.className).toContain("min-h-11");
    }
  });

  it("clicking FOR calls onVote with VoteChoice.FOR", async () => {
    const user = userEvent.setup();
    const onVote = vi.fn(async () => {});
    renderActions(
      baseVote({
        isAuthenticated: true,
        detail: detailWithStatus(ProposalStatus.ACTIVE),
        onVote,
      }),
    );
    await user.click(screen.getByRole("button", { name: /^for$/i }));
    expect(onVote).toHaveBeenCalledWith(VoteChoice.FOR);
  });

  it("voted: shows the recorded choice chip and a Change Vote affordance", () => {
    renderActions(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        detail: detailWithStatus(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByText(/you voted:/i)).toBeInTheDocument();
    expect(screen.getByText(/your vote has been recorded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change vote/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^against$/i })).not.toBeInTheDocument();
  });

  it("changing: buttons return with Cancel, and onChangeVote receives the new choice", async () => {
    const user = userEvent.setup();
    const onChangeVote = vi.fn(async () => {});
    renderActions(
      baseVote({
        isAuthenticated: true,
        myVote: VoteChoice.FOR,
        onChangeVote,
        detail: detailWithStatus(ProposalStatus.ACTIVE),
      }),
    );
    await user.click(screen.getByRole("button", { name: /change vote/i }));
    expect(screen.getByText("Change your vote")).toBeInTheDocument();
    const against = screen.getByRole("button", { name: /^against$/i });
    await user.click(against);
    await waitFor(() =>
      expect(onChangeVote).toHaveBeenCalledWith(VoteChoice.AGAINST),
    );
  });

  it("casting: buttons are disabled and a status-announced casting indicator shows", () => {
    renderActions(
      baseVote({
        isAuthenticated: true,
        isVoting: true,
        detail: detailWithStatus(ProposalStatus.ACTIVE),
      }),
    );
    expect(screen.getByRole("button", { name: /^for$/i })).toBeDisabled();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/casting vote…/i);
  });

  it("closed (server hint): shows the closedLabel and no voting affordances", () => {
    renderActions(baseVote(), { isActive: false });
    expect(screen.getByText("Voting closed — outcome pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect to vote/i })).not.toBeInTheDocument();
  });

  it("a stale ACTIVE card flips itself to closed once the server status resolves", () => {
    // detail present with a finalized status — server hint is ignored.
    renderActions(
      baseVote({
        isAuthenticated: true,
        detail: detailWithStatus(ProposalStatus.PASSED),
      }),
    );
    expect(screen.getByText("Voting closed — outcome pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^for$/i })).not.toBeInTheDocument();
  });
});
