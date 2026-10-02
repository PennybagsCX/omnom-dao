"use client";

/**
 * Lightweight emoji picker for comment composers — a trigger button plus one
 * scrollable panel with the standard/basic emoji set (no flags, no countries,
 * no skin-tone families). Built in-house on purpose: the app needs a few
 * hundred sensible emojis, not a 300KB Unicode catalog with search indexes,
 * and there is no popover primitive in components/ui to hang one off.
 *
 * Everything is visible in a single scroll — no category tabs to discover —
 * with small section labels (Recent, Smileys, …) between groups. Recently
 * used emojis (localStorage) surface at the top when present.
 *
 * The panel flips up or down depending on the space under the trigger, and
 * its width clamps to the viewport, so it stays usable from phones to
 * desktops. Purely presentational — the parent owns the text state and
 * receives selections through `onSelect`.
 *
 * For inserting at the textarea's caret, pair with `spliceAtCursor` below.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmojiGroup {
  name: string;
  emojis: string[];
}

/** The standard set, ordered the way people scan it; on-brand group first. */
const GROUPS: EmojiGroup[] = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪",
      "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨",
      "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
      "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
    ],
  },
  {
    name: "People & gestures",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜",
      "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🫡",
    ],
  },
  {
    name: "Dogs & space",
    emojis: [
      "🐕", "🐶", "🐩", "🦴", "🐾", "🐺", "🌕", "🚀",
      "👑", "🍖", "👀", "🌙",
    ],
  },
  {
    name: "Voting",
    emojis: [
      "🗳️", "📊", "📈", "📉", "🏛️", "📜", "🧾", "🗓️",
    ],
  },
  {
    name: "Animals & nature",
    emojis: [
      "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨",
      "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧",
      "🐦", "🐤", "🦆", "🦅", "🦉", "🐴", "🦄", "🐝",
      "🐛", "🦋", "🐌", "🐞", "🐢", "🐍", "🦎", "🐙",
      "🦑", "🦐", "🦞", "🦀", "🐠", "🐟", "🐬", "🦈",
    ],
  },
  {
    name: "Food & drink",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇",
      "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🥑", "🥦", "🥕", "🌽", "🌶️", "🥒", "🥬",
      "🧄", "🧅", "🥔", "🍠", "🥐", "🍞", "🥖", "🧀",
    ],
  },
  {
    name: "Snacks & meals",
    emojis: [
      "🥚", "🍳", "🥓", "🌭", "🍔", "🍟", "🍕", "🥪",
      "🌮", "🌯", "🥗", "🍜", "🍣", "🍩", "🍪", "🎂",
      "🍰", "🧁", "🍫", "🍬", "🍭", "☕", "🍵", "🧃",
      "🥤", "🍿",
    ],
  },
  {
    name: "Activities",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🎱", "🏓",
      "🏸", "🥊", "🥋", "⛳", "🏆", "🥇", "🥈", "🥉",
      "🎮", "🎯", "🎲", "🧩", "🎪", "🎭", "🎨", "🎤",
    ],
  },
  {
    name: "Travel & places",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🏎️", "🚓", "🚑", "🚒",
      "🚚", "🚜", "🛵", "🚲", "⛽", "🚦", "🏠", "🏢",
      "🏦", "🏫", "🏥", "🏪", "🏰", "🗼", "🗽", "🏝️",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💾",
      "📷", "📸", "📹", "🎥", "📞", "📺", "📻", "🎙️",
      "⏰", "⌛", "💡", "🔋", "🔌", "💰", "💳", "💎",
      "⚖️", "🔧", "🔨", "⚙️", "🧲", "🔬", "🔭", "🎁",
    ],
  },
  {
    name: "Office & tools",
    emojis: [
      "✉️", "📧", "📨", "📦", "📫", "✏️", "📝", "📚",
      "📖", "🔖", "🏷️", "📌", "📎", "📏", "📐", "🔒",
      "🔓", "🔑", "🗝️", "🎈", "🎀", "🕯️", "🧸", "🧿",
    ],
  },
  {
    name: "Symbols & hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘",
      "💝", "💟", "☮️", "☯️", "🔥", "✨", "🌟", "⭐",
      "💫", "⚡", "💥", "🎉", "🎊", "✅", "❌", "⭕",
      "❓", "❗", "💯", "🆒", "🆗", "🔔", "🔕", "♻️",
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

/** One labelled block of emojis inside the scroll panel. */
function EmojiSection({
  name,
  emojis,
  onPick,
}: {
  name: string;
  emojis: string[];
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="mb-1.5">
      <div className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-text-dim">
        {name}
      </div>
      <div className="grid grid-cols-8">
        {emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            aria-label={`Insert ${emoji}`}
            onClick={() => onPick(emoji)}
            className="flex aspect-square items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
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
  const [recents, setRecents] = useState<string[]>([]);
  // Where the panel opens and how tall it may get, decided from the space
  // around the trigger at open time — the comfortable cap is ~336px (never
  // more than half the viewport), shrinking on short screens (landscape
  // phones) so the panel always fits whichever side has more room.
  const [drop, setDrop] = useState<"up" | "down">("up");
  const [panelCap, setPanelCap] = useState(336);
  const rootRef = useRef<HTMLDivElement>(null);

  // Opening resolves recents + drop direction in the same pass, before the
  // panel's first paint — no flicker, no empty grid.
  const toggle = useCallback(() => {
    if (!open) {
      setRecents(loadRecents());
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const PANEL_HEADER = 30;
        const MARGIN = 16;
        const cap = Math.min(336, Math.floor(window.innerHeight * 0.5));
        const below = window.innerHeight - rect.bottom;
        const above = rect.top;
        if (below >= cap + MARGIN && below >= above) {
          setDrop("down");
          setPanelCap(cap);
        } else if (above >= cap + MARGIN) {
          setDrop("up");
          setPanelCap(cap);
        } else if (above >= below) {
          setDrop("up");
          setPanelCap(Math.max(120, above - PANEL_HEADER - MARGIN));
        } else {
          setDrop("down");
          setPanelCap(Math.max(120, below - PANEL_HEADER - MARGIN));
        }
      }
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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={toggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-bg-elevated hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Smile className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className={cn(
            "absolute left-0 z-50 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-border bg-bg-elevated shadow-xl",
            drop === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <div className="rounded-t-xl border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
            Emoji
          </div>
          <div className="overflow-y-auto p-2" style={{ maxHeight: panelCap }}>
            {recents.length > 0 && (
              <EmojiSection name="Recent" emojis={recents} onPick={pick} />
            )}
            {GROUPS.map((group) => (
              <EmojiSection
                key={group.name}
                name={group.name}
                emojis={group.emojis}
                onPick={pick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
