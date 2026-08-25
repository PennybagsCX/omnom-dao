"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Development-only admin login button
 * Creates an authenticated session for mock wallet testing
 */
export function DevLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleDevLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if mock wallet is connected
      const ethereum = (window as Window & { ethereum?: { __isEnhancedMock?: boolean; selectedAddress?: string; address?: string } }).ethereum;
      if (!ethereum?.__isEnhancedMock) {
        setError("Mock wallet not connected. Please connect the mock wallet first.");
        setIsLoading(false);
        return;
      }

      const mockAddress = ethereum.selectedAddress || ethereum.address;
      if (!mockAddress) {
        setError("No mock wallet address found.");
        setIsLoading(false);
        return;
      }

      // Call dev login endpoint
      const response = await fetch('/api/v1/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: mockAddress }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Dev login failed');
        setIsLoading(false);
        return;
      }

      // Invalidate queries to refresh with new auth state
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["admin", "pending"] });

      // Show success and reload
      setTimeout(() => window.location.reload(), 500);

    } catch (err) {
      console.error('Dev login error:', err);
      setError('Failed to create dev admin session');
      setIsLoading(false);
    }
  };

  // Only show in development with enabled flag
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH !== "true") return null;

  return (
    <div className="mb-6 rounded-lg border border-gold/30 bg-gold/10 p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-gold" />
          Development Mode Admin Login
        </div>
        <p className="text-xs text-text-dim">
          Create an authenticated session for mock wallet testing
        </p>
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDevLogin}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Session...
            </>
          ) : (
            "Create Dev Admin Session"
          )}
        </Button>
      </div>
    </div>
  );
}
