import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const reqs = [];
page.on("response", async (r) => {
  if (r.status() === 401) reqs.push(`${r.status()} ${r.url()}`);
});
await page.goto("http://localhost:3100/dashboard", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);
console.log("401 responses on /dashboard:", reqs);
await browser.close();
