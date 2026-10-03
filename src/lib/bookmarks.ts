/**
 * Client-side bookmark store (v1): proposal ids in localStorage, with a
 * pub/sub so every open BookmarkButton and the dashboard list stay in sync.
 *
 * Deliberately local-only for v1 — no wallet/auth coupling — matching the
 * dashboard's "Bookmarked Proposals" placeholder that shipped empty.
 */

const STORAGE_KEY = "bookmarked-proposals";

/** Fired on the internal bus whenever the bookmark set changes. */
export const BOOKMARKS_CHANGED_EVENT = "bookmarks-changed";

// Internal change bus — a plain EventTarget, so the store behaves identically
// in the browser and in node (test) environments where window APIs may not
// exist. Cross-tab sync rides the `storage` event on top of this.
const bus = new EventTarget();

// Module-level cache: useSyncExternalStore requires getSnapshot to return a
// stable reference, so re-parse only when the raw value actually changes.
let cachedIds: string[] = [];
let lastRaw: string | null = null;

function readIds(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    if (raw === lastRaw) return cachedIds;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedIds = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
    lastRaw = raw;
    return cachedIds;
  } catch {
    // Unreadable/corrupt storage — behave like an empty bookmark list
    // rather than crashing every surface that renders the bookmark state.
    cachedIds = [];
    lastRaw = null;
    return cachedIds;
  }
}

function writeIds(ids: string[]) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(ids));
  bus.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
}

export function getBookmarkedIds(): string[] {
  return readIds();
}

export function isBookmarked(proposalId: string): boolean {
  return readIds().includes(proposalId);
}

/** Toggle a bookmark; returns the new state for the proposal. */
export function toggleBookmark(proposalId: string): boolean {
  const current = readIds();
  const next = current.includes(proposalId)
    ? current.filter((id) => id !== proposalId)
    : [...current, proposalId];
  writeIds(next);
  return next.includes(proposalId);
}

/** Subscribe to bookmark changes (internal bus + cross-tab `storage`). */
export function subscribeToBookmarks(onChange: () => void): () => void {
  const listener = () => onChange();
  bus.addEventListener(BOOKMARKS_CHANGED_EVENT, listener);
  // Cross-tab: the browser fires `storage` on window for other tabs' writes.
  globalThis.addEventListener?.("storage", onChange);
  return () => {
    bus.removeEventListener(BOOKMARKS_CHANGED_EVENT, listener);
    globalThis.removeEventListener?.("storage", onChange);
  };
}
