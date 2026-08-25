/**
 * Development Login Panel - Bypass Mock Wallet Issues
 * 
 * This component provides a direct development authentication mechanism that
 * bypasses all the window.ethereum and SIWE signature issues while maintaining
 * full compatibility with the rest of the application.
 */

"use client";

import { useState, useEffect } from "react";
import { Bug, CheckCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { devLogin, getMockAccounts, type MockAccountType } from "@/lib/dev-auth-bypass";
import { queryKeys } from "@/lib/api";
import { useAutoConnectDevWallet } from "@/lib/auto-connect-dev-wallet";

interface MockAccountInfo {
  address: string;
  holderClass: string;
  balance: string;
  votingPower: number;
  rank: number;
  displayName: string;
}

export function DevLoginPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<MockAccountInfo | null>(null);
  const [mockAccounts] = useState(getMockAccounts);

  const { disconnect } = useDisconnect();
  const { address: connectedAddress, isConnected } = useAccount();
  const qc = useQueryClient();
  const { autoConnect } = useAutoConnectDevWallet();

  useEffect(() => {
    // Check if we're logged in by checking session
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/v1/me');
        if (response.ok) {
          const result = await response.json();
          
          // Handle both response structures: { data: {...} } or { success: true, data: {...} }
          const userData = result.data || result;
          const accountData = userData.data || userData;
          
          setCurrentAccount({
            address: accountData?.address || accountData?.walletAddress || accountData?.wallet_address || '',
            holderClass: accountData?.class || accountData?.holderClass || 'UNKNOWN',
            balance: accountData?.balanceFormatted || "N/A",
            votingPower: accountData?.votingPower || 0,
            rank: accountData?.rank || 0,
            displayName: accountData?.displayName || accountData?.display_name || `${accountData?.class || accountData?.holderClass || 'Unknown'} Account`
          });
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.log("Not logged in", error);
      }
    };

    checkLoginStatus();
  }, [isConnected, connectedAddress]);

  const handleDevLogin = async (accountType: MockAccountType) => {
    setIsLoggingIn(true);
    setStatusMessage(`Logging in as ${accountType}...`);

    try {
      const result = await devLogin(accountType);

      if (result.success) {
        setStatusMessage(`✅ Successfully logged in as ${result.account.displayName}!`);
        setCurrentAccount({
          address: result.account.walletAddress,
          holderClass: result.account.holderClass,
          balance: result.account.balance,
          votingPower: result.account.votingPower,
          rank: result.account.rank,
          displayName: result.account.displayName,
        });
        setIsLoggedIn(true);

        // Invalidate me query so nav updates immediately
        await qc.invalidateQueries({ queryKey: queryKeys.me });

        // Switch the mock account to the selected type
        (window as unknown as { switchDevMockAccount?: (t: MockAccountType) => boolean }).switchDevMockAccount?.(accountType);

        // Auto-connect wagmi to the mock wallet if not already connected
        if (!isConnected) {
          await autoConnect();
        }

        setStatusMessage(`✅ Connected and authenticated!`);
      }
    } catch (error) {
      console.error("Dev login failed:", error);
      setStatusMessage(`❌ Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setStatusMessage("Logging out...");
    
    try {
      // Call logout API
      await fetch('/api/v1/logout', { method: 'POST' });
      
      // Disconnect wallet if connected
      if (isConnected) {
        await disconnect();
      }
      
      setIsLoggedIn(false);
      setCurrentAccount(null);
      setStatusMessage("✅ Logged out successfully");
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Logout failed:", error);
      setStatusMessage("❌ Logout failed");
    }
  };

  const handleQuickTest = async (accountType: MockAccountType) => {
    setStatusMessage(`Quick testing as ${accountType}...`);
    await handleDevLogin(accountType);
  };

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  // Safe display helper for voting power - FIX: Add proper null/undefined checks
  const displayVotingPower = (vp: number | undefined | null) => {
    if (vp === undefined || vp === null) return "0";
    return vp.toLocaleString();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`w-96 transition-colors ${
        isLoggedIn 
          ? "border-green-500/30 bg-green-500/10" 
          : "border-blue-500/30 bg-blue-500/10"
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-gold" />
              <CardTitle className="text-sm">Dev Auth Panel</CardTitle>
              <Badge variant={isLoggedIn ? "default" : "outline"} className="text-xs">
                {isLoggedIn ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {!isExpanded && (
          <CardContent className="pt-2">
            <div className="text-xs text-muted-foreground">
              {!isLoggedIn ? (
                <p>Dev auth not active. Click to test different holder scenarios.</p>
              ) : (
                <p>
                  <span className="text-gold font-medium">{currentAccount?.displayName || "Unknown"}</span> - {displayVotingPower(currentAccount?.votingPower)} VP
                </p>
              )}
            </div>
          </CardContent>
        )}

        {isExpanded && (
          <CardContent className="space-y-4 pt-2">
            {/* Current Session Info */}
            {isLoggedIn && currentAccount && (
              <div className="space-y-2">
                <CardDescription className="text-xs">Current Session</CardDescription>
                <div className="rounded-lg border border-border bg-bg-elevated/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{currentAccount.displayName}</p>
                    <Badge variant="outline" className="text-xs">
                      {currentAccount.holderClass}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground line-clamp-1">
                    {currentAccount.address}
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-success">{displayVotingPower(currentAccount.votingPower)} VP</span>
                  </div>
                </div>
              </div>
            )}

            {/* Account Selection */}
            <div className="space-y-2">
              <CardDescription className="text-xs">
                {isLoggedIn ? "Switch Account" : "Select Account Type"}
              </CardDescription>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(mockAccounts).map(([type, account]) => (
                  <button
                    key={type}
                    onClick={() => handleDevLogin(type as MockAccountType)}
                    disabled={isLoggingIn}
                    className={`
                      rounded border border-border bg-bg-elevated/30 p-2 text-left transition-colors
                      hover:border-gold/50 hover:bg-gold/5 disabled:opacity-50 disabled:cursor-not-allowed
                      ${
                        currentAccount?.address === account.walletAddress
                          ? 'border-gold/50 bg-gold/10'
                          : ''
                      }
                    `}
                  >
                    <p className="text-sm font-medium">{account.displayName}</p>
                    <p className="text-xs text-text-dim">{account.balance} tokens</p>
                    <p className="text-xs text-text-dim">Rank #{account.rank}</p>
                    <Badge variant="outline" className="text-xs">
                      {account.holderClass}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {!isLoggedIn ? (
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    onClick={() => handleQuickTest('whale')}
                    disabled={isLoggingIn}
                    size="sm" 
                    variant="outline"
                    className="text-xs"
                  >
                    Whale
                  </Button>
                  <Button 
                    onClick={() => handleQuickTest('dolphin')}
                    disabled={isLoggingIn}
                    size="sm" 
                    variant="outline"
                    className="text-xs"
                  >
                    Dolphin
                  </Button>
                  <Button 
                    onClick={() => handleQuickTest('fish')}
                    disabled={isLoggingIn}
                    size="sm" 
                    variant="outline"
                    className="text-xs"
                  >
                    Fish
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleLogout} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Logout & Reset
                </Button>
              )}
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div className="rounded-lg bg-bg-elevated/50 p-2 text-center">
                <p className="text-xs text-muted-foreground">{statusMessage}</p>
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-purple-500 mb-1">Direct Development Auth</p>
                  <p className="mb-2">
                    This bypasses wallet connection issues and provides direct authentication for testing.
                  </p>
                  <p className="mb-2">
                    <strong>Benefits:</strong> No MetaMask conflicts, instant login, full governance access.
                  </p>
                  <p className="text-text-dim">
                    Click any account button to instantly authenticate and test the full application flow.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
