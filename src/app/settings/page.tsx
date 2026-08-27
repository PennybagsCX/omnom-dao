"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyAddress } from "@/components/shared/copy-address";
import { DelegationCard } from "@/components/shared/delegation-card";
import { EmptyState } from "@/components/shared/empty-state";
import { HolderBadge } from "@/components/shared/holder-badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ConnectCta } from "@/components/wallet/connect-cta";
import {
  useCurrentUser,
  useUpdateSettings,
  type MeData,
} from "@/lib/api";
import {
  useCreateDelegation,
  useDelegation,
  useRevokeDelegation,
} from "@/lib/delegation-api";
import { formatDate, isValidAddress } from "@/lib/utils";
import { HOLDER_CLASS_CONFIG } from "@/lib/constants";
import { DelegationStatus } from "@/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Notification toggle row configuration. */
const NOTIFICATION_ROWS: {
  key: keyof MeData["settings"]["notifications"];
  label: string;
  description: string;
}[] = [
  { key: "proposalCreated", label: "Proposal created", description: "When a new proposal is submitted." },
  { key: "votingStarted", label: "Voting started", description: "When a proposal enters its voting period." },
  { key: "votingEndingSoon", label: "Ending soon (<24h)", description: "24 hours before voting closes." },
  { key: "proposalResult", label: "Result notifications", description: "When a proposal's outcome is finalized." },
  { key: "mention", label: "Mentions", description: "When someone mentions you in a comment." },
];

/**
 * Settings page (DESIGN.md §7.8, UI-WIREFRAMES.md §12).
 *
 * Unauthenticated users see a "Connect Wallet" CTA. Authenticated users manage
 * their connected wallet info, display name, notification preferences (with
 * channel toggles), delegation, and a danger-zone deletion dialog.
 */
export default function SettingsPage() {
  const { data: me, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingSkeleton variant="dashboard" />
      </div>
    );
  }

  if (isError || !me) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Lock className="h-12 w-12" />}
          title="Authentication required"
          description="Connect and verify your wallet to manage your settings."
          action={<ConnectCta>Connect Wallet</ConnectCta>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="space-y-6"
      >
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, notifications, and account.
          </p>
        </header>

        <WalletSection me={me} />
        <ProfileSection me={me} />
        <DelegationSection me={me} />
        <NotificationsSection me={me} />
        <DangerZone />
      </motion.div>
    </div>
  );
}

/* ── Connected wallet ─────────────────────────────────────────── */

function WalletSection({ me }: { me: MeData }) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          <Wallet className="h-4 w-4" aria-hidden /> Connected Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-elevated/40 p-3 sm:flex-row">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/10 text-lg">
            {HOLDER_CLASS_CONFIG[me.class].emoji}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden text-center">
            <CopyAddress address={me.address} full />
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-text-dim">
              <HolderBadge holderClass={me.class} size="sm" plain />
              <span>·</span>
              <span>Member since {formatDate(me.createdAt)}</span>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-text-dim">
          Only one wallet can be connected at a time. Disconnecting clears your
          session but does not remove your on-chain snapshot balance.
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Display name ─────────────────────────────────────────────── */

function ProfileSection({ me }: { me: MeData }) {
  const updateSettings = useUpdateSettings();
  const [name, setName] = useState(me.displayName);
  const [prevDisplayName, setPrevDisplayName] = useState(me.displayName);

  // Re-sync when the server value changes — during render to avoid
  // setState-in-effect cascading renders.
  if (me.displayName !== prevDisplayName) {
    setPrevDisplayName(me.displayName);
    setName(me.displayName);
  }

  const dirty = name.trim() !== me.displayName && name.trim().length > 0;

  const onSave = () => {
    updateSettings.mutate({ displayName: name.trim().slice(0, 32) });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-center">
            <Label htmlFor="display-name">Display name</Label>
            <span className="text-xs text-text-dim">{name.length}/32</span>
          </div>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            placeholder="Choose a display name"
            maxLength={32}
            className="text-center"
          />
          <p className="text-center text-xs text-text-dim">
            Shown next to your comments and proposals instead of your address.
          </p>
        </div>
        <div className="flex justify-center">
          <Button onClick={onSave} disabled={!dirty || updateSettings.isPending} size="sm">
            {updateSettings.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Delegation ───────────────────────────────────────────────── */

function DelegationSection({ me }: { me: MeData }) {
  const { data: delegation, isLoading } = useDelegation(me.address);
  const createDelegation = useCreateDelegation();
  const revokeDelegation = useRevokeDelegation();

  const [address, setAddress] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const outgoing = delegation?.outgoing ?? null;
  const incomingCount = delegation?.incomingCount ?? 0;

  const trimmed = address.trim();
  const addressValid = isValidAddress(trimmed);
  const selfDelegation =
    trimmed.length > 0 &&
    trimmed.toLowerCase() === me.address.toLowerCase();

  const canSubmit = addressValid && !selfDelegation;

  const onConfirm = () => {
    createDelegation.mutate(
      { delegateeAddress: trimmed },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setAddress("");
        },
      },
    );
  };

  const onRevoke = () => {
    revokeDelegation.mutate();
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          <ArrowLeftRight className="h-4 w-4" aria-hidden /> Delegation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-xs text-text-dim">
          Delegate 100% of your voting power to another holder. It takes effect
          after a 24-hour time-lock. You can still vote directly to override a
          delegation at any time.
        </p>

        {/* Outgoing delegation state */}
        {isLoading ? (
          <div className="h-24 rounded-lg border border-border bg-bg-elevated/40 skeleton-shimmer" aria-hidden />
        ) : outgoing &&
          (outgoing.status === DelegationStatus.ACTIVE ||
            outgoing.status === DelegationStatus.PENDING) ? (
          <DelegationCard
            delegation={outgoing}
            votingPower={me.votingPower}
            delegatorClass={me.class}
            delegateeClass={outgoing.delegateeClass ?? undefined}
            currentAddress={me.address}
            onRevoke={onRevoke}
            revoking={revokeDelegation.isPending}
          />
        ) : (
          <div className="space-y-2">
            <div className="text-center">
              <Label htmlFor="delegatee-address">Delegate to address</Label>
            </div>
            <Input
              id="delegatee-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… (Ethereum address)"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="text-center"
              aria-invalid={trimmed.length > 0 && !canSubmit}
              aria-describedby={
                trimmed.length > 0 ? "delegatee-help" : undefined
              }
            />
            {trimmed.length > 0 && !addressValid && (
              <p id="delegatee-help" className="text-center text-xs text-danger">
                Enter a valid Ethereum address (0x + 40 hex characters).
              </p>
            )}
            {selfDelegation && (
              <p id="delegatee-help" className="text-center text-xs text-danger">
                You cannot delegate to yourself.
              </p>
            )}
            <div className="flex justify-center">
              <Button
                disabled={!canSubmit || createDelegation.isPending}
                onClick={() => setConfirmOpen(true)}
                size="sm"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                Delegate
              </Button>
            </div>
          </div>
        )}

        {/* Incoming delegations summary */}
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-bg-elevated/30 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">
            Incoming delegations
          </span>
          <span className="font-mono text-sm font-medium text-foreground">
            {incomingCount}{" "}
            {incomingCount === 1 ? "holder" : "holders"} delegated to you
          </span>
        </div>

        {/* Confirmation dialog */}
        <Dialog
          open={confirmOpen}
          onOpenChange={(o) => {
            setConfirmOpen(o);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-gold" aria-hidden />
                Confirm delegation
              </DialogTitle>
              <DialogDescription>
                You are delegating 100% of your voting power to{" "}
                <span className="font-mono text-foreground">
                  {trimmed}
                </span>
                . This will take effect in 24 hours.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-amber-200/90">
                Before you confirm:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Your delegatee represents your voting power.</li>
                <li>You can revoke this delegation instantly at any time.</li>
                <li>Voting directly overrides your delegation.</li>
              </ul>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={createDelegation.isPending}
              >
                {createDelegation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowLeftRight className="h-4 w-4" aria-hidden />
                )}
                Confirm Delegation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ── Notifications ────────────────────────────────────────────── */

function NotificationsSection({ me }: { me: MeData }) {
  const updateSettings = useUpdateSettings();
  const [prefs, setPrefs] = useState(me.settings.notifications);
  const [prevNotifs, setPrevNotifs] = useState(me.settings.notifications);

  // Re-sync when the server value changes — during render to avoid
  // setState-in-effect cascading renders.
  if (me.settings.notifications !== prevNotifs) {
    setPrevNotifs(me.settings.notifications);
    setPrefs(me.settings.notifications);
  }

  const dirty = JSON.stringify(prefs) !== JSON.stringify(me.settings.notifications);

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const onSave = () => {
    updateSettings.mutate({
      notifications: prefs,
    });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          <Bell className="h-4 w-4" aria-hidden /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Notification type toggles */}
        <div className="divide-y divide-border">
          {NOTIFICATION_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-text-dim">{row.description}</p>
              </div>
              <Switch
                checked={prefs[row.key]}
                onCheckedChange={() => togglePref(row.key)}
                aria-label={`${row.label} notifications`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button onClick={onSave} disabled={!dirty || updateSettings.isPending} size="sm">
            {updateSettings.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Danger zone ──────────────────────────────────────────────── */

function DangerZone() {
  return (
    <Card className="border-rose-600/30">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base text-rose-300">
          <ShieldAlert className="h-4 w-4" aria-hidden /> Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-rose-600/20 bg-rose-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-center sm:text-left">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground sm:justify-start">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden />
              Delete account
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Removes your display name and settings. Your vote history is
              preserved on-chain (immutable). You can reconnect your wallet at any
              time.
            </p>
          </div>
          <div className="flex justify-center">
            <DeleteAccountDialog />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canConfirm = typed.trim().toUpperCase() === "DELETE";

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) setTyped("");
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden /> Confirm account deletion
          </DialogTitle>
          <DialogDescription>
            This will permanently remove your display name and notification
            preferences from the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-amber-200/90">What gets deleted:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Display name</li>
            <li>Notification preferences</li>
            <li>Session data</li>
          </ul>
          <p className="mt-2 font-medium text-amber-200/90">What is preserved:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Vote history (immutable, on the snapshot)</li>
            <li>Proposals you authored (community record)</li>
            <li>Your wallet can reconnect at any time</li>
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono text-rose-300">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || deleting}
            onClick={async () => {
              try {
                setDeleting(true);
                await fetch("/api/v1/settings", { method: "DELETE" });
              } catch {
                // Best-effort; proceed to sign out regardless.
              } finally {
                window.location.href = "/api/v1/logout";
              }
            }}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Delete Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
