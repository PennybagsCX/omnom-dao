"use client";

/**
 * Lightweight emoji picker for comment composers — a trigger button plus a
 * small curated grid. Built in-house on purpose: the app needs ~80 sensible
 * emojis (dog + voting themed), not a 300KB Unicode catalog with search
 * indexes, and there is no popover primitive in components/ui to hang one
 * off.
 *
 * Behavior: click the smile to open; pick an emoji (stored in a small
 * "recent" set in localStorage and surfaced first next time); close via
 * outside click, Escape, or picking. Purely presentational — the parent
 * owns the text state and receives selections through `onSelect`.
 *
 * For inserting at the textarea's caret, pair with `spliceAtCursor` below.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmojiGroup {
  /** Tab glyph + accessible name. */
  name: string;
  icon: string;
  emojis: string[];
}

/** Curated sets — on-brand for a dog-token DAO: reactions, votes, rockets. */
const SMILEYS: EmojiGroup = {
  name: "Smileys",
  icon: "😀",
  emojis: [
    "😀", "😄", "😅", "😂", "🤣", "😊", "😍", "🤔",
    "😎", "🤯", "😴", "🫠", "😏", "😭", "🤬", "🤡",
  ],
};

const GROUPS: EmojiGroup[] = [
  SMILEYS,
  {
    name: "Gestures",
    icon: "👍",
    emojis: [
      "👍", "👎", "👏", "🙌", "🤝", "💪", "✌️", "🤙",
      "👋", "🫡", "🙏", "🫶",
    ],
  },
  {
    name: "Dogs",
    icon: "🐕",
    emojis: [
      "🐕", "🐶", "🐩", "🦴", "🐾", "🐕‍🦺", "🚀", "🌕",
      "🍖", "🏆", "💎", "👀",
    ],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💖", "💯", "✨", "🔥",
    ],
  },
  {
    name: "Voting",
    icon: "🗳️",
    emojis: [
      "🗳️", "✅", "❌", "⚖️", "📊", "📈", "📉", "🏛️",
      "📜", "🔒", "🧾", "🗓️",
    ],
  },
  {
    name: "Fun",
    icon: "🎉",
    emojis: [
      "🎉", "🎊", "🥳", "😈", "🧠", "🍿", "☕", "🌙",
      "⚡", "🌊", "🐣", "👽",
    ],
  },
];

const RECENTS_KEY = "omnom:recent-emoji";
const RECENTS_MAX = 12;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecents().filter((e) => e !== emoji)].slice(0, RECENTS_MAX);
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage quota — recents are a nicety, never a blocker.
  }
  return next;
}

/**
 * Splice `insert` into `current` at the textarea's caret (replacing any
 * selection), returning the new value plus where the caret should sit after
 * the splice so the parent can restore focus position post-render.
 */
export function spliceAtCursor(
  el: HTMLTextAreaElement | null,
  current: string,
  insert: string,
): { value: string; caret: number } {
  if (!el) return { value: current + insert, caret: current.length + insert.length };
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? start;
  return {
    value: current.slice(0, start) + insert + current.slice(end),
    caret: start + insert.length,
  };
}

interface EmojiPickerProps {
  /** Receives the picked emoji character. */
  onSelect: (emoji: string) => void;
  /** Accessible label for the trigger (compose your own sentence around it). */
  triggerLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function EmojiPicker({
  onSelect,
  triggerLabel = "Insert emoji",
  disabled = false,
  className,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>("recent");
  const [recents, setRecents] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Opening resolves the recents and the starting tab in the same pass —
  // before the first paint of the panel, so the grid is never briefly empty.
  const toggle = useCallback(() => {
    if (!open) {
      const stored = loadRecents();
      setRecents(stored);
      setTab(stored.length > 0 ? "recent" : SMILEYS.icon);
    }
    setOpen((v) => !v);
  }, [open]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = useCallback(
    (emoji: string) => {
      setRecents(saveRecent(emoji));
      onSelect(emoji);
      setOpen(false);
    },
    [onSelect],
  );

  const activeGroup = GROUPS.find((g) => g.icon === tab) ?? null;
  const gridEmojis = tab === "recent" ? recents : (activeGroup?.emojis ?? SMILEYS.emojis);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-bg-elevated hover:text-gold disabled:opacity-50"
      >
        <Smile className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full left-0 z-50 mb-2 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-bg-elevated p-2 shadow-xl"
        >
          <div className="mb-1 flex items-center gap-0.5" role="tablist" aria-label="Emoji categories">
            {recents.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "recent"}
                aria-label="Recently used"
                onClick={() => setTab("recent")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors hover:bg-bg-elevated/70",
                  tab === "recent" && "bg-bg-elevated text-gold",
                )}
              >
                🕘
              </button>
            )}
            {GROUPS.map((g) => (
              <button
                key={g.name}
                type="button"
                role="tab"
                aria-selected={tab === g.icon}
                aria-label={g.name}
                onClick={() => setTab(g.icon)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors hover:bg-bg-elevated/70",
                  tab === g.icon && "bg-bg-elevated text-gold",
                )}
              >
                {g.icon}
              </button>
            ))}
          </div>
          <div className="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto">
            {gridEmojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                aria-label={`Insert ${emoji}`}
                onClick={() => pick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-gold/15"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
