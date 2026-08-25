/**
 * Text utilities for anti-spam checks (fuzzy duplicate detection).
 */

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used to flag near-duplicate comments / proposals per the
 * GOVERNANCE_MECHANICS.md §10.3 anti-spam rules.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP array.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1, // insertion
        prev[j]! + 1, // deletion
        prev[j - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Normalize text for fuzzy comparison (lowercase, collapse whitespace). */
export function normalizeForCompare(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Strip common Markdown syntax to produce a clean plain-text excerpt.
 * Used for proposal card previews where full markdown rendering would be
 * too heavy.
 */
export function stripMarkdown(md: string): string {
  return md
    // Remove headings markers (#, ##, etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove horizontal rules
    .replace(/^---+$/gm, "")
    // Collapse whitespace
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}
