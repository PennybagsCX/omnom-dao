"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  ClipboardList,
  CloudOff,
  CloudUpload,
  FolderOpen,
  Hash,
  Loader2,
  PartyPopper,
  Rocket,
  Save,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Markdown } from "@/components/shared/markdown";
import { WysiwygEditor } from "@/components/shared/wysiwyg-editor";
import { ProposalTypeBadge } from "@/components/shared/proposal-type-badge";
import { HolderBadge } from "@/components/shared/holder-badge";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { EmptyState } from "@/components/shared/empty-state";
import { ConnectCta } from "@/components/wallet/connect-cta";
import { useCreateProposal, useCurrentUser, useTags, fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDraftAutosave, type DraftRecord } from "@/lib/use-draft-autosave";
import { PROPOSAL_TYPE_CONFIG } from "@/lib/constants";
import { HolderClass, ProposalType } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { FGE_VOTING_ENDS_AT } from "@/lib/election";

// Confetti is a client-only canvas component — load it lazily.
const ReactConfetti = dynamic(() => import("react-confetti"), { ssr: false });

const EASE = [0.22, 1, 0.36, 1] as const;

/** Per-type default quorum + minimum duration, mirroring API seeded defaults. */
const TYPE_DEFAULTS: Record<
  ProposalType,
  { quorum: number; minDurationHours: number; defaultDurationHours: number }
> = {
  [ProposalType.CHAIN_SELECTION]: { quorum: 15, minDurationHours: 168, defaultDurationHours: 336 },
  [ProposalType.TOKENOMICS_CHANGE]: { quorum: 15, minDurationHours: 168, defaultDurationHours: 336 },
  [ProposalType.TREASURY]: { quorum: 10, minDurationHours: 72, defaultDurationHours: 168 },
  [ProposalType.GUIDELINE]: { quorum: 10, minDurationHours: 72, defaultDurationHours: 168 },
  [ProposalType.TECHNICAL]: { quorum: 10, minDurationHours: 72, defaultDurationHours: 168 },
  [ProposalType.GENERAL]: { quorum: 10, minDurationHours: 72, defaultDurationHours: 168 },
};

const DURATION_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "72", label: "72 hours (3 days)" },
  { value: "168", label: "7 days" },
  { value: "336", label: "14 days" },
  { value: "720", label: "30 days" },
];

interface WizardState {
  type: ProposalType | null;
  title: string;
  body: string;
  tags: string;
  durationHours: number;
}

const TOTAL_STEPS = 4;

/**
 * Create Proposal wizard (DESIGN.md §7.7, UI-WIREFRAMES.md §10–11).
 *
 * Unauthenticated users see a "Connect Wallet" CTA. Authenticated users get a
 * 4-step wizard with per-step validation, persisted state across steps, live
 * markdown preview, and a confetti celebration on successful submission.
 */
export default function CreateProposalPage() {
  const { data: me } = useCurrentUser({ retry: false });
  const createProposal = useCreateProposal();

  // Fetch election phase to gate submission. Drafts are allowed in any phase
  // (UPCOMING / OPEN / CLOSED); only submission requires CLOSED. We use a
  // dedicated useQuery (not coupled to useCreateProposal) so the election
  // data is independent of proposal-creation mutations.
  const { data: election } = useQuery({
    queryKey: ["election", "phase"],
    queryFn: () =>
      fetchApi<{ phase: "UPCOMING" | "OPEN" | "CLOSED"; endsAt: string }>(
        "/api/v1/governance-vote",
      ),
    // Refresh every minute; cheap (small JSON payload).
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const proposalsUnlocked = election?.phase === "CLOSED";

  const [step, setStep] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [triedNext, setTriedNext] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const [state, setState] = useState<WizardState>({
    type: null,
    title: "",
    body: "",
    tags: "",
    durationHours: 168,
  });

  // ── Draft autosave (Phase 10) ─────────────────────────────────
  // Saves the wizard state to /api/v1/proposals/drafts every 3 seconds of
  // inactivity. Cross-device sync: signed-in users see the same drafts on
  // any device because they're keyed to the SIWE-verified wallet.
  const initialQuorum = state.type
    ? (TYPE_DEFAULTS[state.type]?.quorum ?? 10)
    : 10;
  const autosave = useDraftAutosave({
    initial: {
      type: state.type ?? ProposalType.GENERAL,
      title: state.title,
      summary: "", // reserved for future; not in WizardState yet
      bodyMarkdown: state.body,
      tags: state.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      durationHours: state.durationHours,
      quorumRequired: initialQuorum,
    },
    enabled: Boolean(me),
  });

  // Re-bind autosave whenever the wizard state changes. The hook debounces
  // internally; calling bindAutoSave on every keystroke is cheap.
  useEffect(() => {
    if (!state.type) return;
    const eq = TYPE_DEFAULTS[state.type]?.quorum ?? 10;
    autosave.bindAutoSave({
      type: state.type,
      title: state.title,
      summary: "",
      bodyMarkdown: state.body,
      tags: state.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      durationHours: state.durationHours,
      quorumRequired: eq,
    });
  }, [state.type, state.title, state.body, state.tags, state.durationHours, autosave]);

  const [draftsOpen, setDraftsOpen] = useState(false);
  const [savedAgoSeconds, setSavedAgoSeconds] = useState(0);

  // Tick "saved Xs ago" every second when we have a saved timestamp.
  // The initial value is set lazily — no synchronous setState in the effect.
  useEffect(() => {
    if (!autosave.lastSavedAt) return;
    const tick = () =>
      setSavedAgoSeconds(Math.floor((Date.now() - autosave.lastSavedAt!) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autosave.lastSavedAt]);

  const loadDraftIntoWizard = (draft: DraftRecord) => {
    const newState: WizardState = {
      type: draft.type as ProposalType,
      title: draft.title,
      body: draft.bodyMarkdown,
      tags: draft.tags.join(", "),
      durationHours: draft.durationHours,
    };
    setState(newState);
    setDraftsOpen(false);
    setStep(1);
  };

  const patch = useCallback(
    (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  // ── Per-step validation ──────────────────────────────────────
  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return state.type !== null;
      case 2:
        return state.title.trim().length >= 10 && state.body.trim().length >= 50;
      case 3:
        return state.durationHours > 0;
      case 4:
        return confirmed;
      default:
        return false;
    }
  }, [step, state, confirmed]);

  // Compute per-field validation messages for the current step.
  const stepErrors = useMemo<string[]>(() => {
    const errs: string[] = [];
    if (step === 1 && !state.type) {
      errs.push("Select a proposal type to continue.");
    }
    if (step === 2) {
      if (state.title.trim().length < 10) {
        errs.push(`Title must be at least 10 characters (currently ${state.title.trim().length}).`);
      }
      if (state.body.trim().length < 50) {
        errs.push(`Description must be at least 50 characters (currently ${state.body.trim().length}).`);
      }
    }
    return errs;
  }, [step, state.title, state.body, state.type]);

  const typeDefaults = state.type ? TYPE_DEFAULTS[state.type] : null;
  const effectiveQuorum = typeDefaults?.quorum ?? 10;

  const goNext = useCallback(() => {
    if (!stepValid) {
      setTriedNext(true);
      return;
    }
    setTriedNext(false);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, [stepValid]);

  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);

  const onSubmit = useCallback(async () => {
    if (!state.type || createProposal.isPending) return;
    try {
      const res = await createProposal.mutateAsync({
        title: state.title.trim(),
        description: state.body.trim(),
        type: state.type,
        durationHours: state.durationHours,
        quorumRequired: effectiveQuorum,
        // Include the collected tags in metadata so they're persisted (C1.4),
        // rather than captured in the UI but dropped on submit.
        metadata: {
          type: "base",
          tags: state.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          links: [],
        },
      });
      setShowConfetti(true);
      setSubmittedId(res.proposal.id);
    } catch {
      // toast handled by hook
    }
  }, [state, createProposal, effectiveQuorum]);

  // ── Success screen ───────────────────────────────────────────
  if (submittedId) {
    return (
      <div className="relative mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        {showConfetti && (
          <ReactConfetti
            recycle={false}
            numberOfPieces={280}
            onConfettiComplete={() => setShowConfetti(false)}
            className="pointer-events-none fixed inset-0 z-50"
          />
        )}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="mb-4 flex justify-center" aria-hidden>
            <PartyPopper className="h-16 w-16 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Proposal submitted!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your proposal has been submitted for review. It will enter a moderation
            queue before voting opens.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href={`/proposals/${submittedId}`}>View Proposal</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/proposals">Back to Proposals</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Unauthenticated guard ────────────────────────────────────
  // If the user hasn't connected + verified their wallet, show a CTA
  // instead of the wizard. This replaces the old proxy redirect.
  if (!me) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Submit a Proposal
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Draft a new governance proposal for OMNOM DAO. You must connect and
          verify a wallet that appears in the frozen snapshot.
        </p>
        <EmptyState
          icon={<Wallet className="h-12 w-12" />}
          title="Connect your wallet"
          description="Connect and verify your wallet to create a proposal."
          action={<ConnectCta size="lg">Connect Wallet</ConnectCta>}
        />
      </div>
    );
  }

  // ── Not in snapshot guard ────────────────────────────────────
  if (!me.votingPower) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Submit a Proposal
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Your wallet must appear in the frozen Dogechain snapshot (block
          59,922,100) to create a proposal.
        </p>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mb-3 flex justify-center" aria-hidden>
              <Ban className="h-12 w-12 text-danger" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Wallet not in snapshot
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Only wallets present in the ever-held snapshot corpus can create
              proposals.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Election-locked banner (only render when election data is ready) ─
  // We do NOT block the wizard itself — drafts save any time, even before
  // the FGE closes. Submit is gated separately via the submit button
  // disabled state. This lets holders start drafting immediately.
  const showLockedBanner =
    !proposalsUnlocked && Boolean(election);

  // ── Loading skeleton (election data not yet returned) ──────────
  if (!proposalsUnlocked && !election) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Submit a Proposal
        </h1>
        <p className="text-sm text-muted-foreground">Loading election status…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/proposals">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Cancel
        </Link>
      </Button>

      {/* ── Locked banner — shown above the wizard when FGE is not closed */}
      {showLockedBanner && election?.endsAt && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-6"
          data-testid="proposals-locked-banner"
        >
          <CountdownTimer
            target={election.endsAt}
            label="Submission unlocks in"
            ariaLabel="Countdown to proposal submission unlock"
          />
          <p className="mt-3 text-center text-xs text-text-dim">
            Drafts auto-save below. Submit activates after the election closes.
          </p>
        </motion.div>
      )}

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Submit a Proposal
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Draft a new governance proposal for OMNOM DAO. Choose a template, fill in
        the details, and submit for admin review. After approval, holders vote
        on whether to ratify.
      </p>

      {/* ── Draft controls row: status indicator + drafts picker */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated/40 px-4 py-2.5 text-xs">
        <DraftStatusIndicator
          state={autosave.autoSaveState}
          savedAgoSeconds={savedAgoSeconds}
          enabled={Boolean(me)}
        />
        {autosave.drafts.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraftsOpen((v) => !v)}
              aria-expanded={draftsOpen}
              aria-haspopup="menu"
              className="h-7 px-2 text-xs"
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              {autosave.drafts.length} saved draft{autosave.drafts.length === 1 ? "" : "s"}
            </Button>
            {draftsOpen && (
              <DraftsMenu
                drafts={autosave.drafts}
                onLoad={(d) => loadDraftIntoWizard(d)}
                onDelete={async (id) => {
                  await autosave.deleteDraft(id);
                }}
                onClose={() => setDraftsOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Create Proposal · Step {step} of {TOTAL_STEPS}
          </span>
          <span className="text-muted-foreground">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i + 1 <= step ? "bg-gold" : "bg-bg-elevated",
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <Card>
            <CardContent className="p-6">
              {/* ── Step 1: Type selection ───────────────────── */}
              {step === 1 && (
                <StepType
                  selected={state.type}
                  onSelect={(t) => patch({ type: t })}
                />
              )}

              {/* ── Step 2: Content ─────────────────────────── */}
              {step === 2 && (
                <StepContent
                  title={state.title}
                  body={state.body}
                  tags={state.tags}
                  onTitle={(v) => patch({ title: v.slice(0, 200) })}
                  onBody={(v) => patch({ body: v.slice(0, 10000) })}
                  onTags={(v) => patch({ tags: v })}
                  showValidation={triedNext}
                />
              )}

              {step === 3 && (
                <StepParameters
                  type={state.type}
                  durationHours={state.durationHours}
                  onDuration={(v) => patch({ durationHours: v })}
                  effectiveQuorum={effectiveQuorum}
                />
              )}

              {/* ── Step 4: Review ──────────────────────────── */}
              {step === 4 && (
                <StepReview
                  state={state}
                  effectiveQuorum={effectiveQuorum}
                  confirmed={confirmed}
                  onConfirm={setConfirmed}
                  votingPower={me?.votingPower}
                  holderClass={me?.class}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ── Validation hints ──────────────────────────── */}
      {triedNext && stepErrors.length > 0 && (
        <div
          className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-center"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div className="space-y-0.5">
            {stepErrors.map((err) => (
              <p key={err} className="text-sm text-danger">{err}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || createProposal.isPending}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={goNext}>
            Next <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={!stepValid || createProposal.isPending || !proposalsUnlocked}
          >
            {createProposal.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Rocket className="h-4 w-4" aria-hidden />
            )}
            Submit Proposal
          </Button>
        )}
      </div>

      {/* Rate-limit error hint */}
      {createProposal.isError && (
        <p className="mt-3 text-center text-sm text-danger" role="alert">
          {createProposal.error.message}
        </p>
      )}
    </div>
  );
}

const STEP_LABELS = ["Choose Type", "Content", "Parameters", "Review & Submit"];

/* ── Step 1: Type selection ───────────────────────────────────── */

function StepType({
  selected,
  onSelect,
}: {
  selected: ProposalType | null;
  onSelect: (t: ProposalType) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Choose a proposal type</h2>
      <p className="mt-1 text-sm text-muted-foreground text-center sm:text-left">
        Each type has its own quorum, voting period, and minimum holder tier.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(PROPOSAL_TYPE_CONFIG) as ProposalType[]).map((type) => {
          const cfg = PROPOSAL_TYPE_CONFIG[type];
          const def = TYPE_DEFAULTS[type];
          const active = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center rounded-lg border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-gold bg-gold/5 shadow-md shadow-gold/5"
                  : "border-border bg-bg-elevated/30 hover:border-gold/40",
              )}
            >
              {active && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-bg-deep">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              )}
              <DynamicIcon
                name={cfg.iconName}
                aria-hidden
                className={cn("h-6 w-6", cfg.accentClass)}
              />
              <h3 className={cn("mt-2 font-semibold", cfg.accentClass)}>{cfg.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{cfg.description}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Quorum {def.quorum}%
                </span>
                <HolderBadge holderClass={cfg.minHolderClass} size="sm" plain />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 2: Content ──────────────────────────────────────────── */

function StepContent({
  title,
  body,
  tags,
  onTitle,
  onBody,
  onTags,
  showValidation,
}: {
  title: string;
  body: string;
  tags: string;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onTags: (v: string) => void;
  showValidation: boolean;
}) {
  const titleError = showValidation && title.trim().length < 10;
  const bodyError = showValidation && body.trim().length < 50;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground text-center sm:text-left">Write your proposal</h2>
        <p className="mt-1 text-sm text-muted-foreground text-center sm:text-left">
          Title must be 10–200 characters. Body must be at least 50 characters.
          Markdown is supported.
        </p>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="title">Title *</Label>
          <span className="text-xs text-text-dim">{title.length}/200</span>
        </div>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="e.g. Should we launch an OMNOM merch store?"
          maxLength={200}
          aria-invalid={titleError}
        />
        {titleError && (
          <p className="text-xs text-danger">
            Title must be at least 10 characters (currently {title.trim().length}).
          </p>
        )}
      </div>

      {/* Body — split view on desktop, tabs on mobile */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">Description *</Label>
          <span className="text-xs text-text-dim">{body.length}/10000</span>
        </div>

        {/* WYSIWYG markdown editor with toolbar */}
        <WysiwygEditor value={body} onChange={onBody} aria-invalid={bodyError} />
        {bodyError && (
          <p className="text-xs text-danger">
            Description must be at least 50 characters (currently {body.trim().length}).
          </p>
        )}
      </div>

      {/* Tags */}
      <TagInput value={tags} onChange={onTags} />
    </div>
  );
}

/* ── Tag Input with suggestions ──────────────────────────────── */

function TagInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const currentTags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch popular tags for suggestions.
  const { data: tagsData } = useTags(undefined, true);
  const { data: filteredTags } = useTags(
    input.trim() || undefined,
    input.trim().length > 0,
  );

  const allTags = tagsData?.tags ?? [];
  const suggestions = (input.trim() ? filteredTags?.tags ?? [] : allTags)
    .filter((t) => !currentTags.includes(t.name))
    .slice(0, 8);

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim();
    if (!normalized || currentTags.includes(normalized)) return;
    const next = [...currentTags, normalized].join(", ");
    onChange(next);
    setInput("");
  };

  const removeTag = (tag: string) => {
    const next = currentTags.filter((t) => t !== tag).join(", ");
    onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && currentTags.length > 0) {
      removeTag(currentTags[currentTags.length - 1]!);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Tags (optional)</Label>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-elevated/30 p-2.5">
        {currentTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold"
          >
            <Hash className="h-3 w-3" aria-hidden />
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-gold/20"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={currentTags.length === 0 ? "Add tags or type your own…" : ""}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-dim"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => addTag(tag.name)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Hash className="h-3 w-3" aria-hidden />
              {tag.name}
              {tag.count > 1 && (
                <span className="text-text-dim">&times;{tag.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-text-dim">
        Press Enter or comma to add a tag. Click a tag to remove it.
      </p>
    </div>
  );
}

/* ── Step 3: Parameters ───────────────────────────────────────── */

function StepParameters({
  type,
  durationHours,
  onDuration,
  effectiveQuorum,
}: {
  type: ProposalType | null;
  durationHours: number;
  onDuration: (v: number) => void;
  effectiveQuorum: number;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Voting parameters</h2>
        <p className="mt-1 text-sm text-muted-foreground text-center sm:text-left">
          Configure how long voting stays open. Quorum is set per proposal type.
        </p>
      </div>

      {type && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated/40 p-3">
          <ProposalTypeBadge type={type} />
          <span className="text-sm text-muted-foreground">Selected type</span>
        </div>
      )}

      {/* Duration */}
      <div className="space-y-1.5">
        <Label>Voting duration *</Label>
        <Select
          value={String(durationHours)}
          onValueChange={(v) => onDuration(Number(v))}
        >
          <SelectTrigger aria-label="Voting duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quorum (read-only, from type default) */}
      <div className="space-y-1.5">
        <Label>Quorum requirement</Label>
        <div className="rounded-md border border-border bg-bg-elevated/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gold">{effectiveQuorum}%</span>
            <span className="text-xs text-text-dim">of total supply</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Minimum participation required for the result to be valid. This is the
            default for the selected type.
          </p>
        </div>
      </div>

      {/* Pass threshold info */}
      <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
        Lower quorum thresholds make proposals easier to pass but reduce
        legitimacy. The default reflects community standards for this type.
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Summary
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Duration: {humanizeHours(durationHours)}</li>
          <li>Quorum: {effectiveQuorum}% of total supply</li>
          <li>1 token = 1 vote (linear)</li>
        </ul>
      </div>
    </div>
  );
}

/* ── Step 4: Review ───────────────────────────────────────────── */

function StepReview({
  state,
  effectiveQuorum,
  confirmed,
  onConfirm,
  votingPower,
  holderClass,
}: {
  state: WizardState;
  effectiveQuorum: number;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  votingPower?: number;
  holderClass?: HolderClass;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review & submit</h2>
        <p className="mt-1 text-sm text-muted-foreground text-center sm:text-left">
          Please review carefully. Once submitted, your proposal enters a review
          queue and cannot be edited after approval.
        </p>
      </div>

      <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
        <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
        Submitted proposals will be reviewed by moderators before voting opens.
      </div>

      {/* Review blocks */}
      <div className="space-y-3">
        <ReviewBlock label="Type">
          {state.type && <ProposalTypeBadge type={state.type} />}
        </ReviewBlock>
        <ReviewBlock label="Title">
          <span className="font-semibold text-foreground">{state.title}</span>
        </ReviewBlock>
        <ReviewBlock label="Parameters">
          <span className="text-sm text-muted-foreground">
            {humanizeHours(state.durationHours)} · Quorum {effectiveQuorum}%
          </span>
        </ReviewBlock>
        {state.tags.trim() && (
          <ReviewBlock label="Tags">
            <span className="font-mono text-xs text-muted-foreground">
              {state.tags}
            </span>
          </ReviewBlock>
        )}
        <ReviewBlock label="Description">
          <div className="max-h-64 overflow-y-auto rounded border border-border bg-bg-deep/40 p-3">
            <Markdown>{state.body}</Markdown>
          </div>
        </ReviewBlock>
      </div>

      {/* Vote power */}
      <div className="rounded-lg border border-border bg-bg-elevated/40 p-3">
        <p className="text-xs text-text-dim">Your voting power</p>
        <p className="mt-1 font-mono text-lg font-bold text-gold">
          {(votingPower ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </p>
        {holderClass && (
          <div className="mt-2">
            <HolderBadge holderClass={holderClass} size="sm" />
          </div>
        )}
      </div>

      {/* Confirmation */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/40">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span className="text-sm text-muted-foreground">
          I confirm this proposal is accurate and complete. I understand it will
          be reviewed by moderators before voting opens.
        </span>
      </label>
    </div>
  );
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-dim">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function humanizeHours(hours: number): string {
  if (hours < 24) return `${hours} hours`;
  const days = hours / 24;
  return days === 1 ? "1 day" : `${days} days`;
}

/* ── Draft status indicator ───────────────────────────────────── */

function DraftStatusIndicator({
  state,
  savedAgoSeconds,
  enabled,
}: {
  state: "idle" | "saving" | "saved" | "error";
  savedAgoSeconds: number;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-dim">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        Sign in to save drafts
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground" aria-live="polite">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-danger" role="status">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        Save failed — retrying
      </span>
    );
  }
  if (state === "saved" && savedAgoSeconds >= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-success" aria-live="polite">
        <Save className="h-3.5 w-3.5" aria-hidden />
        Saved {savedAgoSeconds === 0 ? "just now" : `${savedAgoSeconds}s ago`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-text-dim" aria-live="polite">
      <Save className="h-3.5 w-3.5" aria-hidden />
      Drafts auto-save
    </span>
  );
}

/* ── Drafts dropdown ──────────────────────────────────────────── */

function DraftsMenu({
  drafts,
  onLoad,
  onDelete,
  onClose,
}: {
  drafts: DraftRecord[];
  onLoad: (draft: DraftRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away backdrop */}
      <button
        type="button"
        aria-label="Close drafts menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        role="menu"
        className="absolute right-0 z-50 mt-2 max-h-80 w-72 overflow-auto rounded-lg border border-border bg-bg-surface p-1 shadow-2xl"
      >
        <p className="px-3 py-2 text-xs uppercase tracking-wider text-text-dim">
          Your saved drafts
        </p>
        {drafts.map((d) => (
          <div
            key={d.id}
            role="menuitem"
            className="group flex items-center justify-between gap-2 rounded px-2 py-2 hover:bg-bg-elevated"
          >
            <button
              type="button"
              onClick={() => onLoad(d)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-foreground">
                {d.title || "(untitled)"}
              </p>
              <p className="text-xs text-text-dim">
                {formatDraftTimestamp(d.updatedAt)}
              </p>
            </button>
            <button
              type="button"
              aria-label={`Delete draft "${d.title || "(untitled)"}"`}
              onClick={async (e) => {
                e.stopPropagation();
                await onDelete(d.id);
              }}
              className="rounded p-1 text-text-dim opacity-0 transition-opacity hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function formatDraftTimestamp(iso: string): string {
  const date = new Date(iso.replace(" ", "T") + (iso.endsWith("Z") ? "" : "Z"));
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (Number.isNaN(diff)) return iso;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
