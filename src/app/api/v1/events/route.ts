import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { ErrorCode } from "@/types";

/**
 * POST /api/v1/events — first-party traffic beacon (public, no auth).
 *
 * One endpoint for every client-side analytics event:
 *
 *   - `page_view` — fired by <TrafficTracker /> on /vote and /proposals/[id]
 *     route changes, with UTM attribution (first-touch fallback persisted in
 *     localStorage), referrer, and a client-generated session id.
 *   - `share_click` — fired by <ShareButtons /> when the user clicks an
 *     outbound share button: { type: "share_click", channel: "x" | "telegram" | "copy" }.
 *
 * Contract: the endpoint NEVER blocks or errors the client on its happy path.
 * A well-formed body always gets 204 — the insert is fire-and-forget and a
 * failed write is swallowed (analytics must not break browsing). Only a
 * malformed body (400) or an exhausted rate limit (429) is rejected.
 *
 * Privacy: no wallet address, no IP stored. Free-text fields are truncated
 * server-side (path ≤ 512, UTM ≤ 128) so an oversized payload can neither
 * fail the insert nor bloat the table.
 */

/** Per-IP beacon window — generous for real navigation, tight against spam. */
const EVENTS_RATE_LIMIT = 120;
const EVENTS_RATE_WINDOW_SECONDS = 60;

/** Length caps applied server-side by truncation (mirror the table's intent). */
const MAX_PATH_LENGTH = 512;
const MAX_UTM_LENGTH = 128;
const MAX_CHANNEL_LENGTH = 32;
const MAX_REFERRER_LENGTH = 512;
const MAX_SESSION_ID_LENGTH = 64;

/**
 * `type` is the only hard-validation rule — an unrecognized event kind is
 * garbage and gets a 400. Every free-text field is length-capped (not
 * rejected) after parsing so an oversized beacon is truncated, never bounced.
 */
const trafficEventSchema = z.object({
  type: z.enum(["page_view", "share_click"]),
  path: z.string().optional(),
  utm_source: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_medium: z.string().optional(),
  channel: z.string().optional(),
  referrer: z.string().optional(),
  session_id: z.string().optional(),
});

type TrafficEvent = z.infer<typeof trafficEventSchema>;

/** Truncate an optional free-text field to its cap; empty → undefined. */
function capped(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function eventBucket(ip: string): string {
  return `rl:events:${ip}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(ErrorCode.MISSING_FIELDS, "Invalid JSON body.", 400);
  }

  const parsed = trafficEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message, 400);
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimit(eventBucket(ip), EVENTS_RATE_LIMIT, EVENTS_RATE_WINDOW_SECONDS);
  if (!rl.allowed) {
    return apiError(ErrorCode.RATE_LIMITED, "Too many events. Slow down.", 429);
  }

  const event: TrafficEvent = parsed.data;

  // Fire-and-forget: the response is 204 regardless of the write outcome so a
  // Turso hiccup can never surface to (or slow down) a visitor.
  db.execute({
    sql: `INSERT INTO traffic_events
            (id, type, path, utm_source, utm_campaign, utm_medium, channel, referrer, session_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      event.type,
      capped(event.path, MAX_PATH_LENGTH),
      capped(event.utm_source, MAX_UTM_LENGTH),
      capped(event.utm_campaign, MAX_UTM_LENGTH),
      capped(event.utm_medium, MAX_UTM_LENGTH),
      event.type === "share_click" ? capped(event.channel, MAX_CHANNEL_LENGTH) : null,
      capped(event.referrer, MAX_REFERRER_LENGTH),
      capped(event.session_id, MAX_SESSION_ID_LENGTH),
      new Date().toISOString(),
    ],
  }).catch(() => {
    // Swallowed by design — analytics writes must never error the client.
  });

  return new NextResponse(null, { status: 204 });
}
