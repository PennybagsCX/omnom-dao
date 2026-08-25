"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi";
import { injected } from "wagmi/connectors";
import {
  CheckCircle2,
  Coins,
  Eye,
  FlaskConical,
  Ghost,
  HelpCircle,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  PartyPopper,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Wallet2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HolderBadge } from "@/components/shared/holder-badge";
import { buildSiweMessage } from "@/lib/siwe";
import { DEV_ADDRESS, isDevMockWalletActive } from "@/config/dev-mock-provider";
import { fetchApi } from "@/lib/api";
import { formatCompact, shortenAddress } from "@/lib/utils";
import { ErrorCode, type HolderClass } from "@/types";

type Phase =
  | "idle"
  | "fetching-nonce"
  | "awaiting-signature"
  | "verifying"
  | "success"
  | "not-in-snapshot"
  | "rejected"
  | "hardware-wallet-error"
  | "error";

interface VerifyResponseData {
  address: string;
  class: HolderClass;
  balanceRaw: string;
  balanceFormatted: string;
  rank: number;
  votingPower: number;
}

interface ConnectWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * OMNOM-branded wallet connection + SIWE verification dialog.
 *
 * Phases:
 *   idle → user is shown the wallet list (RainbowKit handles selection) and,
 *   once connected, the "Verify your holdings" sign prompt.
 *
 * The full pipeline (nonce → sign → verify → JWT cookie) is orchestrated here.
 * On success the dialog shows the holder result then redirects to `next`
 * (default `/verify/result`).
 */
export function ConnectWalletDialog({
  open,
  onOpenChange,
}: ConnectWalletDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Connect via the dev mock wallet's injected provider (dev only).
  const connectDevWallet = useCallback(() => {
    connect({ connector: injected() });
  }, [connect]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<VerifyResponseData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const startedRef = useRef(false);

  const nextPath = useMemo(
    () => searchParams.get("next") ?? "/verify/result",
    [searchParams],
  );

  // Reset when the dialog closes — state-during-render pattern to avoid
  // setState-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setPhase("idle");
      setResult(null);
      setErrorMsg("");
    }
  }

  // Reset the auth flow if the wallet disconnects mid-flow (C2.3), so the UI
  // doesn't get stuck in a signing/verifying phase with no connected account.
  const [prevConnected, setPrevConnected] = useState(isConnected);
  if (prevConnected !== isConnected) {
    setPrevConnected(isConnected);
    if (!isConnected) {
      setPhase("idle");
    }
  }

  /**
   * Full SIWE pipeline: nonce → sign → verify → success/error.
   *
   * Implemented as a useCallback so the auto-start effect and retry button
   * share a single, stable function identity. This replaced the previous
   * "latest-ref" pattern (useEffect with no dep-array reassigning a ref on
   * every render) which was fragile under React Compiler and could leave the
   * dialog stuck in the "verifying" phase.
   */
  const runVerify = useCallback(
    async (walletAddress: string) => {
      try {
        // 1. Fetch nonce.
        setPhase("fetching-nonce");
        const nonceRes = await fetchApi<{ nonce: string; issuedAt: string }>(
          "/api/v1/nonce",
          { method: "POST", body: { address: walletAddress } },
        );

        // 2. Build SIWE message + request signature.
        setPhase("awaiting-signature");
        const message = buildSiweMessage({
          address: walletAddress,
          nonce: nonceRes.nonce,
          issuedAt: nonceRes.issuedAt,
        });

        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch (signErr) {
          const err = signErr as {
            code?: number;
            message?: string;
            name?: string;
            shortMessage?: string;
          };
          const code = err.code;
          const errMsg = (
            err.shortMessage ||
            err.message ||
            ""
          ).toLowerCase();

          // ACTION REQUIRED patterns from Ledger / hardware wallets via
          // WalletConnect. The connector silently fails when the device is
          // locked, disconnected, or the WC session is invalid. We detect
          // the known error strings and show an actionable message.
          const isUserRejection =
            code === 4001 ||
            code === -32603 ||
            errMsg.includes("user rejected") ||
            errMsg.includes("rejected the request");

          const isHardwareIssue =
            // Ledger / hardware wallet specific
            errMsg.includes("ledger") ||
            errMsg.includes("device") ||
            errMsg.includes("not connected") ||
            errMsg.includes("disconnected") ||
            errMsg.includes("locked") ||
            errMsg.includes("no transport") ||
            errMsg.includes("transport") ||
            errMsg.includes("0x6700") || // Ledger: device locked
            errMsg.includes("0x6804") || // Ledger: cla not supported
            errMsg.includes("0x6a80") || // Ledger: data invalid
            errMsg.includes("6700") ||
            errMsg.includes("connection lost") ||
            errMsg.includes("session") ||
            // WalletConnect session errors
            errMsg.includes("matching key") ||
            errMsg.includes("no matching") ||
            errMsg.includes("proposal expired") ||
            errMsg.includes("relayer") ||
            errMsg.includes("timeout") ||
            errMsg.includes("timed out");

          if (isUserRejection && !isHardwareIssue) {
            setPhase("rejected");
            setErrorMsg(
              "You rejected the signature request. Try again when you're ready.",
            );
          } else if (isHardwareIssue) {
            console.error("[OMNOM] Hardware wallet signing error:", signErr);
            setPhase("hardware-wallet-error");
            setErrorMsg(
              "Your hardware wallet could not sign the message. " +
                "Make sure your device is connected, unlocked, and the " +
                "Ethereum app is open.",
            );
          } else {
            console.error("[OMNOM] Signature request failed:", signErr);
            setPhase("error");
            setErrorMsg("Signature request failed. Please try again.");
          }
          return;
        }

        // 3. Verify server-side (sets the httpOnly session cookie).
        setPhase("verifying");
        try {
          const data = await fetchApi<VerifyResponseData>("/api/v1/verify", {
            method: "POST",
            body: { message, signature },
          });
          setResult(data);
          setPhase("success");
        } catch (verifyErr) {
          const err = verifyErr as { code?: ErrorCode; message?: string };
          if (err.code === ErrorCode.NOT_IN_SNAPSHOT) {
            setPhase("not-in-snapshot");
          } else {
            setPhase("error");
            setErrorMsg(err.message ?? "Verification failed. Please try again.");
          }
        }
      } catch {
        setPhase("error");
        setErrorMsg("Something went wrong starting verification. Please try again.");
      }
    },
    [signMessageAsync],
  );

  // Reset the started guard when the dialog closes or wallet disconnects.
  useEffect(() => {
    if (!open || !isConnected) startedRef.current = false;
  }, [open, isConnected]);

  // Kick off the SIWE flow automatically once a wallet is connected inside
  // an open dialog.
  useEffect(() => {
    if (open && isConnected && address && phase === "idle" && !startedRef.current) {
      startedRef.current = true;
      void runVerify(address);
    }
  }, [open, isConnected, address, phase, runVerify]);

  const handleClose = useCallback(
    (openState: boolean) => {
      if (!openState) {
        // Terminal verification outcomes that cannot be retried directly
        // disconnect the wallet. Recoverable errors retain the connected wallet
        // so the user can retry or revisit verification from the account menu.
        if (
          isConnected &&
          (phase === "not-in-snapshot" || phase === "rejected")
        ) {
          disconnect();
        }
      }
      onOpenChange(openState);
    },
    [isConnected, phase, disconnect, onOpenChange],
  );

  const goToResult = useCallback(() => {
    handleClose(false);
    router.push(nextPath);
    router.refresh();
  }, [handleClose, router, nextPath]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md gap-0 overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        <VisuallyHiddenTitle />
        <div className="px-6 pb-2 pt-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gold">OMNOM</span><span className="text-foreground">DAO</span>
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-6 pb-6 pt-2"
          >
          <PhaseContent
            phase={phase}
            address={address}
            result={result}
            errorMsg={errorMsg}
            onRetry={() => address && void runVerify(address)}
            onContinue={goToResult}
            onDevConnect={connectDevWallet}
          />
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/* ── Phase content ───────────────────────────────────────────── */

function PhaseContent({
  phase,
  address,
  result,
  errorMsg,
  onRetry,
  onContinue,
  onDevConnect,
}: {
  phase: Phase;
  address: string | undefined;
  result: VerifyResponseData | null;
  errorMsg: string;
  onRetry: () => void;
  onContinue: () => void;
  onDevConnect: () => void;
}) {
  switch (phase) {
    case "idle":
      return <IdlePhase onDevConnect={onDevConnect} />;
    case "fetching-nonce":
    case "awaiting-signature":
    case "verifying":
      return (
        <LoadingPhase phase={phase} address={address} />
      );
    case "success":
      return <SuccessPhase result={result} onContinue={onContinue} />;
    case "not-in-snapshot":
      return <NotFoundPhase address={address} />;
    case "rejected":
      return <ErrorPhase title="Signature rejected" message={errorMsg} onRetry={onRetry} />;
    case "hardware-wallet-error":
      return <HardwareWalletErrorPhase message={errorMsg} onRetry={onRetry} />;
    case "error":
    default:
      return <ErrorPhase title="Verification failed" message={errorMsg} onRetry={onRetry} />;
  }
}

function IdlePhase({ onDevConnect }: { onDevConnect: () => void }) {
  // The active provider check also covers the enhanced mock wallet installation
  // flag set by the development mock-wallet module.
  const isDev = process.env.NODE_ENV === "development" && isDevMockWalletActive();
  
  return (
    <>
      <DialogTitle className="text-xl font-bold">Connect Your Wallet</DialogTitle>
      <DialogDescription className="mt-1 text-sm">
        Verify your $OMNOM holdings from the ever-held snapshots. It{"'"}s free —
        no gas, no transactions.
      </DialogDescription>

      {isDev && (
        <Button
          onClick={onDevConnect}
          className="mt-4 w-full gap-2 border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
          variant="outline"
          size="lg"
        >
          <FlaskConical className="h-4 w-4" aria-hidden />
          Connect Dev Wallet
          <span className="text-xs text-text-dim">
            ({DEV_ADDRESS.slice(0, 6)}…{DEV_ADDRESS.slice(-4)})
          </span>
        </Button>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <TrustBadge>
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden /> No gas fees
        </TrustBadge>
        <TrustBadge>
          <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Read-only
        </TrustBadge>
        <TrustBadge>
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> No token access
        </TrustBadge>
      </div>

      <ul className="mt-5 space-y-2.5">
        <WalletRow icon={<Wallet2 className="h-5 w-5 text-amber-500" />} name="MetaMask" />
        <WalletRow icon={<Link2 className="h-5 w-5 text-sky-500" />} name="WalletConnect" />
        <WalletRow icon={<Coins className="h-5 w-5 text-blue-500" />} name="Coinbase Wallet" />
        <WalletRow icon={<Ghost className="h-5 w-5 text-amber-400" />} name="Phantom" />
      </ul>
    </>
  );
}

function LoadingPhase({
  phase,
  address,
}: {
  phase: "fetching-nonce" | "awaiting-signature" | "verifying";
  address: string | undefined;
}) {
  const label =
    phase === "fetching-nonce"
      ? "Preparing verification…"
      : phase === "awaiting-signature"
        ? "Check your wallet to sign"
        : "Verifying your signature…";

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden />
      <div>
        <DialogTitle className="text-lg font-semibold">{label}</DialogTitle>
        <DialogDescription className="mt-1 text-sm">
          {address ? (
            <>
              Connected: <span className="font-mono">{shortenAddress(address)}</span>
            </>
          ) : (
            "Connecting your wallet…"
          )}
        </DialogDescription>
      </div>
    </div>
  );
}

function SuccessPhase({
  result,
  onContinue,
}: {
  result: VerifyResponseData | null;
  onContinue: () => void;
}) {
  if (!result) return null;
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
        <ShieldCheck className="h-9 w-9 text-success" aria-hidden />
      </div>
      <DialogTitle className="inline-flex items-center gap-2 text-xl font-bold text-success">
        You{"'"}re verified!
        <PartyPopper className="h-5 w-5" aria-hidden />
      </DialogTitle>
      <DialogDescription className="text-sm">
        Welcome to the $OMNOM DAO governance platform.
      </DialogDescription>

      <HolderBadge holderClass={result.class} size="lg" />

      <dl className="mt-2 w-full space-y-1.5 rounded-lg border border-border bg-bg-elevated/50 p-4 text-left text-sm">
        <Row label="Balance" value={`${formatCompact(result.balanceFormatted)} OMNOM`} />
        <Row label="Rank" value={`#${result.rank.toLocaleString()}`} />
        <Row label="Voting Power" value={formatCompact(result.votingPower)} />
      </dl>

      <Button onClick={onContinue} className="mt-2 w-full" size="lg">
        Continue
      </Button>
    </div>
  );
}

function NotFoundPhase({ address }: { address: string | undefined }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15">
        <HelpCircle className="h-9 w-9 text-warning" aria-hidden />
      </div>
      <DialogTitle className="text-xl font-bold">Address not in snapshot</DialogTitle>
      <DialogDescription className="text-sm">
        We couldn{"'"}t find this wallet in the ever-held snapshot corpus.
      </DialogDescription>

      <div className="mt-1 w-full rounded-lg border border-border bg-bg-elevated/50 p-4 text-left text-xs text-muted-foreground">
        {address && (
          <p className="mb-2">
            <span className="text-text-dim">Wallet:</span>{" "}
            <span className="font-mono text-foreground">{shortenAddress(address)}</span>
          </p>
        )}
        <ul className="list-inside list-disc space-y-1">
          <li>You may have acquired $OMNOM after the snapshot date.</li>
          <li>You might be using a different wallet address.</li>
          <li>Tokens held on an exchange may not be counted.</li>
        </ul>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => window.open("https://t.me/omnomtoken_dc", "_blank", "noopener")}
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> Get Help
        </Button>
      </div>
    </div>
  );
}

function HardwareWalletErrorPhase({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15">
        <ShieldAlert className="h-9 w-9 text-warning" aria-hidden />
      </div>
      <DialogTitle className="text-xl font-bold">
        Hardware wallet issue
      </DialogTitle>
      <DialogDescription className="text-sm">{message}</DialogDescription>
      <div className="mt-1 w-full space-y-2 rounded-lg border border-border bg-bg-elevated/50 p-4 text-left text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Troubleshooting:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Connect your device directly via USB (avoid USB hubs).</li>
          <li>Unlock the device and open the Ethereum app.</li>
          <li>Enable &quot;Blind Signing&quot; in the Ethereum app settings if prompted.</li>
          <li>If using Ledger Live, make sure &quot;WalletConnect&quot; is enabled in Settings.</li>
          <li>Try disconnecting and reconnecting your wallet.</li>
        </ul>
      </div>
      <Button onClick={onRetry} variant="outline" className="mt-1">
        Try again
      </Button>
    </div>
  );
}

function ErrorPhase({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
        <X className="h-9 w-9 text-danger" aria-hidden />
      </div>
      <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
      <DialogDescription className="text-sm">{message}</DialogDescription>
      <Button onClick={onRetry} variant="outline" className="mt-1">
        Try again
      </Button>
    </div>
  );
}

/* ── Small presentational helpers ────────────────────────────── */

function TrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function WalletRow({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated/40 px-3 py-2.5">
      <span aria-hidden className="flex h-6 w-6 items-center justify-center">
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground">{name}</span>
      <Wallet className="ml-auto h-4 w-4 text-text-dim" aria-hidden />
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** The visual header is custom; this satisfies Radix a11y requirements. */
function VisuallyHiddenTitle() {
  return (
    <DialogTitle className="sr-only">Connect your wallet to $OMNOM DAO</DialogTitle>
  );
}
