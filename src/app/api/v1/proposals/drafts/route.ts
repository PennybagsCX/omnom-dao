import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { apiSuccess, apiError } from "@/lib/api-response";
import { ErrorCode } from "@/types";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET  /api/v1/proposals/drafts     — list current user's drafts (most recent first)
 * POST /api/v1/proposals/drafts     — create or update a draft
 *
 * Drafts are private workspaces. Each draft is keyed to the authenticated
 * wallet address; the listing returns only the caller's own drafts. Drafts
 * are NEVER returned to other users, and they never appear in the public
 * `/api/v1/proposals` listing — even when status would normally include them.
 *
 * Auto-save semantics: the client posts a partial draft every ~3 seconds of
 * inactivity. Each POST is idempotent on the `(id, wallet_address)` tuple:
 *   - If `id` is omitted, a fresh draft row is created and the new id returned.
 *   - If `id` is provided and belongs to the caller, the row is updated.
 *   - If `id` is provided but belongs to a different wallet, 404 is returned.
 *
 * Cross-device sync: sign in from any device → drafts appear.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROPOSAL_TYPES = [
  "CHAIN_SELECTION",
  "TOKENOMICS_CHANGE",
  "TREASURY",
  "GUIDELINE",
  "TECHNICAL",
  "GENERAL",
] as const;

const DraftInputSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  type: z.enum(PROPOSAL_TYPES).default("GENERAL"),
  title: z.string().max(200).default(""),
  summary: z.string().max(500).default(""),
  bodyMarkdown: z.string().max(20_000).default(""),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  durationHours: z.number().int().min(24).max(720).default(168),
  quorumRequired: z.number().min(1).max(50).default(10),
});

export async function GET(_request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) {
      return apiError(
        ErrorCode.UNAUTHORIZED,
        (err as { message?: string }).message,
        (err as { statusCode: number }).statusCode,
      );
    }
    throw err;
  }
  const wallet = session.sub.toLowerCase();

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT id, wallet_address, type, title, summary, body_markdown, tags,
                 duration_hours, quorum_required, created_at, updated_at
          FROM proposal_drafts
          WHERE wallet_address = ?
          ORDER BY updated_at DESC
          LIMIT 100`,
    args: [wallet],
  });

  const drafts = result.rows.map((row) => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    summary: row.summary as string,
    bodyMarkdown: row.body_markdown as string,
    tags: safeParseTags(row.tags as string),
    durationHours: row.duration_hours as number,
    quorumRequired: row.quorum_required as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return apiSuccess({ drafts });
}

export async function POST(request: NextRequest): Promise<Response> {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) {
      return apiError(
        ErrorCode.UNAUTHORIZED,
        (err as { message?: string }).message,
        (err as { statusCode: number }).statusCode,
      );
    }
    throw err;
  }
  const wallet = session.sub.toLowerCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.VALIDATION_ERROR, "Invalid JSON body", 400);
  }
  const parsed = DraftInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid draft payload",
      400,
      [parsed.error.flatten()],
    );
  }
  const input = parsed.data;
  const db = getDb();
  const tagsJson = JSON.stringify(input.tags);

  // If an id was supplied, verify ownership before updating.
  if (input.id) {
    const existing = await db.execute({
      sql: "SELECT wallet_address FROM proposal_drafts WHERE id = ?",
      args: [input.id],
    });
    const row = existing.rows[0];
    if (!row) {
      return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Draft not found.", 404);
    }
    if ((row.wallet_address as string).toLowerCase() !== wallet) {
      // Don't disclose ownership to a non-owner; surface 404 to avoid info leak.
      return apiError(ErrorCode.PROPOSAL_NOT_FOUND, "Draft not found.", 404);
    }
    await db.execute({
      sql: `UPDATE proposal_drafts
            SET type = ?, title = ?, summary = ?, body_markdown = ?,
                tags = ?, duration_hours = ?, quorum_required = ?,
                updated_at = datetime('now')
            WHERE id = ? AND wallet_address = ?`,
      args: [
        input.type,
        input.title,
        input.summary,
        input.bodyMarkdown,
        tagsJson,
        input.durationHours,
        input.quorumRequired,
        input.id,
        wallet,
      ],
    });
    return apiSuccess({ id: input.id, created: false });
  }

  // No id → create a new draft row. The DEFAULT (lower(hex(randomblob(16))))
  // generates a 32-char hex id in SQLite/Turso.
  const inserted = await db.execute({
    sql: `INSERT INTO proposal_drafts
            (wallet_address, type, title, summary, body_markdown, tags,
             duration_hours, quorum_required)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      wallet,
      input.type,
      input.title,
      input.summary,
      input.bodyMarkdown,
      tagsJson,
      input.durationHours,
      input.quorumRequired,
    ],
  });
  const newId = (inserted.rows[0]?.id as string | undefined) ?? null;
  if (!newId) {
    return apiError(ErrorCode.INTERNAL_ERROR, "Failed to create draft.", 500);
  }
  return apiSuccess({ id: newId, created: true });
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}