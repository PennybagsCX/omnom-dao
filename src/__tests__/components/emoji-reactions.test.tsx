// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EmojiBar } from "@/components/shared/emoji-reactions/emoji-bar";
import {
  EMOJI_KEYS,
  EMOJI_REACTIONS_MAP,
  emptyEmojiCounts,
} from "@/lib/emoji-reactions";
import type { EmojiKey, EmojiReactionCounts } from "@/types";

function renderBar(
  overrides: Partial<{
    counts: EmojiReactionCounts;
    mine: EmojiKey | null;
    isAuth: boolean;
    onReact: (k: EmojiKey) => void;
    isPending: boolean;
  }> = {},
) {
  const onReact = overrides.onReact ?? vi.fn<(k: EmojiKey) => void>();
  const counts = overrides.counts ?? emptyEmojiCounts();
  const mine = overrides.mine ?? null;
  const isAuth = overrides.isAuth ?? true;
  const isPending = overrides.isPending ?? false;
  return {
    ...render(
      <EmojiBar
        emojiReactionCounts={counts}
        myEmojiReaction={mine}
        isAuthenticated={isAuth}
        isPending={isPending}
        onReact={onReact}
      />,
    ),
    onReact,
  };
}

describe("<EmojiBar>", () => {
  it("renders zero chips when counts are all zero and user has no reaction", () => {
    const { container } = renderBar();
    // No chips at all — only the `+` picker trigger is rendered.
    const chips = container.querySelectorAll('[aria-pressed]');
    expect(chips).toHaveLength(0);
  });

  it("renders a chip only for emojis with count > 0", () => {
    const counts = { ...emptyEmojiCounts(), heart: 3, thumbs_up: 1 };
    const { container } = renderBar({ counts });
    const chips = container.querySelectorAll('[aria-pressed]');
    expect(chips).toHaveLength(2);
    expect(screen.getByLabelText(/add heart reaction, 3 total/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/add thumbs up reaction, 1 total/i)).toBeInTheDocument();
  });

  it("renders a chip for the user's own reaction even when count is 0 (just-clicked)", () => {
    const { container } = renderBar({ mine: "tada" });
    const chips = container.querySelectorAll('[aria-pressed]');
    expect(chips).toHaveLength(1);
    expect(screen.getByLabelText(/remove tada reaction/i)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("marks the user's active chip with aria-pressed=true and the gold background class", () => {
    const { container } = renderBar({ mine: "thumbs_up" });
    const btn = screen.getByLabelText(/remove thumbs up reaction/i);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("border-gold");
  });

  it("marks non-active chips with aria-pressed=false", () => {
    const counts = { ...emptyEmojiCounts(), heart: 1 };
    renderBar({ counts });
    expect(screen.getByLabelText(/add heart reaction/i)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("fires onReact with the matching EmojiKey when a chip is clicked", () => {
    const counts = { ...emptyEmojiCounts(), heart: 2 };
    const { onReact } = renderBar({ counts });
    fireEvent.click(screen.getByLabelText(/add heart reaction/i));
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenCalledWith("heart");
  });

  it("disables all chips when the viewer is not authenticated", () => {
    const counts = { ...emptyEmojiCounts(), heart: 1 };
    renderBar({ counts, isAuth: false });
    expect(screen.getByLabelText(/add heart reaction/i)).toBeDisabled();
  });

  it("disables all chips while isPending=true", () => {
    const counts = { ...emptyEmojiCounts(), heart: 1 };
    renderBar({ counts, isPending: true });
    expect(screen.getByLabelText(/add heart reaction/i)).toBeDisabled();
  });

  it("hides the picker trigger when not authenticated", () => {
    renderBar({ isAuth: false });
    expect(screen.queryByLabelText(/add emoji reaction/i)).not.toBeInTheDocument();
  });

  it("renders the picker trigger when authenticated", () => {
    renderBar({ isAuth: true });
    expect(screen.getByLabelText(/add emoji reaction/i)).toBeInTheDocument();
  });

  it("each chip meets the 44x44 minimum hit target", () => {
    const counts = { ...emptyEmojiCounts(), heart: 1 };
    renderBar({ counts });
    const btn = screen.getByLabelText(/add heart reaction/i);
    expect(btn.className).toContain("min-h-[44px]");
    expect(btn.className).toContain("min-w-[44px]");
  });

  it("supports the full 8 emoji keys", () => {
    expect(EMOJI_KEYS).toHaveLength(8);
    for (const key of EMOJI_KEYS) {
      expect(EMOJI_REACTIONS_MAP[key].glyph).toBeTruthy();
      expect(EMOJI_REACTIONS_MAP[key].ariaLabel).toMatch(/^React with /);
    }
  });
});