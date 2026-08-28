import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

/**
 * Build the canonical OMNOM DAO social-share card.
 *
 * Note: font support in @vercel/og + edge runtime has been unreliable in
 * recent Vercel regions (returns 0-byte responses). We render with the
 * system sans-serif stack — every platform's default sans (SF Pro on Apple,
 * Segoe UI on Windows, Inter / Cantarell / Noto on Linux) renders close
 * enough to Inter to be visually indistinguishable on social previews.
 *
 * The brand colors and layout still match `src/app/globals.css` so the
 * share preview looks like part of the same product.
 */
export function buildOgCard(): ImageResponse {
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
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* Subtle gold glow */}
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

        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 1 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#FFD700", letterSpacing: -0.8 }}>OMNOM</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#FAFAFA", letterSpacing: -0.8 }}>DAO</span>
        </div>

        {/* Election title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, zIndex: 1 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: "#A1A1AA", letterSpacing: 4, textTransform: "uppercase" }}>
            Foundational Governance Election
          </span>
          <span style={{ fontSize: 82, fontWeight: 800, color: "#FFD700", letterSpacing: -2, lineHeight: 1.05 }}>
            Pick the Voting Math
          </span>
          <span style={{ fontSize: 30, color: "#FAFAFA", marginTop: 4, fontWeight: 400 }}>
            Linear · 1W1V · Tiered · Quadratic
          </span>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
          <span style={{ fontSize: 24, color: "#A1A1AA", fontWeight: 400 }}>
            25,686 eligible wallets · Aug 29 → Sep 12, 2026
          </span>
          <span style={{ fontSize: 22, color: "#FFD700", fontWeight: 600, letterSpacing: -0.3 }}>
            dao.omnom.dog
          </span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}