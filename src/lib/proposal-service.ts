import { db } from "@/lib/db";
import { lookupHolderClasses } from "@/lib/snapshot";
import type { Proposal, ProposalStatus } from "@/types";

/**
 * Proposal data-access service.
 *
 * Encapsulates row → {@link Proposal} mapping and small reusable queries so
 * route handlers stay thin. All queries use parameterized statements.
 */

interface ProposalRow {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  author_address: string;
  created_at: string;
  updated_at: string | null;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  quorum_required: number;
  quorum_achieved: number | null;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  metadata: string;
}

/** Map a raw DB row (object form) to a typed {@link Proposal}. */
export function rowToProposal(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    type: row.type as Proposal["type"],
    status: row.status as ProposalStatus,
    authorAddress: row.author_address as string,
    createdAt: row.created_at as string,
    votingStartsAt: (row.voting_starts_at as string | null) ?? null,
    votingEndsAt: (row.voting_ends_at as string | null) ?? null,
    quorumRequired: row.quorum_required as number,
    quorumAchieved: (row.quorum_achieved as number | null) ?? null,
    votesFor: row.votes_for as number,
    votesAgainst: row.votes_against as number,
    votesAbstain: row.votes_abstain as number,
    metadata: safeParseMetadata(row.metadata as string | null),
  };
}

function safeParseMetadata(raw: string | null): Proposal["metadata"] {
  if (!raw) {
    return { type: "base", links: [], tags: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Proposal["metadata"];
    if (!parsed || typeof parsed !== "object") {
      return { type: "base", links: [], tags: [] };
    }
    return parsed;
  } catch {
    return { type: "base", links: [], tags: [] };
  }
}

const SELECT_COLS =
  "id, title, description, type, status, author_address, created_at, updated_at, " +
  "voting_starts_at, voting_ends_at, quorum_required, quorum_achieved, " +
  "votes_for, votes_against, votes_abstain, metadata";

/**
 * Attach snapshot holder classes to proposals in place: each author gets
 * `authorHolderClass`, and rejected proposals also resolve the rejecting
 * admin's `rejectedByHolderClass` from metadata.
 */
async function attachHolderClasses(proposals: Proposal[]): Promise<void> {
  if (proposals.length === 0) return;
  const addresses = proposals.flatMap((p) =>
    p.metadata.rejectedBy ? [p.authorAddress, p.metadata.rejectedBy] : [p.authorAddress],
  );
  const classes = await lookupHolderClasses(addresses);
  for (const p of proposals) {
    p.authorHolderClass = classes.get(p.authorAddress.toLowerCase()) ?? null;
    if (p.metadata.rejectedBy) {
      p.rejectedByHolderClass = classes.get(p.metadata.rejectedBy.toLowerCase()) ?? null;
    }
  }
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM proposals WHERE id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  const proposal = rowToProposal(res.rows[0] as unknown as Record<string, unknown>);
  await attachHolderClasses([proposal]);
  return proposal;
}

export interface ListProposalsOptions {
  status?: ProposalStatus;
  type?: string;
  sortBy?: "createdAt" | "votingEndsAt" | "votesFor";
  sortOrder?: "asc" | "desc";
  limit: number;
  offset: number;
}

const SORT_COLUMNS: Record<string, string> = {
  createdAt: "created_at",
  votingEndsAt: "voting_ends_at",
  votesFor: "votes_for",
};

export async function listProposals(
  options: ListProposalsOptions,
): Promise<{ proposals: Proposal[]; total: number }> {
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (options.status) {
    where.push("status = ?");
    args.push(options.status);
  }
  if (options.type) {
    where.push("type = ?");
    args.push(options.type);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const sortCol = SORT_COLUMNS[options.sortBy ?? "createdAt"] ?? "created_at";
  const order = options.sortOrder === "asc" ? "ASC" : "DESC";

  const countRes = await db.execute({
    sql: `SELECT COUNT(*) AS cnt FROM proposals ${whereClause}`,
    args,
  });
  const total = Number((countRes.rows[0]?.cnt as number | string) ?? 0);

  const listRes = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM proposals ${whereClause} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
    args: [...args, options.limit, options.offset],
  });

  const proposals = listRes.rows.map((r) =>
    rowToProposal(r as unknown as Record<string, unknown>),
  );
  await attachHolderClasses(proposals);
  return { proposals, total };
}

export type { ProposalRow };
