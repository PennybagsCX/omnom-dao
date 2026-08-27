import { describe, expect, it } from "vitest";
import { levenshtein, normalizeForCompare, stripMarkdown } from "@/lib/text";
import { RATE_LIMITS } from "@/lib/constants";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });

  it("returns 0 for empty vs empty", () => {
    expect(levenshtein("", "")).toBe(0);
  });

  it("returns the length of the non-empty string when one is empty", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it.each([
    ["cat", "cut", 1], // one substitution
    ["kitten", "sitting", 3], // classic example
    ["flaw", "lawn", 2], // one deletion + one substitution
  ])("%s vs %s is %i", (a, b, expected) => {
    expect(levenshtein(a, b)).toBe(expected);
  });

  it("is symmetric", () => {
    expect(levenshtein("abc", "xyz")).toBe(levenshtein("xyz", "abc"));
  });

  it("returns max distance for completely different strings", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });

  it("is order-independent for transposition (counts as 2 edits)", () => {
    expect(levenshtein("ab", "ba")).toBe(2);
  });
});

describe("normalizeForCompare", () => {
  it("lowercases input", () => {
    expect(normalizeForCompare("Hello WORLD")).toBe("hello world");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeForCompare("   spaced   ")).toBe("spaced");
  });

  it("collapses internal whitespace runs to single spaces", () => {
    expect(normalizeForCompare("too    many\tspaces")).toBe("too many spaces");
  });

  it("handles empty string", () => {
    expect(normalizeForCompare("")).toBe("");
  });
});

describe("duplicate detection threshold (≤3 = duplicate)", () => {
  it("flags near-identical comments as duplicates (distance ≤ 3)", () => {
    const original = normalizeForCompare("Great proposal, fully support!");
    const typos = normalizeForCompare("Great proposal, fully suport!");
    expect(levenshtein(original, typos)).toBeLessThanOrEqual(RATE_LIMITS.duplicateDistance);
  });

  it("does not flag clearly different comments (distance > 3)", () => {
    const a = normalizeForCompare("I love this");
    const b = normalizeForCompare("This is a terrible idea honestly");
    expect(levenshtein(a, b)).toBeGreaterThan(RATE_LIMITS.duplicateDistance);
  });

  it("duplicateDistance constant is 3", () => {
    expect(RATE_LIMITS.duplicateDistance).toBe(3);
  });
});

describe("stripMarkdown", () => {
  it("removes heading markers", () => {
    expect(stripMarkdown("# Title")).toBe("Title");
    expect(stripMarkdown("### Deep heading")).toBe("Deep heading");
  });

  it("unwraps bold, italic, underscore and inline code", () => {
    expect(stripMarkdown("**bold** text")).toBe("bold text");
    expect(stripMarkdown("*italic* text")).toBe("italic text");
    expect(stripMarkdown("__strong__ and _em_")).toBe("strong and em");
    expect(stripMarkdown("use `npm test` here")).toBe("use npm test here");
  });

  it("keeps link text but drops the URL", () => {
    expect(stripMarkdown("See [the docs](https://example.com) now")).toBe(
      "See the docs now",
    );
  });

  it("strips list markers, blockquotes and horizontal rules", () => {
    expect(stripMarkdown("- item one\n* item two")).toBe("item one item two");
    expect(stripMarkdown("1. first\n2. second")).toBe("first second");
    expect(stripMarkdown("> quoted line")).toBe("quoted line");
    expect(stripMarkdown("above\n---\nbelow")).toBe("above below");
  });

  it("collapses paragraph breaks and whitespace runs", () => {
    expect(stripMarkdown("Para one.\n\n\nPara   two.")).toBe("Para one. Para two.");
  });

  it("leaves plain text untouched", () => {
    expect(stripMarkdown("Just plain text.")).toBe("Just plain text.");
  });

  it("flattens a mixed markdown document", () => {
    const doc = [
      "# Proposal Title",
      "",
      "This **proposal** covers `voting`.",
      "",
      "- Point one",
      "- Point two",
      "",
      "> Quoted rationale",
      "",
      "[Details](https://example.com)",
    ].join("\n");
    expect(stripMarkdown(doc)).toBe(
      "Proposal Title This proposal covers voting. Point one Point two Quoted rationale Details",
    );
  });
});
