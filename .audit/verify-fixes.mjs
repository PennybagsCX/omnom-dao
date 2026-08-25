import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// F-1: notification bell badge — render needs auth, so check the computed token mapping instead.
// We verify globals.css now maps destructive-foreground to a dark color by reading the cascade on a Badge.
await page.goto("http://localhost:3100/brand", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);

// F-2: brand page renders Badge variant="destructive" ("Failed") — measure its computed bg+color
const destr = await page.evaluate(() => {
  // find the destructive badge: text "Failed"
  const el = [...document.querySelectorAll('*')].find(e => e.children.length===0 && (e.textContent||'').trim()==='Failed' && e.classList.contains('bg-destructive'));
  if (!el) return { found: false };
  const s = getComputedStyle(el);
  return {
    found: true,
    bg: s.backgroundColor,
    color: s.color,
    text: el.textContent.trim(),
  };
});
console.log("F-2 destructive badge (Failed):", JSON.stringify(destr));

// Also measure success badge ("Passed") for comparison
const succ = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => e.children.length===0 && (e.textContent||'').trim()==='Passed' && e.classList.contains('bg-success'));
  if (!el) return { found: false };
  const s = getComputedStyle(el);
  return { found: true, bg: s.backgroundColor, color: s.color };
});
console.log("F-2 success badge (Passed, control):", JSON.stringify(succ));

// F-2b: destructive BUTTON on brand page ("Destructive")
const destrBtn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(e => (e.textContent||'').trim()==='Destructive');
  if (!el) return { found: false };
  const s = getComputedStyle(el);
  return { found: true, bg: s.backgroundColor, color: s.color };
});
console.log("F-2 destructive button:", JSON.stringify(destrBtn));

await browser.close();
