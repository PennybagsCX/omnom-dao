import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * App-level favicon — rendered at build time by Next.js.
 * A gold circle on a deep-dark background to match the OMNOM brand.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 900,
          background: "#000000",
          color: "#FFD700",
          borderRadius: "50%",
        }}
      >
        Ø
      </div>
    ),
    { ...size },
  );
}
