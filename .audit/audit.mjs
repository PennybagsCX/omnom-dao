import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3100";
const OUT = ".audit/screenshots";

// Routes to audit. proposals/[id] uses a placeholder; we'll resolve later if needed.
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/proposals", name: "proposals" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/faq", name: "faq" },
  { path: "/brand", name: "brand" },
  { path: "/settings", name: "settings" },
  { path: "/notifications", name: "notifications" },
  { path: "/admin", name: "admin" },
  { path: "/verify/result", name: "verify-result" },
  { path: "/proposals/create", name: "proposals-create" },
];

// Breakpoints: [name, width, height]
const BREAKPOINTS = [
  ["mobile-320", 320, 568],   // iPhone SE 1st gen (smallest supported)
  ["mobile-390", 390, 844],   // iPhone 12/13/14
  ["tablet-768", 768, 1024],  // iPad portrait (md breakpoint)
  ["desktop-1024", 1024, 768],// lg breakpoint
  ["desktop-1280", 1280, 800],// xl breakpoint
  ["desktop-1440", 1440, 900],// common laptop
];

const browser = await chromium.launch({ headless: true });
const findings = [];

for (const [bpName, w, h] of BREAKPOINTS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Collect console errors + page errors globally per bp
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${bpName}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${bpName}] PAGEERR: ${err.message}`));

  for (const { path, name } of ROUTES) {
    const url = BASE + path;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      findings.push(`LOAD_FAIL [${bpName}] ${path}: ${e.message}`);
      continue;
    }
    // Wait a bit for framer-motion entrance animations to settle
    await page.waitForTimeout(1500);

    // 1. Horizontal overflow check (the big one)
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const bodyW = document.body.scrollWidth;
      const htmlW = document.documentElement.scrollWidth;
      return { docW, bodyW, htmlW, hasOverflow: bodyW > docW + 1 || htmlW > docW + 1 };
    });
    if (overflow.hasOverflow) {
      findings.push(`OVERFLOW [${bpName}] ${path}: docW=${overflow.docW} bodyW=${overflow.bodyW} htmlW=${overflow.htmlW}`);
    }

    // 2. Screenshot (full page, but cap height to avoid huge files for long pages)
    await page.screenshot({
      path: `${OUT}/${name}-${bpName}.png`,
      fullPage: false,
    });
  }

  // Log console errors collapsed
  if (consoleErrors.length) {
    findings.push(`CONSOLE_ERRORS [${bpName}] count=${consoleErrors.length}`);
    fs.writeFileSync(`${OUT}/_console-${bpName}.log`, consoleErrors.join("\n"));
  }

  await ctx.close();
}

// Accessibility scan at desktop + mobile for each route
const a11yFindings = [];
for (const [bpName, w, h] of [["mobile-390", 390, 844], ["desktop-1280", 1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const { path, name } of ROUTES) {
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    } catch { continue; }
    await page.waitForTimeout(1200);
    const res = await page.evaluate(() => {
      const out = { missingAlt: 0, iconBtnNoAria: 0, missingLabel: 0, buttons: 0, links: 0, inputs: 0 };
      // images without alt
      document.querySelectorAll("img").forEach((el) => {
        if (!el.getAttribute("alt")) out.missingAlt++;
      });
      // icon-only buttons (no text) without aria-label / aria-labelledby
      document.querySelectorAll("button").forEach((el) => {
        out.buttons++;
        const txt = (el.innerText || el.textContent || "").trim();
        const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        if (!txt && !aria) out.iconBtnNoAria++;
      });
      document.querySelectorAll("a[href]").forEach(() => out.links++);
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        out.inputs++;
        const id = el.getAttribute("id");
        const lab = id ? document.querySelector(`label[for="${id}"]`) : null;
        const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        if (!lab && !aria && el.tagName !== "BUTTON") out.missingLabel++;
      });
      return out;
    });
    a11yFindings.push({ bp: bpName, route: name, ...res });
  }
  await ctx.close();
}

fs.writeFileSync(`${OUT}/_findings.json`, JSON.stringify(findings, null, 2));
fs.writeFileSync(`${OUT}/_a11y.json`, JSON.stringify(a11yFindings, null, 2));
console.log("FINDINGS:", findings.length);
findings.forEach((f) => console.log("  -", f));
console.log("A11Y rows:", a11yFindings.length);
console.log("DONE");
await browser.close();
