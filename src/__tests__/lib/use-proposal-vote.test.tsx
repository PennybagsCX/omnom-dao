// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import type {
  CastVoteData,
  ProposalDetailData,
} from "@/lib/api";
import { useProposalVote } from "@/lib/use-proposal-vote";
import { VoteChoice } from "@/types";

const apiMocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useCastVote: vi.fn(),
  useChangeVote: vi.fn(),
  useProposalDetail: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  useCurrentUser: apiMocks.useCurrentUser,
  useCastVote: apiMocks.useCastVote,
  useChangeVote: apiMocks.useChangeVote,
  useProposalDetail: apiMocks.useProposalDetail,
}));

type HookResult = ReturnType<typeof useProposalVote>;

let latest: HookResult | null = null;

function Probe({ proposalId }: { proposalId: string }) {
  // Test-harness probe: capture the latest hook result for imperative asserts.
  // eslint-disable-next-line react-hooks/globals -- deliberate outer-scope capture in a test probe
  latest = useProposalVote(proposalId);
  return null;
}

function renderHook() {
  render(<Probe proposalId="prop-x" />);
  if (!latest) throw new Error("hook did not render");
  return () => latest!;
}

function mutation(impl?: () => Promise<CastVoteData>) {
  return { mutateAsync: vi.fn(impl ?? (async () => ({} as CastVoteData))), isPending: false };
}

const DETAIL_VOTED_FOR: ProposalDetailData = {
  proposal: {} as ProposalDetailData["proposal"],
  votes: { totalFor: 1, totalAgainst: 0, totalAbstain: 0 },
  voterCount: 1,
  comments: [],
  myVote: { choice: VoteChoice.FOR, votingPower: 10, votedAt: "2026-09-22T00:00:00Z" },
};

describe("useProposalVote", () => {
  it("seeds myVote from the server payload and exposes auth/power passthrough", () => {
    apiMocks.useCurrentUser.mockReturnValue({
      data: { votingPower: 42, address: "0xabc" },
    });
    apiMocks.useCastVote.mockReturnValue(mutation());
    apiMocks.useChangeVote.mockReturnValue(mutation());
    apiMocks.useProposalDetail.mockReturnValue({ data: DETAIL_VOTED_FOR });

    const get = renderHook();
    expect(get().myVote).toBe(VoteChoice.FOR);
    expect(get().isAuthenticated).toBe(true);
    expect(get().votingPower).toBe(42);
    expect(get().detail).toBe(DETAIL_VOTED_FOR);
    expect(get().isVoting).toBe(false);
  });

  it("re-syncs myVote when the server choice changes (render-sync pattern)", () => {
    apiMocks.useCurrentUser.mockReturnValue({ data: null });
    apiMocks.useCastVote.mockReturnValue(mutation());
    apiMocks.useChangeVote.mockReturnValue(mutation());
    apiMocks.useProposalDetail.mockReturnValue({ data: DETAIL_VOTED_FOR });

    const { rerender } = render(<Probe proposalId="prop-x" />);
    rerender(<Probe proposalId="prop-x" />);
    expect(latest!.myVote).toBe(VoteChoice.FOR);

    // Server now reports AGAINST (e.g. changed on another surface).
    apiMocks.useProposalDetail.mockReturnValue({
      data: {
        ...DETAIL_VOTED_FOR,
        myVote: {
          choice: VoteChoice.AGAINST,
          votingPower: 10,
          votedAt: "2026-09-22T01:00:00Z",
        },
      },
    });
    rerender(<Probe proposalId="prop-x" />);
    expect(latest!.myVote).toBe(VoteChoice.AGAINST);
  });

  it("onVote sets myVote optimistically on success and keeps it on failure", async () => {
    apiMocks.useCurrentUser.mockReturnValue({ data: null });
    const castMutation = mutation();
    const changeMutation = mutation();
    apiMocks.useCastVote.mockReturnValue(castMutation);
    apiMocks.useChangeVote.mockReturnValue(changeMutation);
    apiMocks.useProposalDetail.mockReturnValue({ data: null });

    const { rerender } = render(<Probe proposalId="prop-x" />);
    await act(async () => {
      await latest!.onVote(VoteChoice.FOR);
    });
    expect(castMutation.mutateAsync).toHaveBeenCalledWith(VoteChoice.FOR);
    expect(latest!.myVote).toBe(VoteChoice.FOR);

    // Failed change-vote must not corrupt local state.
    changeMutation.mutateAsync.mockRejectedValueOnce(new Error("409"));
    await act(async () => {
      await latest!.onChangeVote(VoteChoice.AGAINST);
    });
    expect(latest!.myVote).toBe(VoteChoice.FOR);
    rerender(<Probe proposalId="prop-x" />);
    expect(latest!.myVote).toBe(VoteChoice.FOR);
  });

  it("surfaces pending states from both mutations", () => {
    apiMocks.useCurrentUser.mockReturnValue({ data: null });
    apiMocks.useCastVote.mockReturnValue({ mutateAsync: vi.fn(), isPending: true });
    apiMocks.useChangeVote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    apiMocks.useProposalDetail.mockReturnValue({ data: null });

    render(<Probe proposalId="prop-x" />);
    expect(latest!.isVoting).toBe(true);
    expect(latest!.isChangingVote).toBe(false);
  });
});
