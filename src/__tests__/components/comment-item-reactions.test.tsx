// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommentItem, type ReactionType } from "@/components/shared/comment-item";
import type { CommentNode } from "@/lib/comment-tree";
import { ADDR_DOLPHIN } from "@/__tests__/helpers/mocks";
import type { ProposalComment } from "@/types";

function makeNode(overrides: Partial<ProposalComment> = {}): CommentNode<ProposalComment> {
  const c: ProposalComment = {
    id: "cmt-1",
    proposalId: "prop-1",
    authorAddress: ADDR_DOLPHIN,
    content: "Test comment body",
    createdAt: "2026-06-10T00:00:00.000Z",
    parentId: null,
    deletedAt: null,
    upvotes: 3,
    downvotes: 0,
    myReaction: null,
    ...overrides,
  };
  return { ...c, replies: [] };
}

function renderItem(
  node: CommentNode<ProposalComment> = makeNode(),
  overrides: Partial<Parameters<typeof CommentItem<ProposalComment>>[0]> = {},
) {
  const onReact = vi.fn<(id: string, type: ReactionType) => void>();
  const props: Parameters<typeof CommentItem<ProposalComment>>[0] = {
    node,
    depth: 0,
    myAddress: ADDR_DOLPHIN,
    isAuthenticated: true,
    replyTo: null,
    replyDraft: "",
    onReplyToggle: vi.fn(),
    onReplyDraftChange: vi.fn(),
    onReplySubmit: vi.fn(),
    isReplyPending: false,
    onReact,
    ...overrides,
  };
  return {
    ...render(<CommentItem<ProposalComment> {...props} />),
    onReact,
  };
}

describe("<CommentItem> reaction buttons", () => {
  it("renders the upvote count and the downvote count when not pressed", () => {
    renderItem(makeNode({ upvotes: 5, downvotes: 2, myReaction: null }));
    expect(screen.getByLabelText(/upvote comment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/downvote comment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upvote comment/i)).toHaveTextContent("5");
    expect(screen.getByLabelText(/downvote comment/i)).toHaveTextContent("2");
  });

  it("hides the count when zero on each button", () => {
    renderItem(makeNode({ upvotes: 0, downvotes: 0, myReaction: null }));
    expect(screen.getByLabelText(/upvote comment/i).textContent).not.toMatch(/\d/);
    expect(screen.getByLabelText(/downvote comment/i).textContent).not.toMatch(/\d/);
  });

  it("marks the upvote button as aria-pressed=true when myReaction is 'up'", () => {
    renderItem(makeNode({ myReaction: "up", upvotes: 1, downvotes: 0 }));
    expect(screen.getByLabelText(/remove upvote/i)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/downvote comment/i)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the downvote button as aria-pressed=true when myReaction is 'down'", () => {
    renderItem(makeNode({ myReaction: "down", upvotes: 0, downvotes: 1 }));
    expect(screen.getByLabelText(/remove downvote/i)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/upvote comment/i)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("fires onReact(commentId, 'up') when upvote is clicked", () => {
    const { onReact } = renderItem(makeNode({ id: "cmt-42" }));
    fireEvent.click(screen.getByLabelText(/upvote comment/i));
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenCalledWith("cmt-42", "up");
  });

  it("fires onReact(commentId, 'down') when downvote is clicked", () => {
    const { onReact } = renderItem(makeNode({ id: "cmt-7" }));
    fireEvent.click(screen.getByLabelText(/downvote comment/i));
    expect(onReact).toHaveBeenCalledWith("cmt-7", "down");
  });

  it("disables both reaction buttons when the viewer is not authenticated", () => {
    renderItem(makeNode(), { isAuthenticated: false });
    expect(screen.getByLabelText(/upvote comment/i)).toBeDisabled();
    expect(screen.getByLabelText(/downvote comment/i)).toBeDisabled();
  });

  it("disables both reaction buttons while isReacting=true", () => {
    renderItem(makeNode(), { isReacting: true });
    expect(screen.getByLabelText(/upvote comment/i)).toBeDisabled();
    expect(screen.getByLabelText(/downvote comment/i)).toBeDisabled();
  });

  it("still offers the buttons when isAuthenticated is true but myAddress is missing", () => {
    renderItem(makeNode(), { myAddress: undefined });
    // Buttons render but onReact is still callable from the parent.
    expect(screen.getByLabelText(/upvote comment/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/upvote comment/i));
  });

  it("applies the active success color class to the pressed upvote button", () => {
    renderItem(makeNode({ myReaction: "up", upvotes: 1, downvotes: 0 }));
    const btn = screen.getByLabelText(/remove upvote/i);
    expect(btn.className).toContain("text-success");
    expect(btn.className).not.toContain("text-muted-foreground");
  });

  it("applies the active danger color class to the pressed downvote button", () => {
    renderItem(makeNode({ myReaction: "down", upvotes: 0, downvotes: 1 }));
    const btn = screen.getByLabelText(/remove downvote/i);
    expect(btn.className).toContain("text-danger");
    expect(btn.className).not.toContain("text-muted-foreground");
  });

  it("applies the muted color to both buttons when nothing is pressed", () => {
    renderItem(makeNode({ myReaction: null, upvotes: 0, downvotes: 0 }));
    const up = screen.getByLabelText(/upvote comment/i);
    const down = screen.getByLabelText(/downvote comment/i);
    expect(up.className).toContain("text-muted-foreground");
    expect(down.className).toContain("text-muted-foreground");
  });

  it("meets the 44x44 minimum click target via min-h and min-w", () => {
    renderItem(makeNode());
    const up = screen.getByLabelText(/upvote comment/i);
    const down = screen.getByLabelText(/downvote comment/i);
    expect(up.className).toContain("min-h-[44px]");
    expect(up.className).toContain("min-w-[44px]");
    expect(down.className).toContain("min-h-[44px]");
    expect(down.className).toContain("min-w-[44px]");
  });

  it("applies focus-visible ring classes for keyboard focus", () => {
    renderItem(makeNode());
    const up = screen.getByLabelText(/upvote comment/i);
    expect(up.className).toMatch(/focus-visible:ring-2/);
    expect(up.className).toMatch(/focus-visible:ring-gold/);
  });
});
