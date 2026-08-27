"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Database,
  HelpCircle,
  Loader2,
  Vote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { apiGet, fetchApi, useCurrentUser } from "@/lib/api";
import { type ElectionChoice } from "@/lib/election";
import { ELECTION_EXPLANATIONS, ELECTION_FAQ } from "@/lib/election-explanations";
import { cn } from "@/lib/utils";

interface ElectionChoiceResult {
  choice: ElectionChoice;
  label: string;
  count: number;
  percentage: number;
}

interface ElectionData {
  electionKey: string;
  title: string;
  phase: "UPCOMING" | "OPEN" | "CLOSED";
  startsAt: string;
  endsAt: string;
  eligibleWalletCount: number;
  totalBallots: number;
  turnoutPercentage: number;
  results: ElectionChoiceResult[];
  userChoice: ElectionChoice | null;
  userEligible: boolean;
}

const CHOICE_COLORS: Record<ElectionChoice, string> = {
  QUADRATIC: "bg-gold",
  ONE_WALLET_ONE_VOTE: "bg-blue-500",
  TIERED: "bg-emerald-500",
  LINEAR: "bg-zinc-500",
};

const EASE = [0.22, 1, 0.36, 1] as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function GovernanceVotePage() {
  const { data: me } = useCurrentUser({ retry: false });
  const qc = useQueryClient();
  const queryKey = ["governance-vote", Boolean(me)];

  const { data, isLoading } = useQuery<ElectionData>({
    queryKey,
    queryFn: ({ signal }) =>
      apiGet<ElectionData>(
        "/api/v1/governance-vote",
        me ? { me: "true" } : undefined,
        signal,
      ),
    refetchInterval: 15_000,
  });

  const castVote = useMutation({
    mutationFn: (choice: ElectionChoice) =>
      fetchApi<ElectionData>("/api/v1/governance-vote", {
        method: "POST",
        body: { choice },
      }),
    onSuccess: (newData) => {
      qc.setQueryData(queryKey, newData);
    },
  });

  const handleVote = (choice: ElectionChoice) => {
    if (!data?.userEligible) return;
    if (data.phase !== "OPEN") return;
    castVote.mutate(choice);
  };

  // Loading state — H1 is rendered here so SSR/SEO crawlers see the page title
  // before the React Query client-side hydration completes.
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Foundational Governance Election
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Decide how future OMNOMDAO proposals should be counted. Every wallet in
          the verified ever-held snapshot gets one ballot, changeable until close.
        </p>
        <div className="mt-8 flex items-center justify-center" aria-live="polite" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <span className="sr-only">Loading election data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header - Centered on all breakpoints */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="text-center"
      >
        <div className="mb-2 flex flex-col items-center justify-center gap-2">
          <Vote className="h-6 w-6 text-gold" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {data?.title ?? "Foundational Governance Election"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Decide how future OMNOMDAO proposals should be counted. Every wallet in
          the verified ever-held snapshot gets one ballot, changeable until close.
        </p>
      </motion.div>

      {/* Stats - Centered on all breakpoints */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        className="mt-6 grid gap-3 rounded-xl border border-border bg-bg-elevated/40 p-4 text-center sm:grid-cols-3"
      >
        <div>
          <div className="font-mono text-lg font-bold text-foreground">
            {(data?.totalBallots ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">Ballots cast</div>
        </div>
        <div>
          <div className="font-mono text-lg font-bold text-foreground">
            {(data?.turnoutPercentage ?? 0).toFixed(1)}%
          </div>
          <div className="text-xs text-text-dim">turnout</div>
        </div>
        <div>
          <div className="font-mono text-lg font-bold text-foreground">
            {(data?.eligibleWalletCount ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-text-dim">Eligible wallets</div>
        </div>
      </motion.div>

      {/* Status message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3, ease: EASE }}
        className="mt-4 text-center text-sm text-muted-foreground"
      >
        {data?.phase === "OPEN" && (
          <p className="flex items-center justify-center gap-2">
            <CalendarClock className="h-4 w-4" aria-hidden />
            <span>voting closes</span> {formatDateTime(data.endsAt)}
          </p>
        )}
        {data?.phase === "CLOSED" && (
          <p className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden />
            Voting closed - Results are final
          </p>
        )}
      </motion.div>

      {/* Voting options */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: EASE }}
        className="mt-8 space-y-4"
      >
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Cast your ballot</h2>
          {!me ? (
            <p className="text-sm text-muted-foreground">
              Connect and verify your wallet to participate.
            </p>
          ) : data?.userEligible ? (
            <p className="text-sm text-muted-foreground">
              {data.phase === "OPEN" ? "Select a voting method below" : "Voting is closed"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your wallet is not eligible for this election
            </p>
          )}
        </div>

        {!me && (
          <div className="rounded-xl border border-border bg-bg-elevated/40 p-6 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Connect to vote</p>
            <p className="text-sm text-muted-foreground mb-4">
              One ballot per snapshot wallet, regardless of balance.
            </p>
            <ConnectCta>Connect Wallet</ConnectCta>
          </div>
        )}

        {ELECTION_EXPLANATIONS.map((explanation, idx) => {
          const selected = data?.userChoice === explanation.id;
          const canVote = data?.userEligible && data?.phase === "OPEN";
          const isMutating = castVote.isPending;

          return (
            <motion.div
              key={explanation.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.05, duration: 0.3, ease: EASE }}
            >
              <Card
                className={cn(
                  "transition-all cursor-pointer",
                  selected && "border-gold/40 bg-gold/5",
                  canVote && !selected && "hover:border-border/50"
                )}
                onClick={() => canVote && handleVote(explanation.id)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            {explanation.title}
                          </h3>
                          {selected && (
                            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                              <CheckCircle2 className="h-3 w-3" aria-hidden />
                              Current ballot
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="mt-1 text-sm text-muted-foreground mb-2">
                        {explanation.summary}
                      </p>
                      
                      <code className="inline-block rounded bg-bg-elevated px-2 py-1 text-xs text-gold">
                        {explanation.mathFormula}
                      </code>

                      <div className="mt-4 space-y-2">
                        <h4 className="text-xs font-medium text-foreground">Calculation steps</h4>
                        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                          {explanation.howItWorks.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-medium text-foreground mb-1">Worked examples</h4>
                          <div className="space-y-1">
                            {explanation.workedExamples.slice(0, 2).map((example, i) => (
                              <div key={i} className="text-xs text-muted-foreground">
                                <span className="font-mono">{example.label}</span>: {example.calc} → {example.power}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-medium text-foreground mb-1">Best for</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{explanation.bestFor}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-medium text-foreground mb-1">Advantages</h4>
                          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                            {explanation.advantages.map((advantage, i) => (
                              <li key={i}>{advantage}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-foreground mb-1">Disadvantages</h4>
                          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                            {explanation.disadvantages.map((disadvantage, i) => (
                              <li key={i}>{disadvantage}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {data?.results && (
                        <div className="text-center">
                          <div className="font-mono text-lg font-bold text-foreground">
                            {data.results.find(r => r.choice === explanation.id)?.percentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-text-dim">Current results</div>
                        </div>
                      )}
                      
                      {canVote && !isMutating && (
                        <Button
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "shrink-0",
                            selected && "bg-gold text-gold-foreground hover:bg-gold/90"
                          )}
                        >
                          {selected ? "Selected" : "Select"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Results section */}
      {data?.results && data.results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: EASE }}
          className="mt-8"
        >
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Current results</h2>
            <p className="text-sm text-muted-foreground">
              Live tally based on {data.totalBallots.toLocaleString()} ballots
            </p>
          </div>

          <div className="space-y-3">
            {data.results.map((result) => {
              const choice = ELECTION_EXPLANATIONS.find(e => e.id === result.choice);
              const isSelected = data.userChoice === result.choice;
              
              return (
                <div key={result.choice} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("font-medium", isSelected && "text-gold")}>
                      {choice?.title}
                    </span>
                    <span className={cn("font-mono font-bold", isSelected && "text-gold")}>
                      {result.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        CHOICE_COLORS[result.choice]
                      )}
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-dim">
                    <span>{result.label}</span>
                    <span>{result.count.toLocaleString()} ballots</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4, ease: EASE }}
        className="mt-8"
      >
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {ELECTION_FAQ.map((faq, idx) => (
            <AccordionItem key={idx} value={`faq-${idx}`}>
              <AccordionTrigger className="text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>

      {/* Documentation link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3, ease: EASE }}
        className="mt-8 text-center"
      >
        <Link
          href="https://github.com/DBOT-DC/omnom-snapshot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors"
        >
          <Database className="h-4 w-4" />
          Snapshot source data and documentation: DBOT-DC/omnom-snapshot
        </Link>
      </motion.div>
    </div>
  );
}
