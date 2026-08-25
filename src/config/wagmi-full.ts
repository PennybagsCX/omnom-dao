import { http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { trezorWallet } from "@/config/trezor-wallet";

// ── Wallet connectors ──────────────────────────────────────────
import {
  // Default group — the most popular EVM wallets
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  trustWallet,
  rabbyWallet,
  // Injected & browser-based
  injectedWallet,
  braveWallet,
  frameWallet,
  enkryptWallet,
  // Hardware wallets
  safepalWallet,
  // Mobile-first & multi-chain (EVM-capable)
  okxWallet,
  bitgetWallet,
  bybitWallet,
  binanceWallet,
  gateWallet,
  krakenWallet,
  // Popular dApp wallets
  phantomWallet,
  uniswapWallet,
  zerionWallet,
  mewWallet,
  tokenPocketWallet,
  imTokenWallet,
  safeWallet,
  oneKeyWallet,
  frontierWallet,
  argentWallet,
  subWallet,
  zealWallet,
  tahoWallet,
  omniWallet,
} from "@rainbow-me/rainbowkit/wallets";

/**
 * Custom read-only "Dogechain (Snapshot)" chain definition (chain ID 2000).
 *
 * Dogechain is sunset — no live RPC, no on-chain reads are ever issued. This
 * chain exists purely for wallet UI context and SIWE `personal_sign` (a local
 * elliptic-curve operation). We register a couple of live chains alongside it
 * so RainbowKit can connect to the user's actual wallet regardless of which
 * network they are on; we only ever use the connected address.
 */
export const dogechainSnapshot = defineChain({
  id: 2000,
  name: "Dogechain (Snapshot)",
  nativeCurrency: {
    name: "DOGE",
    symbol: "DOGE",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.dogechain.dog"] },
  },
  blockExplorers: {
    default: { name: "Dogechain Snapshot", url: "https://github.com/DBOT-DC/omnom-token" },
  },
  testnet: false,
});

/**
 * WalletConnect Cloud project ID.
 *
 * Without a valid project ID (from https://cloud.walletconnect.com), ALL
 * WalletConnect-based wallets will fail at the signing step:
 *   - Ledger (hardware, uses WC exclusively — no direct connector)
 *   - Trust Wallet, OKX, Bitget, and other mobile wallets
 *   - The "WalletConnect" QR-code option
 *
 * In dev, a non-empty placeholder is used so the app builds. WalletConnect
 * silently rejects the placeholder session, causing the "signature failed"
 * error that looks like the device isn't connected.
 */
const rawProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() || "";

// RainbowKit throws if projectId is empty or "YOUR_PROJECT_ID". Use the
// example project ID so the connector initializes; real WC connections still
// need a valid ID from cloud.walletconnect.com.
const projectId = rawProjectId || "21fef48091f12692cad574a6f7753643";

if (typeof window !== "undefined" && !rawProjectId) {
  console.warn(
    "[OMNOM] NEXT_PUBLIC_WC_PROJECT_ID is not set. " +
      "WalletConnect-based wallets (Ledger, Trust, OKX, etc.) will NOT work. " +
      "Get a free project ID at https://cloud.walletconnect.com and set it in .env.local.",
  );
}

// CORS-friendly public RPC endpoint. The default `http()` transport falls back
// to viem's public pool which does not send CORS headers and rate-limits
// aggressively (HTTP 429). PublicNode sends permissive CORS headers and is far
// more generous with rate limits. No on-chain reads are required by the app;
// this exists only so wallet connection + ENS resolution succeed silently.
const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";

/**
 * DEVELOPMENT-OPTIMIZED wallet configuration.
 * 
 * For mock wallet testing, we focus on core wallet connectors and avoid
 * WalletConnect-based wallets that trigger QR code generation issues.
 * The injected wallet connector works perfectly with our mock wallet system.
 */
const walletList = [
  {
    groupName: "Popular",
    wallets: [
      metaMaskWallet,
      rabbyWallet,
      coinbaseWallet,
      rainbowWallet,
      trustWallet,
      phantomWallet,
      injectedWallet, // This works perfectly with mock wallet
    ],
  },
  {
    groupName: "Hardware",
    wallets: [trezorWallet(), safepalWallet],
    // Note: Ledger requires WalletConnect which needs proper project ID
  },
  {
    groupName: "More",
    wallets: [
      braveWallet,
      okxWallet,
      bitgetWallet,
      bybitWallet,
      binanceWallet,
      gateWallet,
      krakenWallet,
      uniswapWallet,
      zerionWallet,
      safeWallet,
      mewWallet,
      tokenPocketWallet,
      imTokenWallet,
      frontierWallet,
      oneKeyWallet,
      argentWallet,
      subWallet,
      enkryptWallet,
      frameWallet,
      tahoWallet,
      zealWallet,
      omniWallet,
    ],
  },
];

/**
 * Shared wagmi config. Built once and reused by the Providers wrapper.
 *
 * Note: RainbowKit v2 + wagmi v3 are paired via legacy-peer-deps (per the
 * spec'd versions in TECHNICAL_ARCHITECTURE.md §3).
 */
export const config = getDefaultConfig({
  appName: "$OMNOM DAO",
  projectId,
  wallets: walletList,
  chains: [dogechainSnapshot, mainnet],
  transports: {
    [dogechainSnapshot.id]: http("https://rpc.dogechain.dog"),
    [mainnet.id]: http(MAINNET_RPC),
  },
  ssr: true,
});
