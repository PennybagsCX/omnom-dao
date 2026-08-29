import { z } from "zod";
import {
  HolderClass,
  NotificationType,
  ProposalStatus,
  ProposalType,
  VoteChoice,
} from "@/types";

/**
 * Zod validation schemas for every API input. Mirrors the enums in
 * src/types/index.ts and the constraints documented in DATA-MODEL.md.
 */

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const addressSchema = z
  .string()
  .regex(ADDRESS_REGEX, "Invalid EVM address")
  .transform((v) => v.toLowerCase());

export const holderClassSchema = z.nativeEnum(HolderClass);
export const proposalTypeSchema = z.nativeEnum(ProposalType);
export const proposalStatusSchema = z.nativeEnum(ProposalStatus);
export const voteChoiceSchema = z.nativeEnum(VoteChoice);
export const notificationTypeSchema = z.nativeEnum(NotificationType);

// ── Auth ─────────────────────────────────────────────────────

export const verifyWalletSchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature format"),
});

export const nonceRequestSchema = z.object({
  address: addressSchema,
});

// ── Proposals ────────────────────────────────────────────────

export const createProposalSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters").max(10_000),
  type: proposalTypeSchema,
  quorumRequired: z.number().min(0).max(100).optional(),
  durationHours: z.number().int().min(1).max(720).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const getProposalsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: proposalStatusSchema.optional(),
  type: proposalTypeSchema.optional(),
  sortBy: z.enum(["createdAt", "votingEndsAt", "votesFor"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Voting ───────────────────────────────────────────────────

export const castVoteSchema = z.object({
  proposalId: z.string().min(1),
  choice: voteChoiceSchema,
});

// ── Comments ─────────────────────────────────────────────────

export const createCommentSchema = z.object({
  proposalId: z.string().min(1),
  content: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.string().min(1).nullable().optional(),
});

/**
 * Foundational Governance Election comments share the same anti-spam rules
 * as proposal comments (2000 char ceiling, 30s minimum interval, etc.) but
 * are keyed by `electionKey` instead of `proposalId`.
 */
export const createElectionCommentSchema = z.object({
  electionKey: z.string().min(1),
  content: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.string().min(1).nullable().optional(),
});

// ── Users ────────────────────────────────────────────────────

export const updateDisplayNameSchema = z.object({
  displayName: z.string().min(1).max(30),
});

export const userSettingsSchema = z.object({
  notifications: z.object({
    proposalCreated: z.boolean(),
    votingStarted: z.boolean(),
    votingEndingSoon: z.boolean(),
    proposalResult: z.boolean(),
    mention: z.boolean(),
  }),
  preferredWallet: z.string().nullable(),
  displayFormat: z.enum(["full", "abbreviated", "raw"]),
});

// ── Delegation ───────────────────────────────────────────────

export const createDelegationSchema = z.object({
  delegateeAddress: addressSchema,
});

export const getDelegationSchema = z.object({
  address: addressSchema,
});

// ── Notifications ────────────────────────────────────────────

export const listNotificationsSchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
