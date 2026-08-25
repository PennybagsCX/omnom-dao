import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3100/", { waitUntil: "networkidle", timeout: 30000 });
// 1. Skip link visible on focus?
await page.keyboard.press("Tab");
const skipVisible = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? { tag: el.tagName, href: el.getAttribute("href"), text: el.innerText, rect: el.getBoundingClientRect() } : null;
});
console.log("First tab target (skip link?):", JSON.stringify(skipVisible));

// 2. Tab through and collect focusable sequence
const focused = [];
for (let i = 0; i < 15; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, text: (el.innerText||"").slice(0,30), href: el.getAttribute("href")||"", aria: el.getAttribute("aria-label")||"", x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  focused.push(info);
}
console.log("Tab sequence (first 15):");
focused.forEach((f,i) => console.log(`  ${i+1}. ${f.tag} "${f.text||f.aria||f.href}" at (${f.x},${f.y}) ${f.w}x${f.h}`));

// 3. Reduced motion: verify CSS override
await page.emulateMedia({ reducedMotion: "reduce" });
const rm = await page.evaluate(() => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const d = getComputedStyle(el);
  return { transitionDuration: d.transitionDuration, animationDuration: d.animationDuration };
});
console.log("Reduced-motion computed style:", JSON.stringify(rm));

await browser.close();
