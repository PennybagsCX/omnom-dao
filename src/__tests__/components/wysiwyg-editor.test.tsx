// @vitest-environment jsdom
import "@/__tests__/setup";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  LinkBubbleEditForm,
  LinkBubbleView,
} from "@/components/shared/link-bubble-menu";
import { WysiwygEditor } from "@/components/shared/wysiwyg-editor";

/* The floating BubbleMenu host (floating-ui) is e2e-only — jsdom has zero
 * layout rects. Here we cover the toolbar dialog wiring against a real
 * editor, and the bubble's pure view/edit subcomponents directly. */

function getProseMirror(): HTMLElement {
  const el = document.querySelector(".ProseMirror");
  if (!el) throw new Error(".ProseMirror not mounted");
  return el as HTMLElement;
}

describe("WysiwygEditor", () => {
  it("renders the toolbar, editable surface and placeholder", () => {
    render(<WysiwygEditor value="" onChange={vi.fn()} />);

    for (const title of ["Heading", "Bold", "Italic", "Bullet list", "Link (⌘K)"]) {
      expect(screen.getByTitle(title)).toBeInTheDocument();
    }
    const prose = getProseMirror();
    expect(prose).toHaveAttribute("aria-label", "Proposal description");
    expect(prose).toHaveAttribute("data-placeholder", expect.stringContaining("Describe"));
  });

  it("Link button opens a focused insert dialog and Insert applies the link", async () => {
    const onChange = vi.fn();
    render(<WysiwygEditor value="" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();

    const linkButton = screen.getByTitle("Link (⌘K)");
    // The Link button opens (does not toggle) a dialog — popup semantics,
    // not a pressed state like Bold/Italic.
    expect(linkButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(linkButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(linkButton);
    expect(linkButton).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Insert link" });
    expect(dialog).toBeInTheDocument();

    const input = screen.getByLabelText("URL");
    expect(input).toHaveFocus();
    // Cold caret in plain text → nothing to remove, no Remove affordance.
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "www.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0].trim()).toBe("<https://www.example.com>");
    expect(screen.queryByRole("dialog", { name: "Insert link" })).not.toBeInTheDocument();
  });

  it("empty URL keeps Insert disabled (nothing to apply, nothing to remove)", () => {
    render(<WysiwygEditor value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Link (⌘K)"));
    expect(screen.getByRole("button", { name: "Insert" })).toBeDisabled();
  });

  it("⌘K on the focused editor opens the dialog (editorProps scoping)", () => {
    render(<WysiwygEditor value="hello world" onChange={vi.fn()} />);

    fireEvent.keyDown(getProseMirror(), { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Insert link" })).toBeInTheDocument();
  });

  it("Escape closes the dialog without applying and returns focus to the Link button", () => {
    const onChange = vi.fn();
    render(<WysiwygEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Link (⌘K)"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Insert link" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTitle("Link (⌘K)")).toHaveFocus();
  });

  it("Cancel closes the dialog without applying and returns focus to the Link button", () => {
    const onChange = vi.fn();
    render(<WysiwygEditor value="" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Link (⌘K)"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Insert link" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTitle("Link (⌘K)")).toHaveFocus();
  });

  it("clicking outside the dialog closes it", () => {
    render(<WysiwygEditor value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Link (⌘K)"));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("dialog", { name: "Insert link" })).not.toBeInTheDocument();
  });

  it("does not feed the cap-truncated emission back into the document (controlled echo)", async () => {
    // Controlled-parent pattern: every onChange lands in state and comes
    // back as `value`. Above the 10k cap the emission is sliced, so before
    // the echo guard the value-sync effect would setContent with the
    // truncated string and revert the very change that emitted it.
    const big = "a".repeat(10050);
    function Controlled() {
      const [value, setValue] = useState(big);
      return <WysiwygEditor value={value} onChange={setValue} />;
    }
    render(<Controlled />);

    // Any command-driven change triggers an emission; the dialog insert is
    // the one already exercised by the other tests.
    fireEvent.click(screen.getByTitle("Link (⌘K)"));
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    // The document keeps its full 10k+ content instead of being truncated
    // back to the sliced serialisation.
    await waitFor(() =>
      expect(getProseMirror().textContent.length).toBeGreaterThan(10000),
    );
  });
});

describe("LinkBubbleView", () => {
  it("renders the href and routes Open / Edit / Remove", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<LinkBubbleView href="https://a.com" onEdit={onEdit} onRemove={onRemove} />);

    const anchor = screen.getByText("https://a.com");
    expect(anchor).toHaveAttribute("href", "https://a.com");
    expect(anchor).toHaveAttribute("title", "https://a.com");

    fireEvent.click(anchor); // preventDefault'd → window.open instead
    expect(open).toHaveBeenCalledWith("https://a.com", "_blank", "noopener,noreferrer");
    open.mockRestore();

    fireEvent.click(screen.getByRole("button", { name: "Edit link" }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("Copy flips to a transient Copied state", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    render(<LinkBubbleView href="https://a.com" onEdit={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});

describe("LinkBubbleEditForm", () => {
  function setup(overrides: Partial<Parameters<typeof LinkBubbleEditForm>[0]> = {}) {
    const props = {
      initialUrl: "https://a.com",
      onApply: vi.fn(),
      onCancel: vi.fn(),
      onRemove: vi.fn(),
      ...overrides,
    };
    render(<LinkBubbleEditForm {...props} />);
    return props;
  }

  it("prefills, focuses and selects the URL", () => {
    setup();
    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    expect(input).toHaveValue("https://a.com");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("https://a.com".length);
  });

  it("Enter applies the current value", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Link URL"), { key: "Enter" });
    expect(props.onApply).toHaveBeenCalledWith("https://a.com");
  });

  it("Apply button applies the edited value", () => {
    const props = setup();
    const input = screen.getByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "https://b.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(props.onApply).toHaveBeenCalledWith("https://b.org");
  });

  it("clearing the field and applying routes an empty URL (removal)", () => {
    const props = setup();
    const input = screen.getByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onApply).toHaveBeenCalledWith("");
  });

  it("Escape cancels without applying", () => {
    const props = setup();
    fireEvent.keyDown(screen.getByLabelText("Link URL"), { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it("unlink button routes onRemove", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
  });
});
