"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiRequestError, fetchApi, queryKeys, useCurrentUser } from "@/lib/api";
import { isAdminAddress } from "@/lib/constants";
import { ProposalStatus, type Proposal } from "@/types";

/**
 * Admin-only hard-delete affordance for a FAILED proposal (rejected or
 * quorum-failed). Renders nothing for non-admins or non-FAILED proposals —
 * mirroring the server-side guards in
 * DELETE /api/v1/proposals/[id]/delete. Deletes require confirmation; the
 * audit-log entry survives the proposal by design (§11.3).
 *
 * Placement: proposal detail page (under the rejection banner) and the
 * /admin "Failed proposals" section. After a successful delete the queries
 * are invalidated; on the detail page we navigate back to the list, while
 * on /admin we stay put so several cleanups can be done in a row.
 */
export function DeleteProposalDialog({ proposal }: { proposal: Proposal }) {
  const { data: me } = useCurrentUser({ retry: false });
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  const deleteProposal = useMutation({
    mutationFn: () =>
      fetchApi<{ deleted: boolean; id: string }>(
        `/api/v1/proposals/${proposal.id}/delete`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      setOpen(false);
      toast.success("Proposal deleted");
      // Prefix keys cover every list filter, the dashboard, and all admin
      // sections (pending / passed / failed).
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: queryKeys.proposalDetail(proposal.id) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: ["admin"] });
      if (!pathname.startsWith("/admin")) {
        router.push("/proposals");
      }
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiRequestError
          ? error.message
          : "Failed to delete proposal.",
      );
    },
  });

  // Self-gating AFTER all hooks — non-admins and non-FAILED proposals see
  // nothing.
  if (!me || !isAdminAddress(me.address) || proposal.status !== ProposalStatus.FAILED) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" aria-hidden /> Delete proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="h-5 w-5" aria-hidden /> Delete this proposal?
          </DialogTitle>
          <DialogDescription>
            This permanently removes “{proposal.title}”. The action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-amber-200/90">What gets deleted:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>The proposal and its full text</li>
            <li>All votes and ballot records for it</li>
            <li>Its comments and every reaction</li>
          </ul>
          <p className="mt-2 font-medium text-amber-200/90">What is preserved:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>A PROPOSAL_DELETED entry in the public audit log</li>
            <li>Notifications already delivered to members</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleteProposal.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteProposal.isPending}
            onClick={() => deleteProposal.mutate()}
          >
            {deleteProposal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            Delete proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
