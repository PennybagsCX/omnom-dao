import { describe, expect, it } from "vitest";

import { buildCommentTree } from "@/lib/comment-tree";

/**
 * Minimal comment shape for tree-building tests — mirrors the structural
 * minimum that `BaseComment` enforces. The tree helper is generic, so any
 * concrete comment type with `id` + `parentId` flows through unchanged.
 */
interface FakeComment {
  id: string;
  parentId: string | null;
  content: string;
}

function make(comments: Array<[string, string | null, string]>): FakeComment[] {
  return comments.map(([id, parentId, content]) => ({ id, parentId, content }));
}

describe("buildCommentTree", () => {
  it("returns an empty list for empty input", () => {
    expect(buildCommentTree<FakeComment>([])).toEqual([]);
  });

  it("treats parentId === null as a root", () => {
    const tree = buildCommentTree(make([["a", null, "root"]]));
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("a");
    expect(tree[0]?.replies).toEqual([]);
  });

  it("treats unknown parentId as a root (orphan reply)", () => {
    const tree = buildCommentTree(make([["a", "missing", "orphan"]]));
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("a");
  });

  it("nests replies under their parent", () => {
    const tree = buildCommentTree(
      make([
        ["root", null, "root"],
        ["r1", "root", "reply 1"],
        ["r2", "root", "reply 2"],
      ]),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.replies.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("preserves input order for roots and replies", () => {
    const tree = buildCommentTree(
      make([
        ["root", null, "first"],
        ["other", null, "second"],
        ["r1", "root", "reply of first"],
        ["r2", "other", "reply of second"],
      ]),
    );
    expect(tree.map((n) => n.id)).toEqual(["root", "other"]);
    expect(tree[0]?.replies.map((r) => r.id)).toEqual(["r1"]);
    expect(tree[1]?.replies.map((r) => r.id)).toEqual(["r2"]);
  });

  it("supports multi-level nesting", () => {
    const tree = buildCommentTree(
      make([
        ["root", null, "root"],
        ["l1", "root", "L1"],
        ["l2", "l1", "L2"],
        ["l3", "l2", "L3"],
      ]),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.replies).toHaveLength(1);
    expect(tree[0]?.replies[0]?.replies).toHaveLength(1);
    expect(tree[0]?.replies[0]?.replies[0]?.replies).toHaveLength(1);
  });

  it("preserves arbitrary fields on the source type", () => {
    interface RichComment {
      id: string;
      parentId: string | null;
      content: string;
      upvotes: number;
      deletedAt: string | null;
    }
    const input: RichComment[] = [
      { id: "a", parentId: null, content: "hi", upvotes: 7, deletedAt: null },
    ];
    const tree = buildCommentTree<RichComment>(input);
    expect(tree[0]?.upvotes).toBe(7);
  });

  it("does not mutate the input array", () => {
    const input = make([
      ["root", null, "r"],
      ["r1", "root", "reply"],
    ]);
    const before = JSON.stringify(input);
    buildCommentTree(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
