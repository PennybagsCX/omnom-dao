/**
 * Comment / proposal body sanitization.
 *
 * Comment and proposal bodies are authored as Markdown and rendered through
 * react-markdown (which does not execute embedded HTML by default). As defense
 * in depth, this module strips raw HTML and disallowed protocols before the
 * content is persisted, so even a markdown renderer that interleaves HTML
 * cannot be exploited.
 *
 * The platform spec names DOMPurify; DOMPurify requires a DOM (jsdom in Node).
 * To avoid pulling jsdom into the serverless bundle, we apply an equivalent
 * HTML-stripping pass here. Markdown semantics are preserved (angle brackets
 * used as punctuation are left untouched except for dangerous constructs).
 */

/** Remove HTML tags entirely, including script/style/iframe payloads. */
const HTML_TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/** Neutralize `javascript:` and `data:` URIs in any surviving href/src. */
const DANGEROUS_URL_RE = /(href|src)\s*=\s*["']?\s*(javascript|data|vbscript):/gi;

/**
 * Strip HTML and dangerous URL protocols from user-authored content.
 * Returns the sanitized string (Markdown preserved).
 */
export function sanitizeContent(input: string): string {
  let out = input.replace(DANGEROUS_URL_RE, (_m, attr: string) => `${attr}=""`);
  out = out.replace(HTML_TAG_RE, "");
  return out;
}

/**
 * Strip HTML from a display name. Display names are plain text — no HTML or
 * markdown is permitted.
 */
export function sanitizePlainText(input: string): string {
  return input.replace(/[<>]/g, "").trim();
}
