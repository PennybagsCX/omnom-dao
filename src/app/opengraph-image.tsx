import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OMNOMDAO — Community Governance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic Open Graph image — rendered at the edge on each request.
 * Shows the OMNOMDAO branding on a black background with gold accents.
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
          justifyContent: "center",
          backgroundColor: "#000000",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: "#FFD700" }}>
            OMNOM
          </span>
          <span style={{ fontSize: 72, fontWeight: 800, color: "#FFFFFF" }}>
            DAO
          </span>
        </div>
        <span style={{ fontSize: 28, color: "#A1A1AA", marginTop: 16 }}>
          Community Governance · Snapshot-Based · No Gas Fees
        </span>
      </div>
    ),
    { ...size },
  );
}
