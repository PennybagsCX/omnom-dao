"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  ShieldCheck,
  ShieldX,
  X,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DevLoginButton } from "@/components/admin/dev-login-button";
import { Card, CardContent } from "@/components/ui/card";
import { ProposalTypeBadge } from "@/components/shared/proposal-type-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Markdown } from "@/components/shared/markdown";
import { apiGet, fetchApi, useCurrentUser } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";
import type { Proposal } from "@/types";

interface PendingResponse {
  proposals: Proposal[];
}

interface ElectionAdminData {
  electionKey: string;
  title: string;
  phase: "UPCOMING" | "OPEN" | "CLOSED";
  startsAt: string;
  endsAt: string;
  snapshotCommit: string;
  snapshotFile: string;
  snapshotFileSha256: string;
  eligibleWalletCount: number;
  totalBallots: number;
  turnoutPercentage: number;
  results: Array<{
    choice: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  auditReport: string;
  limitations: string[];
}

export default function AdminPage() {
  const { data: me } = useCurrentUser({ retry: false });
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<PendingResponse>({
    queryKey: ["admin", "pending"],
    queryFn: ({ signal }) => apiGet<PendingResponse>("/api/v1/admin/proposals/pending", undefined, signal),
    enabled: !!me,
  });

  const { data: election, isLoading: electionLoading } = useQuery<ElectionAdminData>({
    queryKey: ["admin", "election"],
    queryFn: ({ signal }) => apiGet<ElectionAdminData>("/api/v1/admin/election", undefined, signal),
    enabled: !!me,
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ proposal: Proposal }>(`/api/v1/proposals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pending"] });
      setActionError(null);
    },
    onError: (error: { message?: string }) => {
      console.error("Approve error:", error);
      setActionError(error.message || "Failed to approve proposal. Please ensure you're authenticated as an admin.");
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchApi(`/api/v1/proposals/${id}/reject`, { method: "POST", body: { reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pending"] });
      setRejectingId(null);
      setRejectReason("");
      setActionError(null);
    },
    onError: (error: { message?: string }) => {
      console.error("Reject error:", error);
      setActionError(error.message || "Failed to reject proposal. Please ensure you're authenticated as an admin.");
    },
  });

  const handleApprove = useCallback((id: string) => {
    setActionError(null);
    approve.mutate(id);
  }, [approve]);

  const handleReject = useCallback(
    (id: string) => {
      if (!rejectReason.trim()) return;
      setActionError(null);
      reject.mutate({ id, reason: rejectReason.trim() });
    },
    [reject, rejectReason],
  );

  if (!me) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<ShieldX className="h-12 w-12" />}
          title="Admin access required"
          description="Connect the configured admin wallet to access this panel."
        />
      </div>
    );
  }

  // Error loading pending proposals — surface a retryable error state instead
  // of rendering an empty queue that masquerades as "All caught up!".
  if (isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<AlertTriangle className="h-12 w-12" />}
          title="Failed to load proposals"
          description="We couldn't reach the proposal service. Please try again."
          action={
            <Button onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? "Retrying…" : "Retry"}
            </Button>
          }
        />
      </div>
    );
  }

  const proposals = data?.proposals ?? [];
  const maxCount = Math.max(...(election?.results.map((r) => r.count) ?? [0]), 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <DevLoginButton />
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <ShieldCheck className="h-6 w-6 text-gold" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Admin Operations</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Moderate proposals and monitor the foundational governance election.
        </p>
      </div>

      {/* Global error display */}
      {actionError && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Action Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">{actionError}</p>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Card className="mb-8">
        <CardContent className="p-5">
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CalendarClock className="h-4 w-4 text-gold" aria-hidden />
              {election?.title ?? "Foundational Governance Election"}
            </h2>
            <p className="text-xs text-text-dim">
              {election ? `${election.phase} · closes ${new Date(election.endsAt).toLocaleString()}` : "Loading…"}
            </p>
          </div>

          {electionLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gold" aria-hidden />
            </div>
          ) : election ? (
            <>
              <div className="mt-4 grid gap-3 text-center sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-bg-elevated/30 p-3">
                  <div className="font-mono text-xl font-bold text-foreground">
                    {election.totalBallots.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">ballots cast</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-elevated/30 p-3">
                  <div className="font-mono text-xl font-bold text-foreground">
                    {election.turnoutPercentage.toFixed(1)}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">turnout</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-elevated/30 p-3">
                  <div className="font-mono text-xl font-bold text-foreground">
                    {election.eligibleWalletCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-text-dim">eligible wallets</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {election.results.map((r) => (
                  <div key={r.choice} className="text-left">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{r.label}</span>
                      <span className="font-mono text-text-dim">
                        {r.count.toLocaleString()} · {r.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href="/api/v1/admin/election?export=eligibility">
                    <Download className="h-4 w-4" aria-hidden />
                    Eligibility CSV
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="/api/v1/admin/election?export=ballots">
                    <Download className="h-4 w-4" aria-hidden />
                    Ballot + change audit CSV
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="/api/v1/admin/election?export=events">
                    <Download className="h-4 w-4" aria-hidden />
                    Ballot event history CSV
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/governance-vote">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Public election page
                  </Link>
                </Button>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-bg-deep/40 p-3 text-left text-xs text-muted-foreground">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                  <FileSearch className="h-3.5 w-3.5 text-gold" aria-hidden />
                  Snapshot integrity & audit
                </div>
                <div className="space-y-0.5 font-mono">
                  <div>source: {election.snapshotFile}</div>
                  <div>commit: {election.snapshotCommit}</div>
                  <div>sha256: {election.snapshotFileSha256}</div>
                </div>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {election.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-4 text-center">
        <h2 className="text-xl font-bold text-foreground">Moderation Queue</h2>
        <p className="text-sm text-muted-foreground">
          Review and approve pending proposals before they go to a vote.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden />
        </div>
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={<Check className="h-12 w-12 text-success" />}
          title="All caught up!"
          description="No proposals are waiting for review."
        />
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <ProposalTypeBadge type={p.type} />
                      <span className="text-xs text-text-dim">by {shortenAddress(p.authorAddress)}</span>
                      <span className="flex items-center gap-1 text-xs text-text-dim">
                        <Clock className="h-3 w-3" aria-hidden />
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground text-center">{p.title}</h3>
                  </div>
                </div>

                <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-deep/40 p-3">
                  <Markdown>{p.description}</Markdown>
                </div>

                {p.metadata?.tags && p.metadata.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
                    {p.metadata.tags.map((tag: string) => (
                      <span key={tag} className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {rejectingId === p.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (required)…"
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-lg border border-border bg-transparent p-3 text-sm outline-none placeholder:text-text-dim focus:border-danger/50"
                    />
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleReject(p.id)} disabled={!rejectReason.trim() || reject.isPending}>
                        {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                        Confirm Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={() => handleApprove(p.id)} disabled={approve.isPending}>
                      {approve.isPending && approve.variables === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                      )}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectingId(p.id)}>
                      <X className="h-4 w-4" aria-hidden /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/proposals/${p.id}`}>
                        <ExternalLink className="h-4 w-4" aria-hidden /> View
                      </Link>
                    </Button>
                  </div>
                )}

                {(approve.isError && approve.variables === p.id) || (reject.isError && rejectingId === p.id) ? (
                  <p className="mt-2 text-sm text-danger">
                    {actionError || "An error occurred while processing this action. Please try again."}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
