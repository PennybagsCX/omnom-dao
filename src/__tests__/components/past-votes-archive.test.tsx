// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  PastVotesArchive,
  type PastVoteItem,
} from "@/components/vote/past-votes-archive";
import { ProposalStatus } from "@/types";

const FGE_ITEM: PastVoteItem = {
  key: "fge-foundational-2026",
  kind: "ELECTION",
  label: "Foundational Governance Election",
  windowLabel: "Aug 29, 2026 – Sep 12, 2026 (UTC)",
  electionResults: [
    { choice: "QUADRATIC", label: "Quadratic voting", count: 23, percentage: 65.7 },
    { choice: "ONE_WALLET_ONE_VOTE", label: "One wallet, one vote", count: 5, percentage: 14.3 },
    { choice: "TIERED", label: "Tiered voting", count: 1, percentage: 2.9 },
    { choice: "LINEAR", label: "Linear token voting", count: 6, percentage: 17.1 },
  ],
  totalBallots: 35,
  href: "/governance-vote",
};

const PASSED_ITEM: PastVoteItem = {
  key: "prop-passed-treasury-grant",
  kind: "PROPOSAL",
  label: "Fund Community Tooling Grant (50,000 $OMNOM)",
  status: ProposalStatus.PASSED,
  windowLabel: "Jun 6, 2026 – Jun 13, 2026 (UTC)",
  tallies: { for: 2_181_500, against: 85, abstain: 0 },
  quorum: { achieved: 27.3, required: 10 },
  href: "/proposals/prop-passed-treasury-grant",
};

describe("<PastVotesArchive />", () => {
  it("renders the dropdown trigger with a 44px mobile touch target", () => {
    render(<PastVotesArchive items={[FGE_ITEM, PASSED_ITEM]} />);
    const trigger = screen.getByTestId("past-votes-select");
    expect(trigger.className).toContain("h-11");
    expect(trigger.className).toContain("sm:h-9");
  });

  it("defaults to the first item (FGE) and shows its winner banner + per-choice bars", () => {
    render(<PastVotesArchive items={[FGE_ITEM, PASSED_ITEM]} />);
    expect(
      screen.getByRole("heading", { name: "Foundational Governance Election" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Winning choice")).toBeInTheDocument();
    // The winner label appears in both the banner and its per-choice bar row.
    expect(screen.getAllByText("Quadratic voting").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("65.7% of 35 ballots")).toBeInTheDocument();
    // All four choices with ballot counts.
    expect(screen.getByText("23 ballots")).toBeInTheDocument();
    expect(screen.getByText("6 ballots")).toBeInTheDocument();
    // Deep link to the FGE archive page.
    expect(screen.getByRole("link", { name: /view full details/i })).toHaveAttribute(
      "href",
      "/governance-vote",
    );
  });

  it("shows the zero-ballot state without a winner banner", () => {
    render(
      <PastVotesArchive
        items={[{ ...FGE_ITEM, totalBallots: 0, electionResults: [] }]}
      />,
    );
    expect(screen.queryByText("Winning choice")).not.toBeInTheDocument();
  });

  it("shows a proposal's outcome badge, tallies grid, and quorum progress", () => {
    render(<PastVotesArchive items={[PASSED_ITEM]} />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("2,181,500")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    // QuorumProgress renders green at 27.3 / 10.
    expect(screen.getByText(/Quorum reached/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view full details/i })).toHaveAttribute(
      "href",
      "/proposals/prop-passed-treasury-grant",
    );
  });

  it("renders an em dash when quorum was never recorded", () => {
    render(
      <PastVotesArchive
        items={[{ ...PASSED_ITEM, quorum: { achieved: null, required: 10 } }]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    // No QuorumProgress bar without a real number.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders a muted fallback with no items", () => {
    render(<PastVotesArchive items={[]} />);
    expect(screen.queryByTestId("past-votes-select")).not.toBeInTheDocument();
    expect(screen.getByText(/no past votes yet/i)).toBeInTheDocument();
  });
});
