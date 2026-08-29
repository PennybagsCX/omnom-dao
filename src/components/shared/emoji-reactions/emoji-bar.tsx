"use client";

/**
 * Emoji reaction bar — the visible chip row + picker.
 *
 * Renders a chip for every emoji with a non-zero count OR that the current
 * user has reacted with. Trailing `+` trigger opens the picker (hidden when
 * the viewer isn't authenticated). Clicking an existing chip toggles it off
 * via the parent callback.
 *
 * This component is purely visual — it does NOT own React Query hooks.
 * The parent (`EmojiReactionsBar`) wires the hook so this stays a simple
 * pure props → tree component.
 */

import { EmojiPicker } from "@/components/shared/emoji-reactions/emoji-picker";
import { EMOJI_REACTIONS } from "@/lib/emoji-reactions";
import { cn } from "@/lib/utils";
import type { EmojiKey, EmojiReactionCounts } from "@/types";

interface EmojiBarProps {
  emojiReactionCounts: EmojiReactionCounts;
  myEmojiReaction: EmojiKey | null;
  isAuthenticated: boolean;
  isPending: boolean;
  onReact: (emoji: EmojiKey) => void;
  /** Optional compact mode (fewer hit-target padding) for use inside dense
   *  list cards / rows. */
  compact?: boolean;
}

export function EmojiBar({
  emojiReactionCounts,
  myEmojiReaction,
  isAuthenticated,
  isPending,
  onReact,
  compact = false,
}: EmojiBarProps) {
  // Render only emojis that have at least one reaction OR are the user's pick.
  const visible = EMOJI_REACTIONS.filter((meta) => {
    const count = emojiReactionCounts[meta.key] ?? 0;
    return count > 0 || myEmojiReaction === meta.key;
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-1", !compact && "mt-2")}>
      {visible.map((meta) => {
        const count = emojiReactionCounts[meta.key] ?? 0;
        const isActive = myEmojiReaction === meta.key;
        const disabled = !isAuthenticated || isPending;
        const ariaLabel = isActive
          ? `Remove ${meta.label.toLowerCase()} reaction${count > 0 ? `, ${count} total` : ""}${isAuthenticated ? ", you reacted" : ""}`
          : `Add ${meta.label.toLowerCase()} reaction${count > 0 ? `, ${count} total` : ""}`;
        return (
          <button
            key={meta.key}
            type="button"
            onClick={() => onReact(meta.key)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={ariaLabel}
            className={cn(
              "inline-flex min-h-[44px] items-center justify-center gap-0.5 rounded-full border px-2 text-xs transition-colors",
              compact ? "min-w-[44px]" : "min-w-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated",
              "disabled:opacity-50",
              isActive
                ? "border-gold/60 bg-gold/10 text-foreground"
                : "border-border bg-bg-elevated/40 text-muted-foreground hover:bg-bg-elevated hover:text-foreground",
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              {meta.glyph}
            </span>
            {count > 0 && <span className="font-mono tabular-nums">{count}</span>}
          </button>
        );
      })}
      <EmojiPicker enabled={isAuthenticated} onSelect={onReact} />
    </div>
  );
}