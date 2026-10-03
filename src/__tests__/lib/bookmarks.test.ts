import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBookmarkedIds,
  isBookmarked,
  subscribeToBookmarks,
  toggleBookmark,
} from "@/lib/bookmarks";

// Minimal localStorage stand-in (vitest runs in a node environment).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", localStorageStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bookmarks store", () => {
  it("starts empty and toggles a bookmark on", () => {
    expect(getBookmarkedIds()).toEqual([]);
    expect(toggleBookmark("p1")).toBe(true);
    expect(isBookmarked("p1")).toBe(true);
    expect(getBookmarkedIds()).toEqual(["p1"]);
  });

  it("toggles the same id off again", () => {
    toggleBookmark("p1");
    expect(toggleBookmark("p1")).toBe(false);
    expect(isBookmarked("p1")).toBe(false);
    expect(getBookmarkedIds()).toEqual([]);
  });

  it("keeps other bookmarks when removing one", () => {
    toggleBookmark("a");
    toggleBookmark("b");
    toggleBookmark("a");
    expect(getBookmarkedIds()).toEqual(["b"]);
  });

  it("corrupt storage reads as an empty list instead of throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "not-json",
      setItem: () => {},
    });
    expect(getBookmarkedIds()).toEqual([]);
    expect(isBookmarked("p1")).toBe(false);
  });

  it("notifies subscribers on change", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToBookmarks(onChange);
    toggleBookmark("p1");
    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });
});
