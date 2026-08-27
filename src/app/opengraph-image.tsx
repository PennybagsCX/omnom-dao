import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OMNOM DAO Foundational Governance Election — vote now at dao.omnom.dog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic Open Graph image — rendered at the edge on each request.
 *
 * Election-themed banner highlighting the Foundational Governance Election
 * (FGE) window: 2026-08-29 → 2026-09-12.
 */
export default function OpenGraphImage() {
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
            "linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)",
          fontFamily: "sans-serif",
          padding: "60px 80px",
        }}
      >
        {/* Top — brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: "#FFD700",
              letterSpacing: -0.5,
            }}
          >
            OMNOM
          </span>
          <span
            style={{
              fontSize: 36,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: -0.5,
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
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 20,
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
              fontSize: 76,
              fontWeight: 800,
              color: "#FFD700",
              letterSpacing: -2,
              lineHeight: 1.1,
            }}
          >
            Pick the Voting Math
          </span>
          <span
            style={{
              fontSize: 28,
              color: "#FFFFFF",
              marginTop: 8,
            }}
          >
            Linear · 1W1V · Tiered · Quadratic
          </span>
        </div>

        {/* Bottom — eligibility + window */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: "#A1A1AA",
            }}
          >
            25,686 eligible wallets · Aug 29 → Sep 12, 2026
          </span>
          <span
            style={{
              fontSize: 20,
              color: "#FFD700",
              fontWeight: 600,
            }}
          >
            dao.omnom.dog
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}