"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Check, Copy, ExternalLink, Pencil, Unlink } from "lucide-react";

import {
  applyLinkFromInput,
  openLinkInNewTab,
  removeLink,
  shouldShowLinkBubble,
} from "@/components/shared/link-commands";
import { cn } from "@/lib/utils";

/**
 * Selection-anchored link bubble — the Notion/GitHub pattern. Clicking or
 * selecting a link opens a small toolbar next to it with Open / Edit / Copy /
 * Remove, and Edit swaps the bubble into a prefilled inline form.
 *
 * `appendTo: document.body` is required: the editor wrapper clips its
 * children (`overflow-hidden`), so an inline-mounted bubble would be cut off.
 *
 * `appendTo` and `options` MUST keep stable identities: BubbleMenu's
 * options-update effect lists them as deps and dispatches a transaction on
 * change — inline literals recreated per render would ping-pong with the
 * editor's own transaction re-renders into an infinite update loop.
 */

/** Shared surface styling for both bubble modes (kept out of the BubbleMenu
 * wrapper so the pure subcomponents render identically in tests). */
const BUBBLE_SURFACE =
  "flex max-w-md items-center gap-1 rounded-lg border border-border bg-bg-elevated px-2 py-1.5 shadow-lg";

const appendToBody = () => document.body;

export function LinkBubbleMenu({ editor }: { editor: Editor }) {
  const [editing, setEditing] = useState(false);

  const floatingUiOptions = useMemo(
    () => ({
      placement: "bottom" as const,
      offset: 8,
      flip: true,
      shift: true,
      // Fires whenever the bubble hides (blur, drag, selection moved out) —
      // always drop back to view mode so a stale edit form never reappears.
      onHide: () => setEditing(false),
    }),
    [],
  );

  // Read per render (the host re-renders on editor transactions) and used as
  // the edit form's `key`: moving the selection from one link to another
  // never fires onHide (shouldShow stays true), so without the remount the
  // form would keep the previous link's URL in its captured state.
  const href = currentHref(editor);

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShowLinkBubble}
      updateDelay={100}
      appendTo={appendToBody}
      options={floatingUiOptions}
    >
      {editing ? (
        <LinkBubbleEditForm
          key={href}
          initialUrl={href}
          onApply={(url) => {
            applyLinkFromInput(editor, url);
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
            // Return focus to the editor so it is not stranded on <body>;
            // the selection is still inside the link, so the bubble stays
            // up in view mode.
            editor.commands.focus();
          }}
          onRemove={() => {
            removeLink(editor);
            setEditing(false);
          }}
        />
      ) : (
        <LinkBubbleView
          href={href}
          onEdit={() => setEditing(true)}
          onRemove={() => removeLink(editor)}
        />
      )}
    </BubbleMenu>
  );
}

/** Current link href ("" when undefined) — read per render so it tracks the
 * selection; the host re-renders on editor transactions. */
function currentHref(editor: Editor): string {
  const href = editor.getAttributes("link").href;
  return typeof href === "string" ? href : "";
}

/* ── View mode: href + Open / Edit / Copy / Remove ────────────────── */

export function LinkBubbleView({
  href,
  onEdit,
  onRemove,
}: {
  href: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const copyHref = async () => {
    try {
      await navigator.clipboard?.writeText(href);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — leave the view unchanged.
    }
  };

  return (
    <div className={BUBBLE_SURFACE} role="dialog" aria-label="Link options">
      {/* Announce the copy result — the button's icon/label swap alone is
       * not reliably exposed to assistive tech. */}
      <span role="status" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={(e) => {
          e.preventDefault();
          openLinkInNewTab(href);
        }}
        title={href}
        className="min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-xs text-gold hover:underline"
      >
        {href}
      </a>
      <BubbleBtn
        label="Open link in new tab"
        onClick={() => openLinkInNewTab(href)}
        icon={<ExternalLink className="h-3.5 w-3.5" aria-hidden />}
      />
      <BubbleBtn
        label="Edit link"
        onClick={onEdit}
        icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}
      />
      <BubbleBtn
        label={copied ? "Copied" : "Copy link"}
        onClick={() => void copyHref()}
        icon={
          copied ? (
            <Check className="h-3.5 w-3.5 text-gold" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )
        }
      />
      <BubbleBtn
        label="Remove link"
        onClick={onRemove}
        danger
        icon={<Unlink className="h-3.5 w-3.5" aria-hidden />}
      />
    </div>
  );
}

/* ── Edit mode: prefilled input, Enter applies, Escape cancels ────── */

export function LinkBubbleEditForm({
  initialUrl,
  onApply,
  onCancel,
  onRemove,
}: {
  initialUrl: string;
  onApply: (url: string) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefill, focus and select so retyping a URL is a single paste away.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className={BUBBLE_SURFACE}
      role="dialog"
      aria-label="Edit link"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onApply(url);
          }
        }}
        placeholder="www.example.com"
        aria-label="Link URL"
        className="w-64 rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-text-dim focus:border-gold/50 focus:ring-1 focus:ring-gold/50"
      />
      <button
        type="button"
        onClick={() => onApply(url)}
        className="rounded-md bg-gold/15 px-2 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove link (or empty the field and Apply)"
        aria-label="Remove link"
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-bg-elevated hover:text-danger"
      >
        <Unlink className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/* ── Shared bubble button ─────────────────────────────────────────── */

function BubbleBtn({
  label,
  onClick,
  icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded p-1 transition-colors",
        danger
          ? "text-muted-foreground hover:bg-bg-elevated hover:text-danger"
          : "text-muted-foreground hover:bg-bg-elevated hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
