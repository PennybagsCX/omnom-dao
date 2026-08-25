/**
 * Simple Dev Login Component
 * 
 * This provides a straightforward way to authenticate with dev accounts
 * for testing purposes. It creates JWT sessions and updates the UI properly.
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/api";

const DEV_ACCOUNTS = {
  whale: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    name: "Whale 🐋",
    description: "1M voting power",
  },
  dolphin: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
    name: "Dolphin 🐬",
    description: "15K voting power",
  },
  fish: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    name: "Fish 🐟",
    description: "100 voting power",
  },
};

export function SimpleDevLogin() {
  const [loading, setLoading] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleLogin = async (type: keyof typeof DEV_ACCOUNTS) => {
    setLoading(type);
    try {
      const account = DEV_ACCOUNTS[type];
      
      const response = await fetch('/api/v1/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletAddress: account.address,
          holderClass: type.toUpperCase(),
          votingPower: type === 'whale' ? 1000000 : type === 'dolphin' ? 15000 : 100,
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Logged in as ${account.name}`);
        // Force refresh of user data
        qc.invalidateQueries({ queryKey: queryKeys.me });
      } else {
        toast.error(data.error?.message || 'Login failed');
      }
    } catch (error) {
      toast.error('Login failed: ' + (error as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Dev Login</h3>
        <p className="text-xs text-muted-foreground">Test with mock accounts</p>
      </div>
      
      {Object.entries(DEV_ACCOUNTS).map(([type, account]) => (
        <Button
          key={type}
          onClick={() => handleLogin(type as keyof typeof DEV_ACCOUNTS)}
          disabled={loading !== null}
          size="sm"
          variant="outline"
          className="w-full justify-between"
        >
          <span>{account.name}</span>
          <span className="text-xs text-muted-foreground">{account.description}</span>
        </Button>
      ))}
    </Card>
  );
}
