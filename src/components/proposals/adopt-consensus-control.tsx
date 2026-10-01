"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, fetchApi, queryKeys, useCurrentUser } from "@/lib/api";
import { isAdminAddress } from "@/lib/constants";
import { ProposalStatus, type Proposal } from "@/types";

/**
 * Admin-only adoption control for the disclosed consensus fallback
 * (DOCS/REFERENDUM-WAVE1.md): when a proposal finalized EXPIRED — quorum not
 * met — the most-voted outcome is still adopted as the community's working
 * consensus, recorded transparently as quorum-missed. Renders nothing unless
 * the viewer is an admin AND the proposal is EXPIRED AND not yet adopted;
 * adoption flips it to EXECUTED with `adoptedAs: "consensus-fallback"`
 * metadata (server: POST /api/v1/proposals/[id]/adopt-consensus) and the
 * gold ConsensusFallbackBanner takes over the detail page.
 *
 * Two-step confirm: this is a governance act, not a toggle.
 */
export function AdoptConsensusControl({ proposal }: { proposal: Proposal }) {
  const { data: me } = useCurrentUser({ retry: false });
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(me && isAdminAddress(me.address));
  const alreadyAdopted = proposal.metadata?.adoptedAs === "consensus-fallback";

  if (!isAdmin || proposal.status !== ProposalStatus.EXPIRED || alreadyAdopted) {
    return null;
  }

  const adopt = async () => {
    setPending(true);
    setError(null);
    try {
      await fetchApi(`/api/v1/proposals/${proposal.id}/adopt-consensus`, {
        method: "POST",
        body: {},
      });
      await qc.invalidateQueries({
        queryKey: queryKeys.proposalDetail(proposal.id),
      });
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Adoption failed.");
    } finally {
      setPending(false);
    }
  };

  const forLeads = proposal.votesFor > proposal.votesAgainst;
  const outcome = forLeads
    ? "FOR"
    : proposal.votesAgainst > proposal.votesFor
      ? "AGAINST"
      : "AGAINST (tie — deterministic fallback)";

  return (
    <div
      className="rounded-xl border border-gold/30 bg-gold/5 p-4"
      data-testid="adopt-consensus-control"
    >
      <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gold">
        <Scale className="h-3.5 w-3.5" aria-hidden /> Quorum missed — consensus fallback
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        This vote closed below quorum. Per the rule{" "}
        <a
          href="https://github.com/PennybagsCX/omnom-dao/blob/main/DOCS/REFERENDUM-WAVE1.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold underline-offset-2 hover:underline"
        >
          disclosed before the vote
        </a>
        , the most-voted outcome can be adopted as the community&apos;s working
        consensus — recorded openly as quorum-missed and re-confirmed in a later
        ratification vote. Current leader:{" "}
        <span className="font-medium text-foreground">
          {outcome} ({proposal.votesFor.toLocaleString()} FOR ·{" "}
          {proposal.votesAgainst.toLocaleString()} AGAINST · turnout{" "}
          {(proposal.quorumAchieved ?? 0).toFixed(2)}% of {proposal.quorumRequired}%)
        </span>
        .
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={adopt}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Scale className="h-4 w-4" aria-hidden />
              )}
              Confirm adoption
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => setConfirming(true)}
          >
            <Scale className="h-4 w-4" aria-hidden /> Adopt as working consensus…
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
