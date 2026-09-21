// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalCard } from "@/components/shared/proposal-card";
import { EMOJI_REACTIONS_MAP, emptyEmojiCounts } from "@/lib/emoji-reactions";
import { makeProposal } from "@/__tests__/helpers/mocks";
import { ProposalStatus, type Proposal } from "@/types";

/**
 * ProposalCard reaction tallies: the emoji bar appears on a card only when
 * the proposal has reactions (or the viewer has reacted), and it receives
 * the real counts from the list payload.
 */

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const barSpy = vi.fn();
vi.mock("@/components/shared/emoji-reactions/emoji-reactions-bar", () => ({
  EmojiReactionsBar: (props: {
    emojiReactionCounts: Record<string, number>;
    compact: boolean;
  }) => {
    barSpy(props);
    return (
      <div data-testid="emoji-bar">
        {Object.entries(props.emojiReactionCounts)
          .filter(([, n]) => n > 0)
          .map(([key, n]) => (
            <span key={key} data-testid={`chip-${key}`}>
              {EMOJI_REACTIONS_MAP[key as keyof typeof EMOJI_REACTIONS_MAP]?.glyph}
              {n}
            </span>
          ))}
      </div>
    );
  },
}));

function renderCard(overrides: Partial<Proposal> = {}) {
  return render(<ProposalCard proposal={makeProposal(overrides)} />);
}

describe("ProposalCard — reaction tallies", () => {
  it("hides the tally when there are no reactions", () => {
    renderCard({ status: ProposalStatus.PASSED });
    expect(screen.queryByTestId("emoji-bar")).not.toBeInTheDocument();
    expect(barSpy).not.toHaveBeenCalled();
  });

  it("shows glyph + count chips for each reacted emoji", () => {
    const counts = { ...emptyEmojiCounts(), thumbs_up: 8, heart: 3, tada: 2 };
    renderCard({ status: ProposalStatus.PASSED, emojiReactionCounts: counts });
    expect(screen.getByTestId("emoji-bar")).toBeInTheDocument();
    expect(screen.getByTestId("chip-thumbs_up")).toHaveTextContent("8");
    expect(screen.getByTestId("chip-heart")).toHaveTextContent("3");
    expect(screen.getByTestId("chip-tada")).toHaveTextContent("2");
    // Zero-count emojis are not rendered as chips.
    expect(screen.queryByTestId("chip-cry")).not.toBeInTheDocument();
  });

  it("passes compact mode so tallies stay small inside list cards", () => {
    const counts = { ...emptyEmojiCounts(), heart: 1 };
    renderCard({ status: ProposalStatus.PASSED, emojiReactionCounts: counts });
    expect(barSpy).toHaveBeenCalledWith(
      expect.objectContaining({ compact: true }),
    );
  });

  it("shows the tally when the viewer reacted even at zero total (defensive)", () => {
    // A viewer reaction without counts cannot occur via the API (every
    // reaction increments a count), but the card must not crash on it.
    renderCard({
      status: ProposalStatus.PASSED,
      emojiReactionCounts: emptyEmojiCounts(),
      myEmojiReaction: "heart",
    });
    expect(screen.getByTestId("emoji-bar")).toBeInTheDocument();
  });

  it("shows a comment-count chip when the proposal has comments", () => {
    renderCard({ status: ProposalStatus.PASSED, commentCount: 4 });
    const chip = screen.getByTitle("4 comments");
    expect(chip).toHaveTextContent("4");
  });

  it("uses singular phrasing for one comment", () => {
    renderCard({ status: ProposalStatus.PASSED, commentCount: 1 });
    expect(screen.getByTitle("1 comment")).toBeInTheDocument();
  });

  it("hides the comment chip when commentCount is 0 or unknown", () => {
    renderCard({ status: ProposalStatus.PASSED, commentCount: 0 });
    expect(screen.queryByTitle("0 comments")).not.toBeInTheDocument();
    renderCard({ status: ProposalStatus.FAILED, commentCount: undefined });
    expect(screen.queryByTitle(/comments?/)).not.toBeInTheDocument();
  });

  it("shows comment chip and emoji tallies together in one engagement row", () => {
    const counts = { ...emptyEmojiCounts(), thumbs_up: 2 };
    renderCard({
      status: ProposalStatus.ACTIVE,
      commentCount: 3,
      emojiReactionCounts: counts,
    });
    expect(screen.getByTitle("3 comments")).toBeInTheDocument();
    expect(screen.getByTestId("chip-thumbs_up")).toBeInTheDocument();
  });
});
