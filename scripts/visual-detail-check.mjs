/**
 * Visual-verification driver: submit a proposal containing a markdown link
 * through the wizard, then screenshot the detail page's rendered description.
 *
 * Usage: node scripts/visual-detail-check.mjs   (dev server on :3000 required)
 */
import { chromium } from "@playwright/test";
import { dismissWalletDialog, hideDevAuthPanel } from "../tests/e2e/helpers.ts";

const OUT = "/tmp/omnom-link-visual";
const BASE = "http://localhost:3000";
const WALLET = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"; // WHALE (DOLPHIN hit the 24h proposal cooldown)

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const res = await context.request.post(`${BASE}/api/v1/dev-login`, {
  data: { walletAddress: WALLET },
});
if (!res.ok()) throw new Error(`dev-login failed: ${res.status()}`);

await page.goto(`${BASE}/proposals/create`);
await page.waitForLoadState("networkidle");
await dismissWalletDialog(page);
await hideDevAuthPanel(page);

await page.getByRole("button", { name: /treasury/i }).click();
await page.getByRole("button", { name: /^next/i }).click();

await page
  .getByLabel(/title/i)
  .fill(`Detail page link rendering check ${Date.now()}`);
const editor = page.locator(".prose-omnom");
await editor.click();
await page.keyboard.type("This description comfortably clears the fifty character minimum.");
await page.keyboard.press("Enter");
await page.keyboard.type("blueprint");
await page.keyboard.press("Enter");
await page.keyboard.type("A closing sentence after the linked word.");

// Link "blueprint" via the proven dblclick → ⌘K → fill → Insert flow.
await page.getByText("blueprint").dblclick({ position: { x: 8, y: 8 } });
await page.waitForTimeout(150);
await page.keyboard.press("ControlOrMeta+k");
const dlg = page.getByRole("dialog", { name: "Insert link" });
await dlg.waitFor();
await page.locator("#link-url").fill("example.com");
await dlg.getByRole("button", { name: "Insert" }).click();
await page.waitForTimeout(200);

// → parameters → review → confirm → submit
await page.getByRole("button", { name: /^next/i }).click();
await page.getByRole("button", { name: /^next/i }).click();
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: /submit proposal/i }).click();
try {
  await page.getByRole("link", { name: "View Proposal" }).waitFor({ timeout: 30_000 });
} catch {
  await page.screenshot({ path: `${OUT}/5-submit-failed.png`, fullPage: true });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  console.log("VISIBLE TEXT:", (await page.locator("body").innerText()).slice(0, 1500));
  throw new Error("submit did not reach the success screen");
}
await page.getByRole("link", { name: "View Proposal" }).click();

// Detail page: wait for the description block to render the anchor
// (the link's accessible name is its text — "blueprint" — not the href)
const detailLink = page.getByRole("link", { name: "blueprint" }).first();
await detailLink.waitFor({ timeout: 30_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/5-detail-page.png`, fullPage: false });

const href = await detailLink.getAttribute("href");
const target = await detailLink.getAttribute("target");
const rel = await detailLink.getAttribute("rel");
console.log(JSON.stringify({ href, target, rel }));
await browser.close();
