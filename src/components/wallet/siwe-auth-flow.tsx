"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";

import { ConnectWalletDialog } from "@/components/wallet/connect-wallet-dialog";
import { queryKeys, useCurrentUser } from "@/lib/api";

interface WalletDialogValue {
  /**
   * Initiate the connect → verify flow.
   *
   * When disconnected: opens RainbowKit's native wallet picker (consistent
   * across all entry points). Once the user picks a wallet, the SIWE verify
   * dialog auto-opens.
   *
   * When already connected but unverified: opens the OMNOM verify dialog
   * directly.
   */
  connect: () => void;
}

const WalletDialogContext = createContext<WalletDialogValue | null>(null);

/**
 * Access the wallet dialog controls. Must be used within {@link SiweAuthFlow}.
 * Throws if used outside the provider to fail fast on misuse.
 */
export function useWalletDialog(): WalletDialogValue {
  const ctx = useContext(WalletDialogContext);
  if (!ctx) {
    throw new Error("useWalletDialog must be used within <SiweAuthFlow>");
  }
  return ctx;
}

/**
 * Orchestrates the full wallet connect + SIWE verification lifecycle.
 *
 * - Provides a `connect()` action (via context) used by CTAs across the app.
 * - Watches wagmi's account: on a *fresh* connection (address transitions from
 *   undefined → defined after mount) it auto-opens the verification dialog so
 *   the nonce → sign → verify pipeline begins immediately.
 * - Renders the {@link ConnectWalletDialog} once, globally.
 * - After a successful verify it invalidates the `me` query so the header
 *   reflects the authenticated state.
 */
export function SiweAuthFlow({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();

  const mountedRef = useRef(false);
  const prevAddressRef = useRef<string | undefined>(undefined);

  const connect = useCallback(() => {
    // Already connected → jump straight to SIWE verification.
    if (address) {
      setOpen(true);
      return;
    }
    // Not connected → open RainbowKit's native wallet picker.
    // The verify dialog auto-opens once a wallet connects (via the effect below).
    if (openConnectModal) {
      openConnectModal();
    }
  }, [address, openConnectModal]);

  // Auto-open the verify dialog on a fresh wallet connection (not on the very
  // first mount, so returning authenticated users aren't prompted).
  //
  // Critical: skip the auto-open while `me` is still undefined (loading).
  // On page reload with a valid JWT cookie, `address` becomes set (wagmi
  // reconnects to the Ledger) BEFORE `me` has resolved from /api/v1/me.
  // Without this guard, an authenticated Ledger user gets the
  // "Check your wallet to sign" modal on every reload.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevAddressRef.current = address;
      return;
    }
    // Wait for the auth probe to settle — don't auto-open mid-loading.
    if (me === undefined) return;
    if (address && address !== prevAddressRef.current && !me) {
      setOpen(true);
    }
    prevAddressRef.current = address;
  }, [address, me]);

  // When the dialog closes after a successful verify, refresh identity queries.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        qc.invalidateQueries({ queryKey: queryKeys.me });
      }
    },
    [qc],
  );

  return (
    <WalletDialogContext.Provider value={{ connect }}>
      {children}
      <Suspense fallback={null}>
        <ConnectWalletDialog open={open} onOpenChange={handleOpenChange} />
      </Suspense>
    </WalletDialogContext.Provider>
  );
}
