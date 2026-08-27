import { describe, expect, it } from "vitest";

import { normalizeLinkUrl } from "@/lib/link-url";

describe("normalizeLinkUrl", () => {
  it.each([
    // Empty / whitespace-only input normalizes to "" (removal signal).
    ["", ""],
    ["   ", ""],
    ["\t\n ", ""],
    // Full URLs pass through untouched.
    ["https://example.com", "https://example.com"],
    ["http://example.com/path?q=1#frag", "http://example.com/path?q=1#frag"],
    ["HTTPS://EXAMPLE.COM/PATH", "HTTPS://EXAMPLE.COM/PATH"],
    // Bare domains and www. prefixes gain a scheme.
    ["www.example.com", "https://www.example.com"],
    ["example.com", "https://example.com"],
    ["sub.domain.example.com/path", "https://sub.domain.example.com/path"],
    // Relative (same-origin) routes are kept as-is.
    ["/proposals", "/proposals"],
    ["/proposals/prop-123?tab=votes", "/proposals/prop-123?tab=votes"],
    // Surrounding whitespace is trimmed.
    ["  https://example.com  ", "https://example.com"],
    ["\nwww.example.com\t", "https://www.example.com"],
    // Anything scheme-like that is not http(s) — e.g. a javascript: payload —
    // is prefixed, which neutralizes it as a relative https URL.
    ["javascript:alert(1)", "https://javascript:alert(1)"],
    ["JAVASCRIPT:alert(1)", "https://JAVASCRIPT:alert(1)"],
    ["data:text/html;base64,AAAA", "https://data:text/html;base64,AAAA"],
    // The two non-web schemes worth linking in a proposal pass through
    // untouched — the https fallback used to mangle them.
    ["mailto:hello@omnom.io", "mailto:hello@omnom.io"],
    ["MAILTO:hello@omnom.io", "MAILTO:hello@omnom.io"],
    ["tel:+15551234567", "tel:+15551234567"],
  ])("normalizeLinkUrl(%j) → %j", (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected);
  });
});
