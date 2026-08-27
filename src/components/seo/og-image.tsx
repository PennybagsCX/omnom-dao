import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_RUNTIME = "edge" as const;
export const OG_CONTENT_TYPE = "image/png" as const;

/**
 * Loads Inter from Google Fonts at edge runtime. Cached aggressively
 * (`force-cache`) so the first request after deploy pays the network cost
 * once and every subsequent request hits Vercel's edge cache.
 *
 * Only weights 400 + 800 are bundled — keeps the edge payload small while
 * matching the live site's typography (`src/app/layout.tsx`).
 */
async function loadInterFonts(): Promise<
  { regular: ArrayBuffer; bold: ArrayBuffer }
> {
  const fetchAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Failed to fetch font ${url}: ${res.status}`);
    }
    return res.arrayBuffer();
  };

  const [regular, bold] = await Promise.all([
    fetchAsArrayBuffer(
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.woff2",
    ),
    fetchAsArrayBuffer(
      "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.woff2",
    ),
  ]);
  return { regular, bold };
}

/**
 * Build the canonical OMNOM DAO social-share card.
 *
 * Returns an `ImageResponse` rendered at the edge — used by both
 * `/opengraph-image` (Facebook, LinkedIn, Discord, Slack, Telegram, iMessage)
 * and `/twitter-image` (X / Twitter card).
 *
 * Layout (top → bottom):
 *   1. Brand mark — "OMNOM" (gold) · "DAO" (white), Inter 700
 *   2. Election tagline — "Foundational Governance Election" (uppercase, dim)
 *   3. Headline — "Pick the Voting Math" (gold, Inter 800)
 *   4. Choices — "Linear · 1W1V · Tiered · Quadratic" (white, Inter 400)
 *   5. Window + eligibility + canonical URL
 *
 * Color tokens mirror `src/app/globals.css`:
 *   --color-bg-deep     (#000000) — page background
 *   --color-gold        (#FFD700) — primary accent
 *   --color-text-dim    (#A1A1AA) — muted labels
 *   --color-foreground  (#FAFAFA) — body text
 */
export async function buildOgCard(
  altText: string,
): Promise<ImageResponse> {
  const { regular, bold } = await loadInterFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#000000",
          backgroundImage:
            "linear-gradient(135deg, #000000 0%, #0f0f0f 50%, #000000 100%)",
          fontFamily: '"Inter"',
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* Subtle gold glow behind the headline */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 720,
            height: 200,
            background:
              "radial-gradient(ellipse at center, rgba(255, 215, 0, 0.10) 0%, rgba(255, 215, 0, 0) 70%)",
            display: "flex",
          }}
        />

        {/* Top — brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: "#FFD700",
              letterSpacing: -0.8,
            }}
          >
            OMNOM
          </span>
          <span
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: "#FAFAFA",
              letterSpacing: -0.8,
            }}
          >
            DAO
          </span>
        </div>

        {/* Middle — election title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#A1A1AA",
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Foundational Governance Election
          </span>
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#FFD700",
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            Pick the Voting Math
          </span>
          <span
            style={{
              fontSize: 30,
              color: "#FAFAFA",
              marginTop: 4,
              fontWeight: 400,
            }}
          >
            Linear · 1W1V · Tiered · Quadratic
          </span>
        </div>

        {/* Bottom — eligibility + window + URL */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 24,
              color: "#A1A1AA",
            }}
          >
            25,686 eligible wallets · Aug 29 → Sep 12, 2026
          </span>
          <span
            style={{
              fontSize: 22,
              color: "#FFD700",
              fontWeight: 600,
              letterSpacing: -0.3,
            }}
          >
            dao.omnom.dog
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: bold, weight: 800, style: "normal" },
      ],
    },
  );
}