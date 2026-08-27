/**
 * URL normalization for user-entered links in the proposal editor.
 *
 * Single source of truth — the editor toolbar dialog, the link bubble menu
 * and the apply command all funnel through this so previews and stored
 * hrefs can never disagree.
 */
export function normalizeLinkUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Relative links are kept as-is (same-origin routes).
  if (trimmed.startsWith("/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Non-web schemes that are safe and useful in proposals pass through
  // untouched — the https fallback below would mangle them into
  // "https://mailto:…".
  if (/^(mailto|tel):/i.test(trimmed)) return trimmed;
  // Bare domains and www. prefixes — including anything scheme-like such as
  // "javascript:…" — get an https:// prefix, which neutralizes the payload.
  return `https://${trimmed}`;
}
