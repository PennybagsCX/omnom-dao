"use client";

import { Scale } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, shortenAddress } from "@/lib/utils";
import { ProposalStatus, type Proposal } from "@/types";

interface ConsensusFallbackBannerProps {
  proposal: Proposal;
}

/**
 * Consensus-fallback transparency banner (REFERENDUM-WAVE1.md §3).
 *
 * Renders on EXECUTED proposals whose quorum-missed outcome was adopted as
 * the community's working consensus (metadata.adoptedAs ===
 * "consensus-fallback"). Deliberately NOT the green "Outcome Recorded" tone:
 * the disclosure is that quorum was missed and the result is a working
 * consensus pending re-confirmation, not a ratified pass.
 */
export function ConsensusFallbackBanner({ proposal }: ConsensusFallbackBannerProps) {
  const meta = proposal.metadata;
  if (proposal.status !== ProposalStatus.EXECUTED || meta?.adoptedAs !== "consensus-fallback") {
    return null;
  }

  const adoptedOutcome = meta.adoptedOutcome;
  const adoptedBy = meta.adoptedBy;
  const adoptedAt = meta.adoptedAt;
  const note = meta.adoptionNote;

  return (
    <Card className="border-gold/30 bg-gold/10">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0">
          <Scale className="h-5 w-5 text-gold" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Adopted as working consensus (quorum fallback)
            </h3>
            <div className="flex items-center gap-1.5 rounded-full bg-gold/20 px-2 py-0.5">
              <Scale className="h-3 w-3 text-gold" aria-hidden />
              <span className="text-xs font-medium text-gold">Quorum missed</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Quorum was not reached, so this is not a ratified pass. The most-voted
            outcome ({adoptedOutcome === "AGAINST" ? "Against" : "For"}:
            {" "}
            {proposal.votesFor.toLocaleString()} For ·{" "}
            {proposal.votesAgainst.toLocaleString()} Against) was adopted as the
            community&apos;s working consensus
            {proposal.quorumAchieved != null
              ? ` — turnout ${proposal.quorumAchieved.toFixed(1)}% of the ${proposal.quorumRequired}% required`
              : ""}
            . Re-confirmation is planned as turnout grows.
          </p>
          {note && (
            <p className="mt-2 text-sm text-muted-foreground">{note}</p>
          )}
          {(adoptedBy || adoptedAt) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
              {adoptedBy && (
                <span className="inline-flex items-center gap-1">
                  <span>Adopted by</span>
                  <span className="font-mono text-muted-foreground">
                    {shortenAddress(adoptedBy)}
                  </span>
                </span>
              )}
              {adoptedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>•</span>
                  <span>{formatDateTime(adoptedAt)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
