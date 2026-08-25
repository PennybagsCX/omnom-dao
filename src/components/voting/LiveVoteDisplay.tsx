"use client";

import { useEffect, useRef, useState } from "react";
import { VOTE_CHOICE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VoteChoice } from "@/types";
import { Loader2, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LiveVoteData {
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  timestamp: string;
}

interface LiveVoteDisplayProps {
  proposalId: string;
  initialData: LiveVoteData;
  onUpdate?: (data: LiveVoteData) => void;
  refreshInterval?: number;
  showTrend?: boolean;
  className?: string;
}

/**
 * Real-time vote display with automatic polling and live updates.
 * Part of Phase 1: Core Voting Infrastructure enhancement.
 */
export function LiveVoteDisplay({
  proposalId,
  initialData,
  onUpdate,
  refreshInterval = 5000, // 5 seconds default
  showTrend = false,
  className,
}: LiveVoteDisplayProps) {
  const [voteData, setVoteData] = useState<LiveVoteData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [previousData, setPreviousData] = useState<LiveVoteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest values for the polling closure. The poll effect intentionally keeps
  // a stable [proposalId, refreshInterval] dep array so the interval is not
  // torn down and recreated on every poll (which would reset the timer each
  // time voteData changes). Reads go through this ref instead.
  const latestRef = useRef({ voteData, onUpdate });
  useEffect(() => {
    latestRef.current = { voteData, onUpdate };
  }, [voteData, onUpdate]);

  // Calculate percentages
  const total = voteData.votesFor + voteData.votesAgainst + voteData.votesAbstain;
  const forPct = total > 0 ? (voteData.votesFor / total) * 100 : 0;
  const againstPct = total > 0 ? (voteData.votesAgainst / total) * 100 : 0;
  const abstainPct = total > 0 ? (voteData.votesAbstain / total) * 100 : 0;

  // Calculate trends (change from previous data)
  const getTrend = (current: number, previous: number | null | undefined) => {
    if (previous === null || previous === undefined) return null;
    const change = current - previous;
    if (change === 0) return null;
    return change > 0 ? "up" : "down";
  };

  const forTrend = getTrend(voteData.votesFor, previousData?.votesFor);
  const againstTrend = getTrend(voteData.votesAgainst, previousData?.votesAgainst);
  const abstainTrend = getTrend(voteData.votesAbstain, previousData?.votesAbstain);

  // Poll for updates
  useEffect(() => {
    const pollForUpdates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/v1/proposals/${proposalId}/votes/live`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const newData = await response.json();

        if (newData.error) {
          throw new Error(newData.error.message || 'Failed to fetch votes');
        }

        // Read the latest state through the ref (see latestRef above).
        const current = latestRef.current.voteData;
        setPreviousData(current); // Store current as previous before updating
        const updatedData = {
          votesFor: newData.data?.votesFor ?? current.votesFor,
          votesAgainst: newData.data?.votesAgainst ?? current.votesAgainst,
          votesAbstain: newData.data?.votesAbstain ?? current.votesAbstain,
          totalVotes: (newData.data?.votesFor || 0) + (newData.data?.votesAgainst || 0) + (newData.data?.votesAbstain || 0),
          timestamp: new Date().toISOString(),
        };

        setVoteData(updatedData);
        latestRef.current.onUpdate?.(updatedData);
      } catch (err) {
        console.error('Failed to poll for vote updates:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial poll
    pollForUpdates();

    // Set up interval
    const interval = setInterval(pollForUpdates, refreshInterval);

    return () => clearInterval(interval);
  }, [proposalId, refreshInterval]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Live Results</h4>
        <div className="flex items-center gap-2">
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-text-dim" aria-hidden />
          )}
          <span className="flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-text-dim">LIVE</span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-600/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Failed to update votes. Showing cached data.
        </div>
      )}

      {/* Vote bars with animations */}
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {forPct > 0 && (
            <motion.div
              key="for-bar"
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-8 overflow-hidden rounded-lg bg-emerald-600/20"
            >
              <div className={cn("absolute inset-y-0 left-0 bg-emerald-600/40", VOTE_CHOICE_CONFIG[VoteChoice.FOR].barClass)} />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-sm font-semibold text-emerald-400">
                  {VOTE_CHOICE_CONFIG[VoteChoice.FOR].label}
                </span>
                <div className="flex items-center gap-2">
                  {showTrend && forTrend && (
                    <TrendingUp className={cn("h-3.5 w-3.5", forTrend === "up" ? "text-emerald-400" : "text-rose-400")} aria-hidden />
                  )}
                  <span className="font-mono text-sm text-emerald-300">
                    {forPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {againstPct > 0 && (
            <motion.div
              key="against-bar"
              initial={{ width: 0 }}
              animate={{ width: `${againstPct}%` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-8 overflow-hidden rounded-lg bg-rose-600/20"
            >
              <div className={cn("absolute inset-y-0 left-0 bg-rose-600/40", VOTE_CHOICE_CONFIG[VoteChoice.AGAINST].barClass)} />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-sm font-semibold text-rose-400">
                  {VOTE_CHOICE_CONFIG[VoteChoice.AGAINST].label}
                </span>
                <div className="flex items-center gap-2">
                  {showTrend && againstTrend && (
                    <TrendingUp className={cn("h-3.5 w-3.5", againstTrend === "up" ? "text-emerald-400" : "text-rose-400")} aria-hidden />
                  )}
                  <span className="font-mono text-sm text-rose-300">
                    {againstPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {abstainPct > 0 && (
            <motion.div
              key="abstain-bar"
              initial={{ width: 0 }}
              animate={{ width: `${abstainPct}%` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-8 overflow-hidden rounded-lg bg-slate-600/20"
            >
              <div className={cn("absolute inset-y-0 left-0 bg-slate-600/40", VOTE_CHOICE_CONFIG[VoteChoice.ABSTAIN].barClass)} />
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-sm font-semibold text-slate-300">
                  {VOTE_CHOICE_CONFIG[VoteChoice.ABSTAIN].label}
                </span>
                <div className="flex items-center gap-2">
                  {showTrend && abstainTrend && (
                    <TrendingUp className={cn("h-3.5 w-3.5", abstainTrend === "up" ? "text-emerald-400" : "text-rose-400")} aria-hidden />
                  )}
                  <span className="font-mono text-sm text-slate-200">
                    {abstainPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Total votes and timestamp */}
      <div className="flex items-center justify-between text-xs text-text-dim">
        <span>
          {voteData.totalVotes.toLocaleString()} total votes
        </span>
        <span>
          Updated {new Date(voteData.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
