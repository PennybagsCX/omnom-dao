/**
 * Wagmi configuration - Simplified without mock wallet in RainbowKit
 * 
 * This removes the problematic mock wallet from RainbowKit's wallet list
 * while keeping the dev auth system working perfectly.
 */

import { http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// Wallet connectors (standard ones only)
import {
  metaMaskWallet,
  injectedWallet,
  braveWallet,
} from "@rainbow-me/rainbowkit/wallets";

/**
 * Custom read-only Dogechain snapshot chain definition (chain ID 2000).
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
    default: { name: "Dogechain Snapshot", url: "https://github.com/DBOT-DC/omnom-snapshot" },
  },
  testnet: false,
});

/**
 * WalletConnect Cloud project ID.
 *
 * Required for WalletConnect wallets (WalletConnect, Trust, Argent, etc.).
 * Get a free project ID at https://cloud.walletconnect.com and set in .env.local
 */
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();
const hasWalletConnect = !!projectId;

if (typeof window !== "undefined" && !hasWalletConnect) {
  console.warn(
    "[OMNOM] NEXT_PUBLIC_WC_PROJECT_ID is not set. " +
      "WalletConnect-based wallets will NOT work. " +
      "Get a free project ID at https://cloud.walletconnect.com and set it in .env.local.",
  );
}

const MAINNET_RPC = "https://ethereum-rpc.publicnode.com";

/**
 * Standard wallet configuration without mock wallet
 * The mock wallet auto-connect works via the dev auth API instead
 */
export const config = getDefaultConfig({
  appName: "$OMNOM DAO",
  // Use a valid UUID format for dev; WalletConnect wallets won't actually work
  // without a real project ID from https://cloud.walletconnect.com
  projectId: projectId || "00000000-0000-0000-0000-000000000000",
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        injectedWallet,
        metaMaskWallet,
        braveWallet,
      ],
    },
  ],
  chains: [dogechainSnapshot, mainnet],
  transports: {
    [dogechainSnapshot.id]: http("https://rpc.dogechain.dog"),
    [mainnet.id]: http(MAINNET_RPC),
  },
  ssr: true,
});

/**
 * Helper functions for enhanced mock wallet (kept for direct access)
 */
interface EnhancedMockProvider {
  __isEnhancedMock?: boolean;
  [key: string]: unknown;
}

function readMockProvider(): EnhancedMockProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __enhancedMockWallet?: EnhancedMockProvider }).__enhancedMockWallet;
}

export function isEnhancedMockWalletAvailable(): boolean {
  return readMockProvider()?.__isEnhancedMock === true;
}

export function getEnhancedMockWalletProvider(): EnhancedMockProvider | null {
  return readMockProvider() ?? null;
}
