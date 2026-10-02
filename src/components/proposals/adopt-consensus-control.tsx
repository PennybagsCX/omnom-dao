"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiRequestError, fetchApi, queryKeys, useCurrentUser } from "@/lib/api";
import { isAdminAddress } from "@/lib/constants";
import { ProposalStatus, type Proposal } from "@/types";

/** Cooling-off between the intent declaration and the adoption (mirror of
 * the route's constant — the server is the enforcer, this is the UX). */
const INTENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Admin-only adoption control for the disclosed consensus fallback
 * (DOCS/REFERENDUM-WAVE1.md): when a proposal finalized EXPIRED — quorum not
 * met — the most-voted outcome can be adopted as the community's working
 * consensus, recorded transparently as quorum-missed. Renders nothing unless
 * the viewer is an admin AND the proposal is EXPIRED AND not yet adopted.
 *
 * Flow (guardrails shipped 2026-10-01):
 *   1. Announce intent — audited, starts a 24h cooling-off. Post the
 *      announcement on Telegram/X in the same breath; the timestamp here
 *      proves it.
 *   2. After 24h — "Adopt as working consensus…" unlocks. The server also
 *      requires the winning side to hold ≥60% of FOR+AGAINST and ≥100 unique
 *      voters; if the numbers fall short, an explicit "adopt anyway" (audited
 *      as an override, note required) is offered — the Wave 1 published terms
 *      promised a plain most-voted adoption.
 */
export function AdoptConsensusControl({ proposal }: { proposal: Proposal }) {
  const { data: me } = useCurrentUser({ retry: false });
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"intent" | "adopt" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(me && isAdminAddress(me.address));
  const alreadyAdopted = proposal.metadata?.adoptedAs === "consensus-fallback";

  if (!isAdmin || proposal.status !== ProposalStatus.EXPIRED || alreadyAdopted) {
    return null;
  }

  const declaredAt = proposal.metadata?.fallbackIntentDeclaredAt ?? null;
  const coolingOffEndsAt =
    declaredAt !== null ? Date.parse(declaredAt) + INTENT_COOLDOWN_MS : null;
  // The clock is read HERE, in the click handler — never during render
  // (react-hooks/purity: an impure read makes re-renders disagree). The
  // server re-checks this anyway; this is just the friendlier message.
  const coolingOffOver = () =>
    coolingOffEndsAt !== null && Date.now() >= coolingOffEndsAt;

  const forAgainst = proposal.votesFor + proposal.votesAgainst;
  const winShare = forAgainst > 0 ? proposal.votesFor / forAgainst : 0;
  const meetsShare = forAgainst > 0 && winShare >= 0.6;

  const call = async (body: Record<string, unknown>) => {
    await fetchApi(`/api/v1/proposals/${proposal.id}/adopt-consensus`, {
      method: "POST",
      body,
    });
    await qc.invalidateQueries({
      queryKey: queryKeys.proposalDetailPrefix(proposal.id),
    });
  };

  const declareIntent = async () => {
    setPending("intent");
    setError(null);
    try {
      await call({ declareIntent: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Declaration failed.");
    } finally {
      setPending(null);
    }
  };

  const adopt = async (force: boolean) => {
    setPending("adopt");
    setError(null);
    try {
      const note =
        force
          ? `Owner override of fallback guardrails — published terms for this vote promised a plain most-voted adoption. (winShare ${(winShare * 100).toFixed(1)}%, voters ${proposal.votesFor + proposal.votesAgainst > 0 ? "see tallies" : "0"})`
          : undefined;
      await call({ ...(force ? { force: true, note } : {}) });
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Adoption failed.");
    } finally {
      setPending(null);
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

      {!declaredAt ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-text-dim">
            Step 1 of 2 — announce the intent. This records a public, audited
            declaration and starts a 24-hour cooling-off. Post the announcement
            on Telegram/X now; adoption unlocks 24 hours from this click.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={declareIntent}
              disabled={pending !== null}
            >
              {pending === "intent" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Megaphone className="h-4 w-4" aria-hidden />
              )}
              Announce fallback intent
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-xs leading-relaxed text-text-dim">
            Step 2 of 2 — intent declared{" "}
            {new Date(declaredAt).toLocaleString()}; adoption unlocks 24 hours
            after (≈{" "}
            {coolingOffEndsAt !== null
              ? new Date(coolingOffEndsAt).toLocaleString()
              : ""}
            ). Adoption also prefers the winning side to hold ≥60% of
            FOR+AGAINST with ≥100 unique voters; this vote currently shows{" "}
            {(winShare * 100).toFixed(1)}%
            {forAgainst > 0 ? "" : " of a zero FOR+AGAINST base"}. Falling short
            is allowed with an explicitly audited override, since these terms
            were published before the guardrails existed.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <Button
                  size="sm"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => adopt(!meetsShare)}
                  disabled={pending !== null}
                >
                  {pending === "adopt" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Scale className="h-4 w-4" aria-hidden />
                  )}
                  Confirm adoption{!meetsShare ? " (audited override)" : ""}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 sm:min-h-9"
                  onClick={() => setConfirming(false)}
                  disabled={pending !== null}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-9"
                onClick={() => {
                  if (!coolingOffOver()) {
                    setError(
                      coolingOffEndsAt !== null
                        ? `Cooling-off is active until ${new Date(
                            coolingOffEndsAt,
                          ).toLocaleString()} — adoption unlocks 24 hours after the public declaration.`
                        : "Cooling-off state unavailable — refresh and try again.",
                    );
                    return;
                  }
                  setError(null);
                  setConfirming(true);
                }}
              >
                <Scale className="h-4 w-4" aria-hidden /> Adopt as working consensus…
              </Button>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
