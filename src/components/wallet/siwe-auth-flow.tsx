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
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const qc = useQueryClient();
  const { data: me, isPending: mePending, isFetching: meFetching } = useCurrentUser();

  const mountedRef = useRef(false);
  const prevAddressRef = useRef<string | undefined>(undefined);
  const loginParamHandledRef = useRef(false);

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
  // Wait for the auth probe to SETTLE (either outcome) before deciding.
  // `isPending` — not `me === undefined` — is the loading signal here: for
  // anonymous visitors /api/v1/me answers 401 and `me` data stays undefined
  // forever (retry: false), so a data-based guard would never unblock the
  // auto-open. A settled SUCCESS means the wallet is already verified and
  // `!me` is false — this is what keeps the dialog from popping on every
  // reload of an authenticated Ledger user (wagmi reconnects before `me`
  // resolves).
  //
  // Also skip while RainbowKit's connect modal (or WalletConnect QR pane) is
  // open, so the verify dialog never stacks on top of it. The early returns
  // leave `prevAddressRef` untouched, so the address transition still fires
  // once the pending condition clears.
  //
  // `meFetching` covers background REFETCHES (e.g. the dev-auth chain's
  // invalidateQueries right after devLogin): the query's status stays
  // "error" through a refetch, so `mePending` alone would let the auto-open
  // fire for a user who is about to be revealed as authenticated.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevAddressRef.current = address;
      return;
    }
    if (mePending || meFetching) return;
    if (connectModalOpen) return;
    if (address && address !== prevAddressRef.current && !me) {
      setOpen(true);
    }
    prevAddressRef.current = address;
  }, [address, me, mePending, meFetching, connectModalOpen]);

  // Deep-link recovery: an expired session bounces through
  // /verify/result → /?login=1 (see src/app/verify/result/page.tsx).
  // Re-open the connect flow once so the user isn't stranded on the homepage.
  // Wait for the auth probe to settle and skip entirely for users who are
  // already verified — a stale deep link must never re-prompt them to sign.
  // The timeout keeps setState out of the effect body (React Compiler rule);
  // the handled-flag lives inside the callback so StrictMode's
  // setup→cleanup→setup cycle can't swallow the timer or double-fire it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("login")) return;
    if (mePending || me) return;
    const t = window.setTimeout(() => {
      if (loginParamHandledRef.current) return;
      loginParamHandledRef.current = true;
      connect();
    }, 0);
    return () => window.clearTimeout(t);
  }, [connect, me, mePending]);

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
