"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, timeAgo } from "@/lib/utils";

interface Vote {
  id: string;
  proposalId: string;
  proposalTitle: string;
  choice: VoteChoice;
  votingPower: number;
  createdAt: string;
  proposalStatus: string;
}

interface VoteHistoryProps {
  votes: Vote[];
  loading?: boolean;
}

/**
 * Vote history component showing user's voting record with filtering.
 * Part of Phase 1: Core Voting Infrastructure enhancement.
 */
export function VoteHistory({ votes, loading = false }: VoteHistoryProps) {
  const [filter, setFilter] = useState<"all" | "FOR" | "AGAINST" | "ABSTAIN">("all");
  const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Filter votes
  const filteredVotes = votes.filter(vote => {
    if (filter === "all") return true;
    return vote.choice === filter;
  });

  // Toggle vote details expansion
  const toggleExpand = (voteId: string) => {
    const newExpanded = new Set(expandedVotes);
    if (newExpanded.has(voteId)) {
      newExpanded.delete(voteId);
    } else {
      newExpanded.add(voteId);
    }
    setExpandedVotes(newExpanded);
  };

  // Navigate to proposal
  const handleProposalClick = (proposalId: string) => {
    router.push(`/proposals/${proposalId}`);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-full animate-pulse rounded bg-bg-elevated/50" />
        <div className="h-24 w-full animate-pulse rounded bg-bg-elevated/50" />
        <div className="h-24 w-full animate-pulse rounded bg-bg-elevated/50" />
      </div>
    );
  }

  if (votes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated/50 mb-4">
          <Filter className="h-8 w-8 text-text-dim" aria-hidden />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No voting history yet</h3>
        <p className="text-sm text-text-dim">
          Your votes will appear here after you participate in proposals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Voting History ({votes.length} vote{votes.length !== 1 ? 's' : ''})
        </h3>
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Votes</SelectItem>
            <SelectItem value="FOR">For Only</SelectItem>
            <SelectItem value="AGAINST">Against Only</SelectItem>
            <SelectItem value="ABSTAIN">Abstain Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vote list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredVotes.map((vote, index) => (
            <motion.div
              key={vote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg border border-border bg-bg-surface overflow-hidden"
            >
              {/* Main vote row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-elevated/50 transition-colors"
                onClick={() => toggleExpand(vote.id)}
              >
                {/* Vote choice indicator */}
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  VOTE_CHOICE_CONFIG[vote.choice].barClass
                )}>
                  <span className="text-lg">{VOTE_CHOICE_CONFIG[vote.choice].emoji}</span>
                </div>

                {/* Vote content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {vote.proposalTitle}
                    </p>
                    <span className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      vote.proposalStatus === 'PASSED' && "bg-emerald-600/20 text-emerald-400",
                      vote.proposalStatus === 'FAILED' && "bg-rose-600/20 text-rose-400",
                      vote.proposalStatus === 'ACTIVE' && "bg-blue-600/20 text-blue-400",
                      (vote.proposalStatus === 'DRAFT' || vote.proposalStatus === 'PENDING') && "bg-slate-600/20 text-slate-400"
                    )}>
                      {vote.proposalStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-dim">
                    <span>Voting Power: {vote.votingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span>•</span>
                    <span>{timeAgo(vote.createdAt)}</span>
                  </div>
                </div>

                {/* Expand/collapse button */}
                <button
                  type="button"
                  className="shrink-0 p-1 rounded hover:bg-bg-elevated transition-colors"
                  aria-label="Toggle details"
                >
                  {expandedVotes.has(vote.id) ? (
                    <ChevronUp className="h-4 w-4 text-text-dim" aria-hidden />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-dim" aria-hidden />
                  )}
                </button>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedVotes.has(vote.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border bg-bg-elevated/30"
                  >
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-text-dim">Vote Choice</p>
                          <p className={cn("font-medium", VOTE_CHOICE_CONFIG[vote.choice].accentClass)}>
                            {VOTE_CHOICE_CONFIG[vote.choice].label}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-dim">Voting Power</p>
                          <p className="font-mono font-medium text-foreground">
                            {vote.votingPower.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-dim">Cast Date</p>
                          <p className="font-medium text-foreground">
                            {formatDateTime(vote.createdAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-dim">Proposal Status</p>
                          <p className="font-medium text-foreground">
                            {vote.proposalStatus}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleProposalClick(vote.proposalId)}
                      >
                        View Proposal
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state for filtered results */}
      {filteredVotes.length === 0 && votes.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-text-dim">
            No votes match the selected filter.
          </p>
        </div>
      )}
    </div>
  );
}
