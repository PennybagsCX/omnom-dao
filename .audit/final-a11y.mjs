import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const routes = ["/","/proposals","/dashboard","/faq","/brand","/settings","/notifications","/admin","/verify/result","/proposals/create"];
const issues = [];
for (const path of routes) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try { await page.goto("http://localhost:3100"+path, { waitUntil: "networkidle", timeout: 30000 }); } catch { await ctx.close(); continue; }
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const out = { path: location.pathname, dupIds: [], lang: document.documentElement.lang, colorScheme: getComputedStyle(document.documentElement).colorScheme, title: document.title };
    const ids = {}; document.querySelectorAll("[id]").forEach(el => { ids[el.id] = (ids[el.id]||0)+1; });
    Object.entries(ids).forEach(([k,v]) => { if (v>1) out.dupIds.push(`${k}(x${v})`); });
    return out;
  });
  if (r.dupIds.length) issues.push(`DUP_ID ${path}: ${r.dupIds.join(", ")}`);
  if (!r.lang) issues.push(`NO_LANG ${path}`);
  if (!r.colorScheme || r.colorScheme === "normal") issues.push(`NO_DARK_SCHEME ${path}: ${r.colorScheme}`);
  await ctx.close();
}
console.log("issues:", issues.length);
issues.forEach(i => console.log("  -", i));
await browser.close();
