"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn, shortenAddress } from "@/lib/utils";

interface CopyAddressProps {
  address: string;
  /** Show the full address instead of a truncated one. */
  full?: boolean;
  className?: string;
}

/**
 * Inline wallet address display with a copy-to-clipboard button.
 * Renders a truncated (`0x1234…5678`) or full monospace address and a
 * check/copy icon toggle.
 */
export function CopyAddress({ address, full = false, className }: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context). No-op.
    }
  }, [address]);

  const display = full ? address : shortenAddress(address);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono text-sm text-foreground">{display}</span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Address copied" : "Copy address"}
        className="inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:w-6"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </span>
  );
}
