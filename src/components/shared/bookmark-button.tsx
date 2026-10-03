"use client";

import { useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  isBookmarked,
  subscribeToBookmarks,
  toggleBookmark,
} from "@/lib/bookmarks";

/**
 * Bookmark toggle for a proposal. Lives inside proposal tiles (which are
 * links), so it swallows clicks — the card link must not navigate when the
 * user is bookmarking.
 */
export function BookmarkButton({
  proposalId,
  className,
}: {
  proposalId: string;
  className?: string;
}) {
  const on = useSyncExternalStore(
    subscribeToBookmarks,
    () => isBookmarked(proposalId),
    () => false
  );

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove bookmark" : "Bookmark proposal"}
      title={on ? "Remove bookmark" : "Bookmark proposal"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(proposalId);
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-elevated/80 text-muted-foreground shadow-sm backdrop-blur transition-colors",
        "hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        on && "border-gold/60 text-gold",
        className
      )}
    >
      <Bookmark className={cn("h-4 w-4", on && "fill-gold")} aria-hidden />
      <span className="sr-only">{on ? "Remove bookmark" : "Bookmark proposal"}</span>
    </button>
  );
}
