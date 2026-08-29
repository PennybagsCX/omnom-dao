/**
 * Comment threading utilities — shared between proposal comments and election
 * comments. Both surfaces return flat arrays ordered by `created_at ASC`, and
 * both need to be displayed as a tree of replies nested up to depth 3.
 */

/**
 * Minimal shape every threaded comment must satisfy. Proposal comments,
 * election comments, and any future surface share this contract.
 */
export interface BaseComment {
  id: string;
  parentId: string | null;
  /** Other fields are read by callers via the original concrete type. */
}

/**
 * Tree-augmented comment node with nested replies. The concrete comment type
 * (e.g. `ProposalComment`, `ElectionComment`) is preserved via the generic so
 * callers can keep their fully-typed UI.
 */
export type CommentNode<T extends BaseComment> = T & {
  replies: CommentNode<T>[];
};

/**
 * Build a reply tree from a flat, `created_at ASC`-ordered list of comments.
 *
 * Algorithm — two passes over the input:
 *   1. Wrap each comment in a `replies: []` node, indexed by id.
 *   2. Link parents: if `parentId` resolves to a known node, push the child
 *      onto that parent's `replies`; otherwise treat it as a root.
 *
 * Notes:
 *   - Roots are returned in their original input order (preserving `created_at`
 *     ASC). Replies within a parent are also in input order.
 *   - Orphan replies (parent missing from the page slice) are surfaced as
 *     roots so users can still see them.
 *   - Pure function — safe to memoise with `useMemo`.
 */
export function buildCommentTree<T extends BaseComment>(comments: T[]): CommentNode<T>[] {
  const byId = new Map<string, CommentNode<T>>();
  const roots: CommentNode<T>[] = [];

  // First pass: create nodes.
  for (const c of comments) {
    byId.set(c.id, { ...c, replies: [] });
  }

  // Second pass: link parents.
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
