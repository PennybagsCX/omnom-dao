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

const MARKDOWN_OPTS = {
  html: false,
  tightLists: true,
  bulletListMarker: "-",
  linkify: true,
  breaks: false,
  transformPastedText: true,
  transformCopiedText: true,
} as const;

/** Get markdown from editor storage with type-safety. */
function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
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
    },
    onUpdate: ({ editor: ed }) => {
      const md = getMarkdown(ed);
      onChange(md.slice(0, 10000));
    },
  });

  // Sync external value changes into the editor (e.g. form reset / step
  // navigation). We guard against the current serialised content to avoid
  // clobbering the cursor on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (value !== current && value.trim() !== current.trim()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  /** Open the link dialog, pre-filled with existing link href if any. */
  const openLinkDialog = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href;
    setLinkUrl(existing ?? "");
    setShowLinkDialog(true);
  };

  // Handle keyboard shortcut for links (Cmd/Ctrl+K). The dialog-open logic is
  // inlined here (rather than calling openLinkDialog) so the effect only
  // depends on `editor` — no unstable function identity in the dep array.
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const existing = editor.getAttributes("link").href;
        setLinkUrl(existing ?? "");
        setShowLinkDialog(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  /** Apply the entered URL to the current selection. */
  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      // Smart URL normalization - supports www., http://, https://, and plain domains
      const normalized = (() => {
        const trimmed = url.trim();
        if (trimmed.startsWith("/")) return trimmed;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
        if (trimmed.startsWith("www.")) return `https://${trimmed}`;
        return `https://${trimmed}`;
      })();
      
      editor.chain().focus().setLink({ href: normalized }).run();
    }
    
    // Keep dialog open for rapid editing, just close on Esc
    setShowLinkDialog(false);
    setLinkUrl("");
  };

  /** Remove the link from the current selection. */
  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
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
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarBtn 
          icon={LinkIcon} 
          title="Link (⌘K)"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
          buttonRef={linkButtonRef}
        />
        <ToolbarBtn icon={Minus} title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>

      {/* Editor surface */}
      <EditorContent editor={editor} />

      {/* Floating Link Dialog */}
      {showLinkDialog && (
        <LinkPopover
          url={linkUrl}
          onUrlChange={setLinkUrl}
          onApply={applyLink}
          onRemove={removeLink}
          onClose={() => { setShowLinkDialog(false); setLinkUrl(""); }}
          hasExistingLink={editor.isActive("link")}
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
  hasExistingLink,
  anchorRef,
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
  hasExistingLink: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position popover near the toolbar button
  useEffect(() => {
    if (!anchorRef.current || !popoverRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    
    // Position above the toolbar button
    const top = anchorRect.top - popoverRect.height - 8;
    const left = Math.max(8, Math.min(
      anchorRect.left - popoverRect.width / 2 + anchorRect.width / 2,
      window.innerWidth - popoverRect.width - 8
    ));
    
    setPosition({ top, left });
    
    // Focus and select input
    inputRef.current?.focus();
    if (!url) {
      inputRef.current?.select();
    }
  }, [anchorRef, url]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  // Generate normalized URL for preview
  const normalizedUrl = (() => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("www.")) return `https://${trimmed}`;
    return `https://${trimmed}`;
  })();

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 rounded-lg border border-border bg-bg-elevated shadow-lg"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      role="dialog"
      aria-label="Insert link"
    >
      <div className="p-3">
        <div className="flex items-center gap-2 border-b border-border pb-2 mb-3">
          <LinkIcon className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-sm font-semibold text-foreground">
            {hasExistingLink ? "Edit Link" : "Insert Link"}
          </span>
          <span className="ml-auto text-xs text-text-dim">
            ⌘K
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-bg-elevated hover:text-foreground"
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
          </div>

          {/* Live link preview */}
          {normalizedUrl && (
            <div className="flex items-center gap-2 rounded-md bg-bg-subtle p-2">
              <ExternalLink className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden />
              <span className="text-xs text-muted-foreground truncate">
                {normalizedUrl}
              </span>
            </div>
          )}

          {/* Warning for invalid URLs */}
          {url && !normalizedUrl && (
            <div className="flex items-center gap-2 text-xs text-danger">
              <span>⚠️ Please enter a valid URL</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {hasExistingLink && (
              <button
                type="button"
                onClick={onRemove}
                className="text-sm text-muted-foreground hover:text-danger transition-colors"
              >
                Remove
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!normalizedUrl}>
                {hasExistingLink ? "Update" : "Insert"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Toolbar primitives ───────────────────────────────────────── */

function ToolbarBtn({
  icon: Icon,
  onClick,
  title,
  active = false,
  buttonRef,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  title: string;
  active?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-gold/15 text-gold"
          : "text-muted-foreground hover:bg-bg-elevated hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}
