import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAuth, UnauthorizedError } from "@/lib/auth";
import { isAdminAddress } from "@/lib/constants";
import { db } from "@/lib/db";
import { ErrorCode } from "@/types";

/**
 * GET /api/v1/admin/events/summary
 *
 * Admin-only aggregate view of the first-party traffic stream
 * (traffic_events) over the trailing 30 days, backing the "Campaign traffic"
 * card on /admin. Read-only; no raw rows leave the API — aggregates only.
 *
 * Returns: total page views, total share clicks, breakdown by share channel,
 * breakdown by UTM source (+ campaign), and per-day page-view counts for
 * /vote (the Wave 1 Referendum hub).
 */

const WINDOW_DAYS = 30;

interface ChannelCount {
  channel: string;
  count: number;
}

interface UtmCount {
  source: string;
  campaign: string | null;
  count: number;
}

interface DayCount {
  date: string;
  count: number;
}

export interface TrafficSummary {
  windowDays: number;
  totalPageViews: number;
  totalShareClicks: number;
  byChannel: ChannelCount[];
  byUtmSource: UtmCount[];
  votePerDay: DayCount[];
}

/** Number of rows returned per breakdown — keeps the card bounded. */
const MAX_BREAKDOWN_ROWS = 10;

export async function GET(_request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(err.code, undefined, err.statusCode);
    }
    throw err;
  }
  if (!isAdminAddress(session.sub)) {
    return apiError(ErrorCode.NOT_VERIFIED, "Admin access required.", 403);
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Totals by event type (page_view / share_click).
  const totalsRes = await db.execute({
    sql: `SELECT type, COUNT(*) AS cnt FROM traffic_events
          WHERE created_at >= ? GROUP BY type`,
    args: [since],
  });

  let totalPageViews = 0;
  let totalShareClicks = 0;
  for (const row of totalsRes.rows) {
    if (row.type === "page_view") totalPageViews = Number(row.cnt ?? 0);
    if (row.type === "share_click") totalShareClicks = Number(row.cnt ?? 0);
  }

  // Share-channel breakdown (x / telegram / copy).
  const channelRes = await db.execute({
    sql: `SELECT channel, COUNT(*) AS cnt FROM traffic_events
          WHERE created_at >= ? AND type = 'share_click' AND channel IS NOT NULL
          GROUP BY channel ORDER BY cnt DESC LIMIT ?`,
    args: [since, MAX_BREAKDOWN_ROWS],
  });
  const byChannel: ChannelCount[] = channelRes.rows.map((row) => ({
    channel: String(row.channel),
    count: Number(row.cnt ?? 0),
  }));

  // UTM attribution — source + campaign pairs, most-served first.
  const utmRes = await db.execute({
    sql: `SELECT utm_source, utm_campaign, COUNT(*) AS cnt FROM traffic_events
          WHERE created_at >= ? AND type = 'page_view' AND utm_source IS NOT NULL
          GROUP BY utm_source, utm_campaign ORDER BY cnt DESC LIMIT ?`,
    args: [since, MAX_BREAKDOWN_ROWS],
  });
  const byUtmSource: UtmCount[] = utmRes.rows.map((row) => ({
    source: String(row.utm_source),
    campaign: row.utm_campaign == null ? null : String(row.utm_campaign),
    count: Number(row.cnt ?? 0),
  }));

  // Per-day page views for the /vote hub (created_at is ISO — day = first 10 chars).
  const perDayRes = await db.execute({
    sql: `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS cnt FROM traffic_events
          WHERE created_at >= ? AND type = 'page_view' AND path = '/vote'
          GROUP BY day ORDER BY day ASC`,
    args: [since],
  });
  const votePerDay: DayCount[] = perDayRes.rows.map((row) => ({
    date: String(row.day),
    count: Number(row.cnt ?? 0),
  }));

  return apiSuccess<TrafficSummary>({
    windowDays: WINDOW_DAYS,
    totalPageViews,
    totalShareClicks,
    byChannel,
    byUtmSource,
    votePerDay,
  });
}
