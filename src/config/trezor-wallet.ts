/**
 * Custom Trezor wallet connector for RainbowKit.
 *
 * RainbowKit doesn't ship a built-in Trezor connector, so we define one here
 * that uses WalletConnect as the transport layer (same approach RainbowKit
 * uses for Ledger). Trezor users connect via WalletConnect's QR code flow
 * from the Trezor Suite desktop app.
 */
import { createConnector, type CreateConnectorFn } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";

// Inline SVG icon (simplified Trezor device silhouette).
const TREZOR_ICON = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#000000"/>
    <path d="M16 6C12.7 6 10 8.7 10 12v4l-2 2v4h16v-4l-2-2v-4c0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4v4h-8v-4c0-2.2 1.8-4 4-4zm-1 10h2v4h-2v-4z" fill="#FFFFFF"/>
  </svg>`,
).toString("base64")}`;

/**
 * Create a Trezor wallet entry for RainbowKit's wallet list.
 *
 * Uses WalletConnect under the hood (same as Ledger) since there's no direct
 * browser-injected Trezor connector.
 *
 * Matches RainbowKit's `CreateWalletFn` signature so it can be passed directly
 * in the wallet list alongside built-in wallet factories like `ledgerWallet`.
 */
export function trezorWallet(): (params: { projectId: string }) => Wallet {
  return ({ projectId }: { projectId: string }): Wallet => {

  return {
    id: "trezor",
    name: "Trezor",
    rdns: "io.trezor",
    shortName: "Trezor",
    iconUrl: TREZOR_ICON,
    iconAccent: "#000000",
    iconBackground: "#000000",
    hidden: () => false,

    createConnector: (walletDetails: WalletDetailsParams) => {
      const connector: CreateConnectorFn = createConnector((config) => ({
        ...walletConnect({
          projectId,
          showQrModal: false,
        })(config),
        ...walletDetails,
      }));

      return connector;
    },

    qrCode: {
      getUri: (uri: string) => uri,
      instructions: {
        learnMoreUrl: "https://trezor.io/learn/a/suite",
        steps: [
          {
            step: "install" as const,
            title: "Open Trezor Suite",
            description:
              "Open Trezor Suite on your desktop or browser. Make sure your Trezor device is connected and unlocked.",
          },
          {
            step: "create" as const,
            title: "Connect via WalletConnect",
            description:
              "In Trezor Suite, scan the QR code or use the WalletConnect link to connect your Trezor to this dApp.",
          },
          {
            step: "scan" as const,
            title: "Scan the QR code",
            description:
              "Use Trezor Suite's QR scanner to scan the code shown here.",
          },
        ],
      },
    },

    desktop: {
      getUri: (uri: string) => uri,
      instructions: {
        learnMoreUrl: "https://trezor.io/learn/a/suite",
        steps: [
          {
            step: "install" as const,
            title: "Open Trezor Suite",
            description:
              "Open Trezor Suite on your desktop. Make sure your Trezor device is connected and unlocked.",
          },
          {
            step: "create" as const,
            title: "Connect to the dApp",
            description:
              "In Trezor Suite, use the WalletConnect option to connect to OMNOMDAO.",
          },
        ],
      },
    },

    extension: {
      instructions: {
        learnMoreUrl: "https://trezor.io/trezor-suite",
        steps: [
          {
            step: "install" as const,
            title: "Open Trezor Suite",
            description:
              "Trezor requires Trezor Suite. Make sure your device is connected, unlocked, and the firmware is up to date.",
          },
          {
            step: "connect" as const,
            title: "Connect via WalletConnect",
            description:
              "Use the WalletConnect QR code flow in Trezor Suite to connect your Trezor hardware wallet.",
          },
        ],
      },
    },
  };
  };
}
