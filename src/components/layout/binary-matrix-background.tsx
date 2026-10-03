"use client";

import { useEffect, useRef } from "react";

/**
 * Full-viewport animated background: the doge portrait rendered as a grid of
 * flickering 0s/1s sampled from the photo's pixels (one Canvas 2D rAF loop).
 *
 * - Purely decorative: `pointer-events-none`, `aria-hidden`, sits behind all
 *   content at low opacity so text stays readable.
 * - The single source image fits the band between the fixed top header and
 *   bottom nav (measured from the DOM), so the ears and chin are never hidden
 *   behind them on any screen size or orientation.
 * - Cell size scales with viewport area, bounding the glyph count (~3k on a
 *   phone, ~8k at 4K) so the loop stays cheap on every device.
 * - The animation loop self-heals: every frame it checks whether the viewport
 *   still matches the built grid, so a missed resize event (rotation, mobile
 *   URL-bar races, emulation switches) can never leave a stale render.
 * - Honors `prefers-reduced-motion`: renders a single static frame instead
 *   of a flicker loop.
 */

const IMAGE_SRC = "/doge-matrix.png";
const GLYPH_ALPHA = 0.8; // per-glyph alpha before the canvas-level opacity
const SKIP_BELOW_BRIGHTNESS = 18; // photo's pure-black backdrop → skip cell

type Cell = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  text: string;
  changeSpeed: number;
};

export function BinaryMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("BinaryMatrixBackground: canvas 2D context unavailable");
      return;
    }

    let rafId = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let buildId = 0;
    let cells: Cell[] = [];
    let cellSize = 10;
    // Viewport the current grid was built for — verified every frame (see
    // animate) so a missed resize event can never leave a stale render.
    let builtFor = { vw: 0, vh: 0 };

    const build = () => {
      buildId += 1;
      const id = buildId;
      cancelAnimationFrame(rafId);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      builtFor = { vw, vh };

      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Glyph budget: sqrt(viewport area) / 90 → cell ~13px on a laptop,
      // ~32px at 4K, floored at 10px on phones.
      cellSize = Math.max(10, Math.round(Math.sqrt(vw * vh) / 90));
      const cols = Math.ceil(vw / cellSize);
      const rows = Math.ceil(vh / cellSize);

      // Safe band between the fixed navbars, measured from the live DOM so
      // any future header/bottom-nav height change stays correct (BottomNav
      // is `lg:hidden`, where offsetHeight reads 0).
      const headerEl = document.querySelector("header");
      const bottomNavEl = document.querySelector("nav.fixed");
      const topInset = headerEl instanceof HTMLElement ? headerEl.offsetHeight : 0;
      const bottomInset = bottomNavEl instanceof HTMLElement ? bottomNavEl.offsetHeight : 0;

      // Equal breathing room above and below the portrait: the gap beyond
      // each viewport edge matches the taller navbar (+5%), so the doge reads
      // vertically centered between the navbars (and the viewport edges).
      const gap = Math.max(topInset, bottomInset) * 1.05;
      const firstRow = Math.ceil(gap / cellSize);
      const lastRow = Math.floor((vh - gap) / cellSize) - 1;

      // Sample buffer at exactly one pixel per cell: the cover-fit image is
      // drawn into a cols×rows canvas, so each cell reads its color straight
      // from the downscaled pixel — no per-cell image sampling math.
      const scan = document.createElement("canvas");
      scan.width = cols;
      scan.height = rows;
      const sctx = scan.getContext("2d", { willReadFrequently: true });
      if (!sctx) {
        console.error("BinaryMatrixBackground: scan canvas 2D context unavailable");
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (disposed || id !== buildId) return;

        // Contain-fit the whole doge inside the safe band (ears, chin and
        // sides all visible on every device; smaller on phones, never
        // cropped), centered in the band.
        const bandRows = Math.max(lastRow - firstRow + 1, 1);
        const scale = Math.min(cols / img.width, bandRows / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (cols - dw) / 2;
        const dy0 = firstRow + (bandRows - dh) / 2;
        sctx.drawImage(img, dx, dy0, dw, dh);

        // The photo's head is not centered inside its own frame, so after
        // drawing, re-center on the visible glyph mass: find the first/last
        // rows that actually carry cells and shift the drawing so their
        // midpoint lands on the band's midpoint.
        const probe = sctx.getImageData(0, 0, cols, rows).data;
        let firstContentRow = -1;
        let lastContentRow = -1;
        for (let row = 0; row < rows; row++) {
          let any = false;
          for (let col = 0; col < cols; col++) {
            const i = (row * cols + col) * 4;
            if (
              ((probe[i] ?? 0) + (probe[i + 1] ?? 0) + (probe[i + 2] ?? 0)) / 3 >=
              SKIP_BELOW_BRIGHTNESS
            ) {
              any = true;
              break;
            }
          }
          if (any) {
            if (firstContentRow < 0) firstContentRow = row;
            lastContentRow = row;
          }
        }
        if (firstContentRow >= 0 && lastContentRow >= firstContentRow) {
          const shift = Math.round(
            firstRow + bandRows / 2 - (firstContentRow + lastContentRow) / 2
          );
          if (shift !== 0) {
            sctx.clearRect(0, 0, cols, rows);
            sctx.drawImage(img, dx, dy0 + shift, dw, dh);
          }
        }
        const data = sctx.getImageData(0, 0, cols, rows).data;

        cells = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const i = (row * cols + col) * 4;
            // Indices are in-bounds by construction (row < rows, col < cols).
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            if ((r + g + b) / 3 < SKIP_BELOW_BRIGHTNESS) continue;
            cells.push({
              x: col * cellSize,
              y: row * cellSize,
              r,
              g,
              b,
              text: Math.random() > 0.5 ? "1" : "0",
              changeSpeed: Math.random() * 0.05 + 0.01,
            });
          }
        }

        const drawFrame = () => {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, vw, vh);
          ctx.textBaseline = "top";
          ctx.font = `${cellSize}px monospace`;
          for (const c of cells) {
            if (Math.random() < c.changeSpeed) {
              c.text = Math.random() > 0.5 ? "1" : "0";
            }
            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${GLYPH_ALPHA})`;
            ctx.fillText(c.text, c.x, c.y);
          }
        };

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          drawFrame(); // static portrait, no loop
          return;
        }

        const animate = () => {
          // Missed-resize guard: if the viewport changed since this grid was
          // built (event lost during load/rotation/emulation), rebuild now.
          if (window.innerWidth !== builtFor.vw || window.innerHeight !== builtFor.vh) {
            build();
            return;
          }
          drawFrame();
          rafId = requestAnimationFrame(animate);
        };
        animate();
      };
      img.onerror = () => {
        if (!disposed && id === buildId) {
          console.error(`BinaryMatrixBackground: failed to load ${IMAGE_SRC}`);
        }
      };
      img.src = IMAGE_SRC;
    };

    build();

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 200);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      buildId += 1;
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ opacity: "var(--doge-opacity, 0.2)" }}
    />
  );
}
