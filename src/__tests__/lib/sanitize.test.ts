import { describe, expect, it } from "vitest";
import { sanitizeContent, sanitizePlainText } from "@/lib/sanitize";

describe("sanitizeContent", () => {
  it("removes <script> tag markup (inner text left as inert, non-executing text)", () => {
    const input = "Hello<script>alert('xss')</script> world";
    expect(sanitizeContent(input)).toBe("Helloalert('xss') world");
  });

  it("strips <iframe> tags", () => {
    const input = 'before<iframe src="evil.com"></iframe>after';
    expect(sanitizeContent(input)).toBe("beforeafter");
  });

  it("strips generic HTML tags but keeps inner text", () => {
    expect(sanitizeContent("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("strips event handler attributes via tag removal", () => {
    const input = '<div onclick="steal()">x</div>';
    expect(sanitizeContent(input)).toBe("x");
  });

  it("neutralizes javascript: URLs in href", () => {
    const input = 'see <a href="javascript:alert(1)">link</a>';
    // The tag is fully removed, but the dangerous protocol must not survive.
    const out = sanitizeContent(input);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("link");
  });

  it("neutralizes data: URLs in src", () => {
    const input = '<img src="data:text/html,evil" />';
    const out = sanitizeContent(input);
    expect(out).not.toContain("data:");
  });

  it("preserves safe markdown-like content", () => {
    const md = "# Heading\n\nSome **bold** text and a [link](https://example.com).";
    expect(sanitizeContent(md)).toBe(md);
  });

  it("preserves angle brackets used as plain punctuation", () => {
    expect(sanitizeContent("a < b and c > d")).toBe("a < b and c > d");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeContent("")).toBe("");
  });
});

describe("sanitizePlainText", () => {
  it("removes angle brackets", () => {
    expect(sanitizePlainText("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizePlainText("  display name  ")).toBe("display name");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizePlainText("")).toBe("");
  });

  it("handles plain text with no special chars unchanged", () => {
    expect(sanitizePlainText("Vitalik.eth")).toBe("Vitalik.eth");
  });
});
