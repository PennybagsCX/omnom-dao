/**
 * Auto-Auth Trigger - Prevents Reload Loop + Auto-Connects Mock Wallet
 */

"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { devLogin } from "@/lib/dev-auth-bypass";
import { queryKeys } from "@/lib/api";
import { useAutoConnectDevWallet } from "@/lib/auto-connect-dev-wallet";

export function AutoDevAuthTrigger() {
  const autoAuthAttempted = useRef(false);
  const isAuthenticated = useRef(false);
  const qc = useQueryClient();
  const { autoConnect } = useAutoConnectDevWallet();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (autoAuthAttempted.current) return;
    if (isAuthenticated.current) return;

    const runAutoAuth = async () => {
      autoAuthAttempted.current = true;
      console.log('[AutoAuth] 🚀 Starting automatic dev authentication...');

      try {
        // First check if we're already authenticated by checking the API
        console.log('[AutoAuth] Checking if already authenticated...');
        const meResponse = await fetch('/api/v1/me', {
          credentials: 'include'
        });

        if (meResponse.ok) {
          console.log('[AutoAuth] ✅ Already authenticated - skipping auto-login');
          isAuthenticated.current = true;
          // Auto-connect the mock wallet
          await autoConnect();
          return; // Don't do anything if already authenticated
        }

        console.log('[AutoAuth] Not authenticated, proceeding with dev login...');
        const result = await devLogin('dolphin');

        if (result.success) {
          console.log('[AutoAuth] ✅ Auto-authentication successful!', result.account);
          isAuthenticated.current = true;

          // Invalidate me query so nav updates
          await qc.invalidateQueries({ queryKey: queryKeys.me });

          // Auto-connect the mock wallet
          await autoConnect();
        }
      } catch (error) {
        console.error('[AutoAuth] ❌ Auto-authentication failed:', error);
      }
    };

    // Run immediately on mount
    runAutoAuth();
  }, [qc, autoConnect]);

  return null; // No UI - completely silent operation
}
