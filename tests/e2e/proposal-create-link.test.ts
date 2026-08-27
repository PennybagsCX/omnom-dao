import { test, expect } from "./auth.fixture";
import { dismissWalletDialog, hideDevAuthPanel } from "./helpers";

const RUN_E2E = !process.env.VITEST;

/**
 * E2E — Link editing in the proposal WYSIWYG editor (/proposals/create).
 *
 * Covers the flows jsdom cannot drive (real selections, floating-ui bubble)
 * end to end: insert via ⌘K dialog, the no-stickiness regression, the Review
 * step's markdown preview, the click-to-select bubble menu (edit + remove),
 * and the "Edit link" toolbar dialog that appears when ⌘K is pressed with a
 * link selected.
 */
if (RUN_E2E) {
  test.describe("Proposal create — WYSIWYG link editing", () => {
    test("insert, preview, edit and remove a link end to end", async ({
      page,
      authenticated: _authenticated,
    }) => {
      test.setTimeout(120_000); // first hit compiles the route on the dev server

      await page.goto("/proposals/create");
      await page.waitForLoadState("networkidle");
      await dismissWalletDialog(page);
      // The fixed bottom-right dev-auth panel overlaps the wizard's Back/Next
      // row on this viewport and intercepts clicks.
      await hideDevAuthPanel(page);

      // ── Step 1: pick a type ────────────────────────────────────────
      await page.getByRole("button", { name: /treasury/i }).click();
      await page.getByRole("button", { name: /^next/i }).click();

      // ── Step 2: title + body ───────────────────────────────────────
      await page.getByLabel(/title/i).fill("E2E link editing coverage proposal");

      const editor = page.locator(".prose-omnom");
      await editor.click();
      // The distinctive word sits alone in its own paragraph, so a
      // double-click near the paragraph's left edge lands squarely on it.
      await page.keyboard.type(
        "This sentence exists to comfortably clear the fifty character minimum.",
      );
      await page.keyboard.press("Enter");
      await page.keyboard.type("blueprint");
      await page.keyboard.press("Enter");
      await page.keyboard.type("A closing sentence after the linked word.");
      // Two filler paragraphs: the bubble's edit form floats below the link
      // it edits and physically covers roughly the next line (inherent to
      // anchor-below popovers), so the second link must sit a few lines
      // down for the click-straight-to-it flow below — as it would in a
      // real document, where links are not one line apart.
      await page.keyboard.press("Enter");
      await page.keyboard.type("Filler line one to keep the form clear.");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Filler line two to keep the form clear.");
      // A second linkable word alone in its own paragraph, for the
      // two-link interactions further down (stale prefill, empty apply).
      await page.keyboard.press("Enter");
      await page.keyboard.type("milestone");

      // ── Insert: double-click the word → ⌘K → dialog → apply ────────
      await page.getByText("blueprint").dblclick({ position: { x: 8, y: 8 } });
      // Let the dblclick selection reach ProseMirror state before the
      // dialog's autofocus steals it — `selectionchange` coalesces per
      // frame, so back-to-back dblclick+⌘K would leave only the dialog's
      // (ignored) selection for PM to observe. A human always pauses here.
      await page.waitForTimeout(150);
      await page.keyboard.press("ControlOrMeta+k");

      const insertDialog = page.getByRole("dialog", { name: "Insert link" });
      await expect(insertDialog).toBeVisible();
      // Cold selection (not yet a link) → no Remove affordance.
      await expect(
        insertDialog.getByRole("button", { name: "Remove" }),
      ).toHaveCount(0);

      await page.locator("#link-url").fill("example.com");
      await insertDialog.getByRole("button", { name: "Insert" }).click();

      const anchor = editor.locator("a");
      await expect(anchor).toHaveAttribute("href", "https://example.com");

      // ── Sticky regression: typing after the link stays plain ───────
      await page.keyboard.type(" plain tail");
      await expect(anchor).toHaveText("blueprint");
      // The Link button opens (not toggles) a dialog — popup semantics.
      await expect(page.getByTitle("Link (⌘K)")).toHaveAttribute(
        "aria-haspopup",
        "dialog",
      );
      await expect(page.getByTitle("Link (⌘K)")).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      // ── Review step renders the markdown link ──────────────────────
      await page.getByRole("button", { name: /^next/i }).click(); // → parameters
      await page.getByRole("button", { name: /^next/i }).click(); // → review
      await expect(
        page.getByRole("link", { name: "blueprint" }),
      ).toHaveAttribute("href", "https://example.com");

      // ── Back to the editor (content must survive remount) ──────────
      await page.getByRole("button", { name: /^back/i }).click();
      await page.getByRole("button", { name: /^back/i }).click();
      await expect(editor.locator("a")).toHaveAttribute(
        "href",
        "https://example.com",
      );

      // ── Click the link → selected → bubble menu ────────────────────
      await editor.locator("a").click();
      const bubble = page.getByRole("dialog", { name: "Link options" });
      await expect(bubble).toBeVisible();
      await expect(
        bubble.getByRole("link", { name: "https://example.com" }),
      ).toBeVisible();

      // ── ⌘K with the link selected → "Edit link" dialog + Remove ────
      // (jsdom cannot place a selection by clicking, so this state is
      // only reachable in a real browser.)
      await page.keyboard.press("ControlOrMeta+k");
      const editDialog = page.getByRole("dialog", { name: "Edit link" });
      await expect(editDialog).toBeVisible();
      // The selection bubble is unmounted while the dialog is open — the
      // two must never stack (blur containment cannot see a body-appended
      // dialog, so before the unmount fix both were visible at once).
      await expect(
        page.getByRole("dialog", { name: "Link options" }),
      ).toHaveCount(0);
      await expect(page.locator("#link-url")).toHaveValue(
        "https://example.com",
      );
      await expect(
        editDialog.getByRole("button", { name: "Remove" }),
      ).toBeVisible();
      await editDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("dialog", { name: "Edit link" }),
      ).toHaveCount(0);
      // Cancel hands focus back to the invoking Link button (dialog pattern).
      await expect(page.getByTitle("Link (⌘K)")).toBeFocused();

      // ── Bubble → Edit → change the URL ─────────────────────────────
      await editor.locator("a").click();
      await expect(bubble).toBeVisible();
      await bubble.getByRole("button", { name: "Edit link" }).click();

      const bubbleForm = page.getByRole("dialog", { name: "Edit link" });
      const urlInput = bubbleForm.getByLabel("Link URL");
      await expect(urlInput).toHaveValue("https://example.com");
      await urlInput.fill("other.org");
      await bubbleForm.getByRole("button", { name: "Apply" }).click();

      await expect(editor.locator("a")).toHaveAttribute(
        "href",
        "https://other.org",
      );

      // ── Second link on another word ───────────────────────────────
      await page.getByText("milestone").dblclick({ position: { x: 8, y: 8 } });
      // Selection settle before ⌘K (selectionchange coalescing, see above).
      await page.waitForTimeout(150);
      await page.keyboard.press("ControlOrMeta+k");
      await page.locator("#link-url").fill("second.net");
      await insertDialog.getByRole("button", { name: "Insert" }).click();
      await expect(editor.locator("a")).toHaveCount(2);

      // ── Stale-prefill regression: edit one link, switch to the other ──
      await editor.getByRole("link", { name: "blueprint" }).click();
      // Wait for the bubble to show the clicked link's href before using
      // it: visibility updates are debounced (updateDelay 100ms) and the
      // bubble may still be targeting the link just inserted above.
      await expect(
        bubble.getByRole("link", { name: "https://other.org" }),
      ).toBeVisible();
      await bubble.getByRole("button", { name: "Edit link" }).click();

      const bubbleEditForm = page.getByRole("dialog", { name: "Edit link" });
      await expect(bubbleEditForm.getByLabel("Link URL")).toHaveValue(
        "https://other.org",
      );

      // Click straight into the other link. Whichever mode the bubble
      // lands in after the blur/update cycle, the edit form must show
      // THIS link's URL — never the previously edited one (the form
      // remounts keyed on the href).
      await editor.getByRole("link", { name: "milestone" }).click();
      await page.waitForTimeout(250); // bubble updateDelay is 100ms
      if (!(await bubbleEditForm.isVisible())) {
        await expect(
          bubble.getByRole("link", { name: "https://second.net" }),
        ).toBeVisible();
        await bubble.getByRole("button", { name: "Edit link" }).click();
      }
      await expect(bubbleEditForm.getByLabel("Link URL")).toHaveValue(
        "https://second.net",
      );

      // ── Empty apply in the bubble form removes that link ──────────
      await bubbleEditForm.getByLabel("Link URL").fill("");
      await bubbleEditForm.getByRole("button", { name: "Apply" }).click();
      await expect(editor.locator("a")).toHaveCount(1);
      await expect(
        editor.getByRole("link", { name: "blueprint" }),
      ).toHaveAttribute("href", "https://other.org");

      // ── Bubble → Remove link ───────────────────────────────────────
      await editor.getByRole("link", { name: "blueprint" }).click();
      // Same re-target wait as above: act on the bubble only once it
      // reflects the clicked link.
      await expect(
        bubble.getByRole("link", { name: "https://other.org" }),
      ).toBeVisible();
      await bubble.getByRole("button", { name: "Remove link" }).click();

      await expect(editor.locator("a")).toHaveCount(0);
      await expect(page.locator(".prose-omnom")).toContainText("blueprint");
      // The bubble hides together with the link it was anchored to.
      await expect(
        page.getByRole("dialog", { name: "Link options" }),
      ).toHaveCount(0);

      // ── Review again: no links, the word survives as plain text ────
      await page.getByRole("button", { name: /^next/i }).click();
      await page.getByRole("button", { name: /^next/i }).click();
      await expect(page.getByRole("link", { name: "blueprint" })).toHaveCount(0);
      await expect(page.getByText(/blueprint/).first()).toBeVisible();
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Playwright specs — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
