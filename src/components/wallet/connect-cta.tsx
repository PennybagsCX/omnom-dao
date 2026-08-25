"use client";

import { Wallet } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useWalletDialog } from "@/components/wallet/siwe-auth-flow";

/**
 * CTA button that triggers the connect → SIWE verify flow.
 * Uses the shared wallet dialog context. Render anywhere a "Connect Wallet"
 * action is needed outside the header.
 */
export function ConnectCta({ children, ...props }: ButtonProps) {
  const { connect } = useWalletDialog();
  return (
    <Button type="button" onClick={connect} {...props}>
      <Wallet className="h-4 w-4" aria-hidden />
      {children ?? "Connect Wallet"}
    </Button>
  );
}
