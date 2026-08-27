import { getMarkRange } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

import { normalizeLinkUrl } from "@/lib/link-url";

/**
 * Click-to-select that always targets the anchor under the pointer.
 *
 * Tiptap's built-in `enableClickSelection` runs `extendMarkRange` computed
 * from the *current* editor selection. When a click arrives while that
 * selection still points into a previously focused link (the browser's
 * caret placement hasn't been read back yet), the command expands the OLD
 * link and re-selects it, clobbering the click — the bubble then shows a
 * link the user did not click. Deriving the range from the clicked
 * position instead (`pos`, which ProseMirror resolves from the event
 * coordinates and is therefore always correct) makes the selection match
 * the clicked anchor deterministically.
 */
function clickSelectsClickedLink(): Plugin {
  return new Plugin({
    key: new PluginKey("clickSelectsClickedLink"),
    props: {
      handleClick: (view, pos, event) => {
        if (!view.editable || event.button !== 0) return false;
        if (!(event.target instanceof Element)) return false;
        const anchor = event.target.closest("a");
        if (!anchor || !view.dom.contains(anchor)) return false;

        const { state } = view;
        const linkType = state.schema.marks.link;
        if (!linkType) return false;
        const range = getMarkRange(state.doc.resolve(pos), linkType);
        if (!range) return false;

        view.dispatch(
          state.tr.setSelection(
            TextSelection.create(state.doc, range.from, range.to),
          ),
        );
        return true;
      },
    },
  });
}

/**
 * Link behaviour for the proposal editor, kept framework-free so it can be
 * unit-tested against a real editor instance.
 *
 * `inclusive: false` is the load-bearing change: Tiptap's stock Link mark
 * derives inclusivity from `autolink`, which makes the mark "sticky" — a
 * caret placed next to a link inherits it, so everything typed afterwards
 * keeps getting linked with no discoverable exit. With inclusivity off,
 * typing after a link (inserted or auto-linked) is plain text, while typing
 * *inside* link text still extends the link naturally.
 */
export const EditorLink = Link.extend({
  inclusive() {
    return false;
  },
  addProseMirrorPlugins() {
    // Stock click selection is replaced (see clickSelectsClickedLink);
    // the parent's autolink / paste / openOnClick plugins stay on.
    return [...(this.parent?.() ?? []), clickSelectsClickedLink()];
  },
}).configure({
  openOnClick: false,
  enableClickSelection: false,
  autolink: true,
  linkOnPaste: true,
  defaultProtocol: "https",
  HTMLAttributes: {
    target: "_blank",
    rel: "noopener noreferrer nofollow",
  },
});

/** Markdown serialisation options shared with tiptap-markdown. */
export const MARKDOWN_OPTS = {
  html: false,
  tightLists: true,
  bulletListMarker: "-",
  linkify: true,
  breaks: false,
  transformPastedText: true,
  transformCopiedText: true,
} as const;

/** Get markdown from editor storage with type-safety. */
export function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
}

/**
 * Route a user-entered URL to the right ProseMirror command:
 *
 * - empty input while inside a link → unlink (the GitHub "clear the field
 *   to remove" behaviour; always reachable, unlike the old hidden branch)
 * - collapsed caret inside a link → update the *whole* link
 *   (`extendMarkRange` is safe here: the caret sits inside the mark, so the
 *   expansion covers exactly that link — never use it on non-empty
 *   selections, that is what caused the spacing regressions)
 * - collapsed caret in plain text → insert the URL as the link's own text
 *   and drop the caret after it (subsequent typing stays unlinked)
 * - non-empty selection → link exactly the selection, then collapse the
 *   caret to the selection end
 */
export function applyLinkFromInput(editor: Editor, rawUrl: string): void {
  const href = normalizeLinkUrl(rawUrl);
  const { to, empty } = editor.state.selection;
  const inLink = editor.isActive("link");

  if (!href) {
    if (inLink) removeLink(editor);
    return;
  }

  if (empty && inLink) {
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  } else if (empty) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text: href,
        marks: [{ type: "link", attrs: { href } }],
      })
      .run();
  } else {
    editor.chain().focus().setLink({ href }).setTextSelection(to).run();
  }
}

/** Remove the link mark from the current selection. */
export function removeLink(editor: Editor): void {
  editor.chain().focus().extendMarkRange("link").unsetLink().run();
}

/**
 * Show the link bubble whenever the selection is genuinely in/over a link.
 * Mirrors the plugin's default focus guard (editor focused, or focus inside
 * the bubble itself) so programmatic updates while the editor is unfocused —
 * e.g. the external value-sync effect — can't pop the bubble unexpectedly.
 */
export function shouldShowLinkBubble({
  editor,
  view,
  element,
}: {
  editor: Editor;
  view?: { hasFocus: () => boolean };
  element?: HTMLElement | null;
}): boolean {
  if (!editor.isEditable || !editor.isActive("link")) return false;
  if (element && element.contains(document.activeElement)) return true;
  return view ? view.hasFocus() : true;
}

/** Open an href in a new tab with hardening; safe in jsdom/tests. */
export function openLinkInNewTab(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}
