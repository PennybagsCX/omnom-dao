/**
 * Visual-verification driver for the link UX at /proposals/create.
 * Captures the toolbar insert dialog, the bubble view + edit modes, and
 * the ⌘K edit dialog, for manual review by the main session.
 *
 * Usage: node scripts/visual-link-check.mjs   (dev server on :3000 required)
 */
import { chromium } from "@playwright/test";
import { dismissWalletDialog, hideDevAuthPanel } from "../tests/e2e/helpers.ts";

const OUT = "/tmp/omnom-link-visual";
const BASE = "http://localhost:3000";
const WALLET = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"; // DOLPHIN

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// Dev-auth session (same as the e2e fixture)
const res = await context.request.post(`${BASE}/api/v1/dev-login`, {
  data: { walletAddress: WALLET },
});
if (!res.ok()) throw new Error(`dev-login failed: ${res.status()}`);

await page.goto(`${BASE}/proposals/create`);
await page.waitForLoadState("networkidle");
await dismissWalletDialog(page);
await hideDevAuthPanel(page);

// Wizard step 1 → treasury
await page.getByRole("button", { name: /treasury/i }).click();
await page.getByRole("button", { name: /^next/i }).click();

// Step 2 — title + body with a linkable word
await page.getByLabel(/title/i).fill("Visual verification proposal for link UX");
const editor = page.locator(".prose-omnom");
await editor.click();
await page.keyboard.type("This sentence comfortably clears the fifty character minimum.");
await page.keyboard.press("Enter");
await page.keyboard.type("blueprint");
await page.keyboard.press("Enter");
await page.keyboard.type("A closing sentence after the linked word.");

// 1 — toolbar insert dialog (dblclick word → ⌘K)
await page.getByText("blueprint").dblclick({ position: { x: 8, y: 8 } });
await page.waitForTimeout(150); // let selectionchange commit (see e2e note)
await page.keyboard.press("ControlOrMeta+k");
const insertDialog = page.getByRole("dialog", { name: "Insert link" });
await insertDialog.waitFor();
await page.locator("#link-url").fill("example.com");
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/1-insert-dialog.png` });

// 2 — apply, then click link → bubble view
await insertDialog.getByRole("button", { name: "Insert" }).click();
await expectHref(page, "https://example.com");
await editor.locator("a").click();
const bubble = page.getByRole("dialog", { name: "Link options" });
await bubble.waitFor();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/2-bubble-view.png` });

// 3 — bubble edit form
await bubble.getByRole("button", { name: "Edit link" }).click();
await page.getByRole("dialog", { name: "Edit link" }).getByLabel("Link URL").waitFor();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/3-bubble-edit.png` });
await page.keyboard.press("Escape");

// 4 — ⌘K with the link selected → toolbar Edit dialog (with Remove)
await editor.locator("a").click();
await bubble.waitFor();
await page.waitForTimeout(150);
await page.keyboard.press("ControlOrMeta+k");
await page.getByRole("dialog", { name: "Edit link" }).waitFor();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/4-edit-dialog.png` });

console.log("screenshots saved to", OUT);
await browser.close();

async function expectHref(page, href) {
  const actual = await page.locator(".prose-omnom a").getAttribute("href");
  if (actual !== href) throw new Error(`expected href ${href}, got ${actual}`);
}
