import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Bundle the server-only snapshot artifact (read via process.cwd() at
  // runtime, so static analysis cannot trace it) into the API route lambdas.
  outputFileTracingIncludes: {
    "/api/v1/**": ["./data/holders.json"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Content-Security-Policy",
            // Notes:
            //  - 'unsafe-eval' is REQUIRED by Tiptap/ProseMirror (schema
            //    construction uses eval internally). Removing it breaks the
            //    proposal-editor WYSIWYG. Tracked for hardening after v1.
            //  - 'unsafe-inline' in style-src is REQUIRED by shadcn/ui's
            //    CSS-in-JS and Tiptap's editor styles. Tracked for nonce-based
            //    CSP via middleware in v2.
            //  - report-uri points at /api/v1/csp-report (currently 404s — see
            //    Phase 5 backlog). Browsers POST violations there; once that
            //    endpoint lands, all CSP violations land in the audit log.
            //  - walletconnect.org / web3modal.org entries are required by
            //    the WalletConnect/AppKit machinery behind the WalletConnect
            //    and Ledger connect options: relay wss + https fallback,
            //    blockchain API (rpc), telemetry (pulse), explorer/config
            //    (api.web3modal.org) — verified against @walletconnect 2.21.x
            //    and live CSP violations. Least-privilege: legacy .com relay
            //    hosts and the Notify/Chat key server are NOT allowlisted
            //    (zero references in the installed bundle); watch
            //    /api/v1/csp-report after SDK bumps for new needs. img-src's
            //    https: already covers wallet icons.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://www.google.com https://va.vercel-scripts.com https://rpc.dogechain.dog https://ethereum-rpc.publicnode.com wss://relay.walletconnect.org https://relay.walletconnect.org https://rpc.walletconnect.org https://pulse.walletconnect.org https://api.web3modal.org",
              // verify.walletconnect.org is WalletConnect's attestation iframe,
              // loaded during pairing (observed live; blocks the QR flow if
              // absent). .com twin kept for SDK-region fallback.
              "frame-src 'self' https://verify.walletconnect.org https://verify.walletconnect.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
              "report-uri /api/v1/csp-report",
            ].join("; ")
          },
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "magnetometer=()",
              "gyroscope=()",
              "accelerometer=()",
              "interest-cohort=()",
            ].join(", ")
          }
        ]
      }
    ];
  }
};

export default withBundleAnalyzer(nextConfig);
