import type { MetadataRoute } from "next";

/**
 * PWA manifest — enables "Add to Home Screen" on mobile devices.
 * Matches the dark gold theme with OMNOMDAO branding.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OMNOMDAO — Community Governance",
    short_name: "OMNOMDAO",
    description:
      "Off-chain, snapshot-based governance for OMNOM token holders. Connect your wallet, verify your holdings, and vote.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon?",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    categories: ["finance", "governance", "blockchain"],
  };
}
