/**
 * Root client-side providers with Auto-Triggering Dev Auth
 * 
 * This version provides truly automatic authentication by triggering
 * the dev auth system on page load, completely bypassing wagmi connection issues.
 */

"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import {
  darkTheme,
  RainbowKitProvider,
  type Theme,
} from "@rainbow-me/rainbowkit";

import "@rainbow-me/rainbowkit/styles.css";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiweAuthFlow } from "@/components/wallet/siwe-auth-flow";
import { AutoDevAuthTrigger } from "@/components/wallet/auto-dev-auth-trigger";
import { DevLoginPanel } from "@/components/wallet/dev-login-panel";
import { AutoInstallDevWalletClient } from "@/components/wallet/auto-install-client-component";

// Use the standard config - our mock wallet will work with it
import { config } from "@/config/wagmi";

/**
 * Custom RainbowKit theme tuned to the OMNOM dark palette.
 */
const omnomTheme: Theme = {
  ...darkTheme({
    accentColor: "#FFD700",
    accentColorForeground: "#000000",
    borderRadius: "medium",
    overlayBlur: "small",
  }),
  fonts: {
    body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
};

/**
 * Root client-side providers: React Query, wagmi, RainbowKit, tooltips, toasts.
 * 
 * AUTO-AUTH: Automatically triggers dev authentication on page load with ZERO user interaction.
 * This completely bypasses wagmi connection issues and provides instant authentication.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: false, // Fail fast for better error handling
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={omnomTheme}>
          <SiweAuthFlow>
            <TooltipProvider delayDuration={150}>
              {children}
            </TooltipProvider>
            <Toaster position="top-right" richColors />
            
            {/* Development-only auto-auth components.
                Set NEXT_PUBLIC_ENABLE_DEV_AUTH=true to opt into the dev-auth
                stack (auto-connect, dev panel, mock-wallet install). Defaults
                OFF in production. The source still exists in src/ for
                E2E/CI use but is gated out at runtime in prod. */}
            {process.env.NODE_ENV === "development" &&
              process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true" && (
              <>
                <AutoInstallDevWalletClient />
                <AutoDevAuthTrigger />
                <DevLoginPanel />
              </>
            )}
          </SiweAuthFlow>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
