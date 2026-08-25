"use client";

import { XCircle, ShieldAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { shortenAddress, timeAgo } from "@/lib/utils";
import type { Proposal } from "@/types";

interface AdminRejectionBannerProps {
  proposal: Proposal;
}

/**
 * Rejection transparency banner.
 *
 * Displays on rejected proposals showing:
 * - The reason for rejection (required)
 * - Who rejected it (admin/moderator address)
 * - When it was rejected (relative time)
 *
 * Only renders when proposal.status is FAILED and metadata contains
 * rejectionReason (reject route enforces this, so all rejected proposals
 * should have it).
 */
export function AdminRejectionBanner({ proposal }: AdminRejectionBannerProps) {
  const rejectionReason = proposal.metadata?.rejectionReason;
  const rejectedBy = proposal.metadata?.rejectedBy;
  const rejectedAt = proposal.metadata?.rejectedAt;

  // Only show if we have a rejection reason
  if (!rejectionReason) return null;

  return (
    <Card className="border-danger/30 bg-danger/10">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0">
          <ShieldAlert className="h-5 w-5 text-danger" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Proposal Rejected
            </h3>
            <div className="flex items-center gap-1.5 rounded-full bg-danger/20 px-2 py-0.5">
              <XCircle className="h-3 w-3 text-danger" aria-hidden />
              <span className="text-xs font-medium text-danger">Failed</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {rejectionReason}
          </p>
          {(rejectedBy || rejectedAt) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
              {rejectedBy && (
                <span className="inline-flex items-center gap-1">
                  <span>Rejected by</span>
                  <span className="font-mono text-muted-foreground">
                    {shortenAddress(rejectedBy)}
                  </span>
                </span>
              )}
              {rejectedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>•</span>
                  <span>{timeAgo(rejectedAt)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
