// @vitest-environment jsdom
import "@/__tests__/setup";
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import {
  EditorLink,
  MARKDOWN_OPTS,
  applyLinkFromInput,
  getMarkdown,
  removeLink,
  shouldShowLinkBubble,
} from "@/components/shared/link-commands";

/* Real editor instance (production extension list) mounted in the DOM, so
 * command routing, mark behaviour and markdown round-trips are exercised
 * exactly as the component drives them. */

const editors: Editor[] = [];

function createEditor(content = ""): Editor {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const editor = new Editor({
    element: mount,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: false,
      }),
      EditorLink,
      Markdown.configure(MARKDOWN_OPTS),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) {
    const editor = editors.pop();
    const mount = editor?.options.element as HTMLElement | undefined;
    editor?.destroy();
    mount?.remove();
  }
});

/** Simulated typing: a text insertion dispatched through the editor view, so
 * ProseMirror plugins (including mark inheritance) apply as in real typing. */
function type(editor: Editor, text: string, at?: number): void {
  const pos = at ?? editor.state.selection.to;
  editor.view.dispatch(editor.state.tr.insertText(text, pos));
}

interface LinkMarkInfo {
  text: string;
  href: string;
}

/** All link-marked runs as { text, href } pairs. */
function linkRuns(editor: Editor): LinkMarkInfo[] {
  const runs: LinkMarkInfo[] = [];
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    const link = node.marks.find((m) => m.type.name === "link");
    if (link) runs.push({ text: node.text ?? "", href: link.attrs.href as string });
  });
  return runs;
}

/** Marks on the text run containing `needle` ("" when absent everywhere). */
function marksOn(editor: Editor, needle: string): string[] {
  let found: string[] | null = null;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.text?.includes(needle)) {
      found = node.marks.map((m) => m.type.name);
    }
  });
  return found ?? [];
}

describe("applyLinkFromInput — cold insert (collapsed caret in plain text)", () => {
  it("inserts the URL as its own link text", () => {
    const editor = createEditor("");
    editor.commands.setTextSelection(1);

    applyLinkFromInput(editor, "www.example.com");

    // Link text equals the href, so the serializer emits the autolink
    // shorthand — equivalent markdown, renders identically.
    expect(getMarkdown(editor).trim()).toBe("<https://www.example.com>");
    expect(linkRuns(editor)).toEqual([
      { text: "https://www.example.com", href: "https://www.example.com" },
    ]);
  });

  it("does not stick: typing after the inserted link is plain text (the reported bug)", () => {
    const editor = createEditor("");
    editor.commands.setTextSelection(1);
    applyLinkFromInput(editor, "www.example.com");

    type(editor, " plain tail");

    expect(editor.isActive("link")).toBe(false);
    expect(marksOn(editor, "plain tail")).toEqual([]);
    expect(getMarkdown(editor).trim()).toBe("<https://www.example.com> plain tail");
  });
});

describe("applyLinkFromInput — selection apply", () => {
  it("links exactly the selection, collapses the caret to its end, and typing stays unlinked", () => {
    const editor = createEditor("hello world end");
    editor.commands.setTextSelection({ from: 7, to: 12 }); // "world"

    applyLinkFromInput(editor, "example.com");

    expect(getMarkdown(editor).trim()).toBe("hello [world](https://example.com) end");
    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.to).toBe(12);
    // Caret at the link's right boundary must NOT inherit the mark.
    expect(editor.isActive("link")).toBe(false);

    type(editor, "!");
    expect(marksOn(editor, "!")).toEqual([]);
    expect(getMarkdown(editor).trim()).toBe("hello [world](https://example.com)! end");
  });

  it("spaces regression: a selection adjacent to an existing link never bleeds into it", () => {
    const editor = createEditor("[link](https://a.com) tail");
    editor.commands.setTextSelection({ from: 6, to: 10 }); // "tail"

    applyLinkFromInput(editor, "b.com");

    // The space between stays unmarked; the existing link is untouched.
    expect(getMarkdown(editor).trim()).toBe(
      "[link](https://a.com) [tail](https://b.com)",
    );
    expect(marksOn(editor, " ")).toEqual([]);
    expect(linkRuns(editor)).toEqual([
      { text: "link", href: "https://a.com" },
      { text: "tail", href: "https://b.com" },
    ]);
  });
});

describe("applyLinkFromInput — collapsed caret inside a link", () => {
  it("updates the whole link's href", () => {
    const editor = createEditor("hello [world](https://old.com) end");
    editor.commands.setTextSelection(9); // caret inside "world"

    expect(editor.isActive("link")).toBe(true);
    applyLinkFromInput(editor, "https://new.com");

    expect(getMarkdown(editor).trim()).toBe("hello [world](https://new.com) end");
    expect(linkRuns(editor)).toEqual([{ text: "world", href: "https://new.com" }]);
  });

  it("empty input removes the link (GitHub clear-to-remove)", () => {
    const editor = createEditor("hello [world](https://old.com) end");
    editor.commands.setTextSelection(9);

    applyLinkFromInput(editor, "   ");

    expect(linkRuns(editor)).toEqual([]);
    expect(getMarkdown(editor).trim()).toBe("hello world end");
  });
});

describe("removeLink", () => {
  it("unlinks while preserving text, from a collapsed caret inside the link", () => {
    const editor = createEditor("hello [world](https://old.com) end");
    editor.commands.setTextSelection(9);

    removeLink(editor);

    expect(linkRuns(editor)).toEqual([]);
    expect(editor.state.doc.textContent).toBe("hello world end");
  });
});

describe("shouldShowLinkBubble", () => {
  it("is true only for a selection genuinely in/over a link", () => {
    const editor = createEditor("hello [world](https://a.com) end");

    editor.commands.setTextSelection(2); // plain text
    expect(shouldShowLinkBubble({ editor })).toBe(false);

    editor.commands.setTextSelection(9); // inside the link
    expect(shouldShowLinkBubble({ editor })).toBe(true);

    editor.commands.setTextSelection({ from: 7, to: 12 }); // whole link
    expect(shouldShowLinkBubble({ editor })).toBe(true);
  });

  it("is false for an empty document or read-only editor", () => {
    const empty = createEditor("");
    expect(shouldShowLinkBubble({ editor: empty })).toBe(false);

    const editor = createEditor("[world](https://a.com)");
    editor.commands.setTextSelection(2);
    editor.setEditable(false);
    expect(shouldShowLinkBubble({ editor })).toBe(false);
  });

  it("mirrors the plugin focus guard: unfocused editor hides unless focus is inside the bubble", () => {
    const editor = createEditor("[world](https://a.com)");
    editor.commands.setTextSelection(2);

    expect(
      shouldShowLinkBubble({ editor, view: { hasFocus: () => false }, element: null }),
    ).toBe(false);

    const bubble = document.createElement("div");
    const input = document.createElement("input");
    bubble.appendChild(input);
    document.body.appendChild(bubble);
    input.focus();

    expect(
      shouldShowLinkBubble({ editor, view: { hasFocus: () => false }, element: bubble }),
    ).toBe(true);

    bubble.remove();
  });
});

describe("getMarkdown", () => {
  it("round-trips headings, lists and code through markdown", () => {
    const editor = createEditor("### Title\n\n- one\n- two\n\n`code`");
    expect(getMarkdown(editor)).toContain("### Title");
    expect(getMarkdown(editor)).toContain("- one");
    expect(getMarkdown(editor)).toContain("`code`");
  });
});

describe("click selection", () => {
  /** Invoke the editor's handleClick props exactly as ProseMirror does for a
   * real click at `pos`, with `event.target` pointed at the anchor there. */
  function clickAt(editor: Editor, pos: number): boolean {
    const { node } = editor.view.domAtPos(pos);
    const el =
      node.nodeType === 1 ? (node as Element) : node.parentElement ?? null;
    const anchor = el?.closest("a") ?? null;
    const event = new MouseEvent("click", { button: 0 });
    if (anchor) Object.defineProperty(event, "target", { value: anchor });
    return (
      editor.view.someProp("handleClick", (fn) =>
        (fn as ClickProp)(editor.view, pos, event),
      ) ?? false
    );
  }

  type ClickProp = (
    view: EditorView,
    pos: number,
    event: MouseEvent,
  ) => boolean;

  /** Doc range of the link run whose text is exactly `text`. */
  function linkRange(editor: Editor, text: string): { from: number; to: number } {
    let range = { from: -1, to: -1 };
    editor.state.doc.descendants((node, pos) => {
      if (
        node.isText &&
        node.text === text &&
        node.marks.some((m) => m.type.name === "link")
      ) {
        range = { from: pos, to: pos + node.nodeSize };
      }
    });
    return range;
  }

  it("selects the clicked link even when the caret sits at another link's end (stale-selection race)", () => {
    const editor = createEditor(
      "aaa [one](https://a.com) bbb [two](https://b.com) ccc",
    );
    const one = linkRange(editor, "one");
    const two = linkRange(editor, "two");

    // The exact precondition of the e2e failure: selection collapsed at the
    // right boundary of link "one" (isActive false — inclusivity is off),
    // then the user clicks link "two". The stock selection-based handler
    // re-selected "one"; the clicked position must win.
    editor.commands.setTextSelection(one.to);
    expect(editor.isActive("link")).toBe(false);

    const handled = clickAt(editor, two.from + 1);

    expect(handled).toBe(true);
    expect(editor.state.selection.from).toBe(two.from);
    expect(editor.state.selection.to).toBe(two.to);
  });

  it("same race across paragraphs: caret at end of the last link, click an earlier one", () => {
    const editor = createEditor(
      "before\n\n[alpha](https://a.com)\n\nmid\n\n[omega](https://w.com)",
    );
    const alpha = linkRange(editor, "alpha");
    const omega = linkRange(editor, "omega");

    editor.commands.setTextSelection(omega.to); // end of the omega paragraph
    clickAt(editor, alpha.from + 1);

    expect(editor.state.selection.from).toBe(alpha.from);
    expect(editor.state.selection.to).toBe(alpha.to);
  });

  it("leaves plain-text clicks to the native caret", () => {
    const editor = createEditor("aaa [one](https://a.com) bbb");
    editor.commands.setTextSelection(3); // caret in plain text

    const handled = clickAt(editor, 2);

    expect(handled).toBe(false);
    expect(editor.state.selection.from).toBe(3);
    expect(editor.state.selection.to).toBe(3);
  });
});

describe("EditorLink configuration", () => {
  it("pins the click/autolink behaviour the UX depends on", () => {
    const editor = createEditor("[world](https://a.com)");
    const link = editor.extensionManager.extensions.find(
      (ext) => ext.name === "link",
    );
    // Clicks select the link (bubble appears) instead of navigating;
    // bare URLs typed in text still autolink. Click selection is the
    // deterministic pos-based plugin registered by EditorLink — the stock
    // selection-based `enableClickSelection` mis-selects the previously
    // focused link (see "click selection" tests above) — so it is off.
    expect(link?.options.openOnClick).toBe(false);
    expect(link?.options.enableClickSelection).toBe(false);
    expect(link?.options.autolink).toBe(true);
    expect(link?.options.linkOnPaste).toBe(true);
  });
});
