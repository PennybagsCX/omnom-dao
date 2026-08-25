"use client";

import { useEffect } from "react";
import { installEnhancedMockWallet, switchMockAccount } from "@/config/enhanced-mock-wallet";

interface DevWalletWindow {
  __autoInstallClientRan?: boolean;
  switchDevMockAccount?: typeof switchMockAccount;
}

function devWalletWindow(): DevWalletWindow {
  return window as unknown as DevWalletWindow;
}

/**
 * Client-side component that auto-installs the enhanced mock wallet on mount.
 * This ensures the installation happens in the browser after React hydration,
 * not during SSR where window is undefined.
 */
export function AutoInstallDevWalletClient() {
  useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== "development") return;

    // Prevent multiple installations
    if (devWalletWindow().__autoInstallClientRan) {
      console.log("[AutoInstallClient] Already installed, skipping...");
      return;
    }

    devWalletWindow().__autoInstallClientRan = true;

    console.log("[AutoInstallClient] 🚀 Client-side auto-install starting...");

    // Use the canonical installation function from enhanced-mock-wallet.ts
    const success = installEnhancedMockWallet();

    if (success) {
      console.log("[AutoInstallClient] ✅ Enhanced mock wallet installed successfully");

      // Re-export switchMockAccount for panel convenience
      devWalletWindow().switchDevMockAccount = switchMockAccount;

      console.log("[AutoInstallClient] ✅ Client-side automatic installation complete!");
    } else {
      console.warn("[AutoInstallClient] ⚠️ Installation prevented (check console for details)");
      console.warn("[AutoInstallClient] Real wallet extension may be blocking installation");
      console.warn("[AutoInstallClient] Try: Disable browser wallet extension, use incognito mode, or allow override");
    }
  }, []);

  return null; // This component doesn't render anything
}
