// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { LiveVoteCard } from "@/components/vote/live-vote-card";

// The embedded vote island carries the wagmi/React Query surface — the card
// itself is a server shell; its state machine is covered in
// proposal-vote-actions.test.tsx.
vi.mock("@/components/proposals/proposal-vote-actions", () => ({
  ProposalVoteActions: () => <div data-testid="proposal-vote-actions" />,
}));

const PROPS = {
  id: "prop-active-quorum-default",
  title: "Governance parameter: global default quorum",
  typeLabel: "General",
  endsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  votesFor: 9_867_109,
  votesAgainst: 5_348_732,
  votesAbstain: 14_524,
  quorumRequired: 5,
  description:
    "## TL;DR\n\n**One question: how many people need to vote before a result counts?**\n\n- **VOTE FOR** to adopt a single **5% global default quorum**.",
};

describe("<LiveVoteCard />", () => {
  it("renders the testid hook, title link, status badge, and type label", () => {
    render(<LiveVoteCard {...PROPS} />);
    expect(
      screen.getByTestId("vote-live-card-prop-active-quorum-default"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: PROPS.title });
    expect(link).toHaveAttribute("href", "/proposals/prop-active-quorum-default");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("renders the quorum requirement and passes tallies to the vote island", () => {
    render(<LiveVoteCard {...PROPS} />);
    expect(screen.getByText(/Quorum required:/)).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
    // The live VoteBar + cast controls live inside the (mocked) island.
    expect(screen.getByTestId("proposal-vote-actions")).toBeInTheDocument();
  });

  it("shows a countdown panel with an explicit closed state (never the stale default)", () => {
    const { container } = render(<LiveVoteCard {...PROPS} />);
    const timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer).toHaveAttribute("data-state", "active");
  });

  it("renders the explicit closedText once the window has passed (cron-lag state)", () => {
    const { container } = render(
      <LiveVoteCard
        {...PROPS}
        endsAt={new Date(Date.now() - 60 * 60 * 1000).toISOString()}
      />,
    );
    const timer = container.querySelector('[data-testid="countdown-timer"]');
    expect(timer).toHaveAttribute("data-state", "closed");
    expect(timer).toHaveTextContent("Voting closed — outcome pending");
    // The stale component default must never appear on the vote hub.
    expect(container.textContent).not.toContain("Voting is now live");
  });

  it("embeds the vote actions island and the deep-link CTA", () => {
    render(<LiveVoteCard {...PROPS} />);
    expect(screen.getByTestId("proposal-vote-actions")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open proposal for full details/i }),
    ).toHaveAttribute("href", "/proposals/prop-active-quorum-default");
  });

  it("collapses the markdown body to a plain-text teaser", () => {
    render(<LiveVoteCard {...PROPS} />);
    expect(
      screen.getByText(/One question: how many people need to vote/),
    ).toBeInTheDocument();
    // Markdown markers are stripped.
    expect(screen.queryByText(/## TL;DR/)).not.toBeInTheDocument();
  });

  it("long titles wrap via line-clamp (mobile guard)", () => {
    render(
      <LiveVoteCard
        {...PROPS}
        title="An exceptionally long governance proposal title that must wrap gracefully on narrow viewports without ever widening the page"
      />,
    );
    const link = screen.getByRole("link", {
      name: /exceptionally long governance proposal title/,
    });
    expect(link.className).toContain("line-clamp-2");
    expect(link.className).toContain("break-words");
  });
});
