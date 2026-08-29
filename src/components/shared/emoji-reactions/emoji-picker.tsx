"use client";

/**
 * Emoji picker — a small popover triggered by a `+` button.
 *
 * Renders the 8 Discord-style emoji reactions in a 4-column grid. Built on
 * top of the existing `@radix-ui/react-dropdown-menu` (already a dep) so we
 * get focus-trap, ESC to close, click-outside to close, and full keyboard
 * navigation for free. The menu closes on item click so the user sees their
 * selection update immediately.
 */

import { Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EMOJI_REACTIONS_MAP } from "@/lib/emoji-reactions";
import { cn } from "@/lib/utils";
import type { EmojiKey } from "@/types";

interface EmojiPickerProps {
  /** Whether the `+` trigger should be rendered at all. */
  enabled: boolean;
  /** Called when the user selects an emoji. */
  onSelect: (emoji: EmojiKey) => void;
  /** Optional tooltip / aria-label override for the trigger. */
  label?: string;
}

export function EmojiPicker({ enabled, onSelect, label = "Add emoji reaction" }: EmojiPickerProps) {
  if (!enabled) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-bg-elevated/40 px-2 text-xs text-muted-foreground transition-colors",
          "hover:bg-bg-elevated hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated",
          "data-[state=open]:bg-bg-elevated data-[state=open]:text-foreground",
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span className="sr-only">React</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-0 p-1.5">
        <div className="grid grid-cols-4 gap-1">
          {Object.values(EMOJI_REACTIONS_MAP).map((meta) => (
            <DropdownMenuItem
              key={meta.key}
              onSelect={() => onSelect(meta.key)}
              aria-label={meta.ariaLabel}
              className={cn(
                "min-h-[44px] min-w-[44px] justify-center px-0 text-xl",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
              )}
            >
              <span aria-hidden>{meta.glyph}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}