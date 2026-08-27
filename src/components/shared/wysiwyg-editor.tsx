"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Code,
  ExternalLink,
  Heading,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  X,
} from "lucide-react";

import { LinkBubbleMenu } from "@/components/shared/link-bubble-menu";
import {
  EditorLink,
  MARKDOWN_OPTS,
  applyLinkFromInput,
  getMarkdown,
  removeLink as removeLinkCommand,
} from "@/components/shared/link-commands";
import { normalizeLinkUrl } from "@/lib/link-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * True WYSIWYG markdown editor built on Tiptap (ProseMirror).
 *
 * The editor renders formatted content inline — no separate preview pane.
 * Content is serialised back to markdown on every change via the
 * `tiptap-markdown` extension so the stored value stays clean markdown.
 *
 * All formatting actions from the previous textarea-based editor are
 * preserved: heading, bold, italic, strikethrough, bullet list, numbered list,
 * blockquote, inline code, link, and horizontal rule.
 *
 * Link UX follows the standard Notion/GitHub pattern: ⌘K or the toolbar
 * button opens an insert/edit dialog, clicking a link opens a bubble menu
 * (open / edit / copy / remove), and the Link mark is non-inclusive so
 * typing after a link is plain text — see `link-commands.ts`.
 */

interface WysiwygEditorProps {
  /** Initial markdown content. */
  value: string;
  /** Fired with serialised markdown whenever the document changes. */
  onChange: (markdown: string) => void;
  /** Optional placeholder shown when the editor is empty. */
  placeholder?: string;
  /** Accessible validity flag — adds a danger ring when invalid. */
  "aria-invalid"?: boolean;
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "Describe your proposal in detail… (Markdown supported)",
  ...rest
}: WysiwygEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  // The markdown this editor last emitted via onChange. When the parent's
  // `value` prop is exactly that string, it is an echo of our own update —
  // re-syncing would round-trip the (possibly cap-truncated) serialisation
  // back into the document and revert the keystroke that caused it.
  const lastEmittedRef = useRef(value);
  // The editor instance is returned *by* useEditor, so its own options
  // (editorProps.handleKeyDown) reach it through this ref.
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Toolbar active states, the dialog's live canRemove flag and the link
    // bubble's href all read editor state during render — opt back into
    // re-rendering on transactions (the v3 default is off, which left the
    // toolbar's active states stale on cursor moves).
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // StarterKit bundles the stock Link mark, whose inclusivity follows
        // `autolink` — that stickiness is the bug this rework fixes, so it is
        // disabled in favour of our non-sticky variant.
        link: false,
        // Code blocks are not needed; the inline `code` mark (styled gold monospace)
        // is sufficient for contract addresses and token symbols.
        codeBlock: false,
      }),
      EditorLink,
      Markdown.configure(MARKDOWN_OPTS),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "prose-omnom min-h-[224px] resize-y p-3 text-sm leading-relaxed text-muted-foreground outline-none",
          "placeholder:text-text-dim",
        ),
        "aria-label": "Proposal description",
        "aria-invalid": rest["aria-invalid"] ? "true" : "false",
        "data-placeholder": placeholder,
      },
      // ⌘K opens the link dialog, but only while the editor is focused — a
      // document-level listener would hijack the shortcut from the title
      // input and other page fields.
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          const existing = editorRef.current?.getAttributes("link").href;
          setLinkUrl(typeof existing === "string" ? existing : "");
          setShowLinkDialog(true);
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = getMarkdown(ed).slice(0, 10000);
      lastEmittedRef.current = md;
      onChange(md);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);

  // Sync external value changes into the editor (e.g. form reset / step
  // navigation). An echo of our own last emission is skipped whole — at the
  // 10k cap the emitted string is truncated, so feeding it back would revert
  // every keystroke and corrupt mid-token pastes.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    const current = getMarkdown(editor);
    if (value !== current && value.trim() !== current.trim()) {
      lastEmittedRef.current = value;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  /** Open the link dialog, pre-filled with existing link href if any. */
  const openLinkDialog = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href;
    setLinkUrl(typeof existing === "string" ? existing : "");
    setShowLinkDialog(true);
  };

  /** Apply the entered URL — or remove the link when left empty. */
  const applyLink = () => {
    if (!editor) return;
    applyLinkFromInput(editor, linkUrl);
    setShowLinkDialog(false);
    setLinkUrl("");
  };

  /** Remove the link from the current selection. */
  const removeLink = () => {
    if (!editor) return;
    removeLinkCommand(editor);
    setShowLinkDialog(false);
    setLinkUrl("");
  };

  if (!editor) {
    return (
      <div className="min-h-[260px] rounded-lg border border-border bg-transparent" />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border",
        rest["aria-invalid"] && "border-danger/50",
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg-elevated/50 px-2 py-1">
        <ToolbarBtn icon={Heading} title="Heading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarBtn icon={Bold} title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarBtn icon={Italic} title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarBtn icon={Strikethrough} title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Divider />
        <ToolbarBtn icon={List} title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarBtn icon={ListOrdered} title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarBtn icon={Quote} title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <Divider />
        <ToolbarBtn icon={Code} title="Inline code"
          active={editor.isActive("code")}
          disabled={editor.state.selection.empty}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarBtn
          icon={LinkIcon}
          title="Link (⌘K)"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
          buttonRef={linkButtonRef}
          hasPopup="dialog"
          expanded={showLinkDialog}
        />
        <ToolbarBtn icon={Minus} title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      {/* Editor surface */}
      <EditorContent editor={editor} />

      {/* Selection-anchored link bubble (open / edit / copy / remove).
       * Unmounted while the ⌘K dialog is open: the bubble's blur containment
     * can't see the dialog (it appends to document.body, so every element
     * looks "inside" its parent), which left both UIs stacked. Unmounting
     * the host is decisive — no floating-ui internals required. */}
      {!showLinkDialog && <LinkBubbleMenu editor={editor} />}

      {/* Floating Link Dialog */}
      {showLinkDialog && (
        <LinkPopover
          url={linkUrl}
          onUrlChange={setLinkUrl}
          onApply={applyLink}
          onRemove={removeLink}
          onClose={() => { setShowLinkDialog(false); setLinkUrl(""); }}
          canRemove={editor.isActive("link")}
          anchorRef={linkButtonRef}
        />
      )}
    </div>
  );
}

/* ── Link Popover (Floating Dialog) ──────────────────────────────── */

function LinkPopover({
  url,
  onUrlChange,
  onApply,
  onRemove,
  onClose,
  canRemove,
  anchorRef,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
  /** True while the selection is inside a link — evaluated per render so it
   * tracks cursor moves (and gates the Remove affordances). */
  canRemove: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Mount-time focus: select-all only when starting empty (prefill stays
  // editable in place). Reading the input's own value keeps `url` out of
  // the deps array — re-running mid-typing would steal the caret.
  useEffect(() => {
    inputRef.current?.focus();
    if (!inputRef.current?.value) {
      inputRef.current?.select();
    }
  }, []);

  /** Dismiss and hand focus back to the invoking Link button (WAI-ARIA
   * dialog pattern) — a plain close would strand it on <body>. Light-dismiss
   * (outside click) deliberately does NOT steal focus from where the user
   * clicked. */
  const dismiss = () => {
    onClose();
    anchorRef.current?.focus();
  };

  // Close on Escape (with focus return)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply();
  };

  // Preview the URL exactly as it will be stored — same normalizer the
  // apply command uses, so the two can never disagree.
  const normalizedUrl = normalizeLinkUrl(url);

  return (
    <>
      {/* Backdrop — mirrors DialogOverlay */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onMouseDown={dismiss}
        aria-hidden="true"
      />
      <div
        ref={popoverRef}
        className="fixed left-[50%] top-[50%] z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg border border-border bg-bg-elevated shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={canRemove ? "Edit link" : "Insert link"}
      >
      <div className="p-3">
        <div className="flex items-center gap-2 border-b border-border pb-2 mb-3">
          <LinkIcon className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-sm font-semibold text-foreground">
            {canRemove ? "Edit Link" : "Insert Link"}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:bg-bg-elevated hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="link-url" className="block text-xs font-medium text-foreground mb-1.5">
              URL
            </label>
            <input
              ref={inputRef}
              id="link-url"
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="www.example.com"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-dim focus:border-gold/50 focus:ring-1 focus:ring-gold/50"
            />
            {canRemove && (
              <p className="mt-1.5 text-xs text-text-dim">
                Leave empty to remove the link
              </p>
            )}
          </div>

          {/* Live link preview */}
          {normalizedUrl && (
            <div className="flex items-center gap-2 rounded-md bg-bg-surface p-2">
              <ExternalLink className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden />
              <span className="text-xs text-muted-foreground truncate">
                {normalizedUrl}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {canRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-sm text-muted-foreground hover:text-danger transition-colors"
              >
                Remove
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!normalizedUrl && !canRemove}>
                {canRemove ? "Update" : "Insert"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}

/* ── Toolbar primitives ───────────────────────────────────────── */

function ToolbarBtn({
  icon: Icon,
  onClick,
  title,
  active = false,
  disabled = false,
  buttonRef,
  hasPopup,
  expanded,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  /** When set, the button opens (not toggles) a popup — aria-haspopup/
   * aria-expanded replace aria-pressed. */
  hasPopup?: "dialog";
  /** Current open state of the popup (only meaningful with hasPopup). */
  expanded?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...(hasPopup
        ? { "aria-haspopup": hasPopup, "aria-expanded": !!expanded }
        : { "aria-pressed": active })}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-gold/15 text-gold"
          : "text-muted-foreground hover:bg-bg-elevated hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}
