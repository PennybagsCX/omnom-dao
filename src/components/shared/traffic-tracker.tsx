"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * First-party traffic beacon for the Wave 1 Referendum campaign.
 *
 * Mounted once in the root layout. On every route change to a tracked
 * surface (/vote, /proposals/[id]) it POSTs a `page_view` to
 * /api/v1/events with:
 *
 *   - UTM attribution — current URL params win; otherwise the FIRST-touch
 *     UTM persisted in localStorage is used as a fallback (so a visitor who
 *     arrives via an x.com link and returns directly later is still
 *     attributed to the campaign).
 *   - document.referrer (the document-level referrer — stable across
 *     client-side navigations within the SPA).
 *   - a client-generated session id (UUID, persisted in localStorage).
 *
 * The POST is keepalive + fire-and-forget: failures are swallowed so
 * analytics can never break or slow down browsing.
 *
 * Companion contract: <ShareButtons /> POSTs `share_click` events to the
 * same endpoint itself — { type: "share_click", channel: "x" | "telegram" | "copy" }.
 *
 * The Suspense boundary is required: useSearchParams bails out of static
 * prerendering, and during `next build` a page using it without Suspense
 * fails the build. Keeping the boundary inside this component means the
 * layout needs only the bare <TrafficTracker />.
 */

const EVENTS_ENDPOINT = "/api/v1/events";

const SESSION_STORAGE_KEY = "omnom_traffic_session_id";
const FIRST_TOUCH_UTM_KEY = "omnom_traffic_first_touch_utm";

const UTM_KEYS = ["utm_source", "utm_campaign", "utm_medium"] as const;

type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** Campaign surfaces — /vote hub and proposal detail pages. */
function isTrackedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/vote" || /^\/proposals\/[^/]+$/.test(pathname);
}

function readSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked (private mode, hardened browsers) — ephemeral id.
    return crypto.randomUUID();
  }
}

function readStoredFirstTouchUtm(): Utm | null {
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_UTM_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const utm: Utm = {};
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) utm[key] = value;
    }
    return Object.keys(utm).length > 0 ? utm : null;
  } catch {
    return null;
  }
}

/** First touch wins — an existing stored UTM is never overwritten. */
function storeFirstTouchUtm(utm: Utm): void {
  if (Object.keys(utm).length === 0) return;
  try {
    if (window.localStorage.getItem(FIRST_TOUCH_UTM_KEY)) return;
    window.localStorage.setItem(FIRST_TOUCH_UTM_KEY, JSON.stringify(utm));
  } catch {
    // Storage unavailable — attribution just loses its fallback.
  }
}

function utmFromSearchParams(searchParams: URLSearchParams): Utm {
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) utm[key] = value.slice(0, 128);
  }
  return utm;
}

function TrafficTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Guards against double-fires of the effect for the same location
  // (React strict mode re-runs effects in development).
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!isTrackedPath(pathname)) return;
    const locationKey = pathname + (searchParams.size > 0 ? `?${searchParams.toString()}` : "");
    if (lastTracked.current === locationKey) return;
    lastTracked.current = locationKey;

    const currentUtm = utmFromSearchParams(searchParams);
    const storedUtm = readStoredFirstTouchUtm();
    if (Object.keys(currentUtm).length > 0) storeFirstTouchUtm(currentUtm);

    const referrer = typeof document !== "undefined" ? document.referrer : "";
    const body = JSON.stringify({
      type: "page_view",
      path: pathname,
      ...(Object.keys(currentUtm).length > 0 || storedUtm
        ? { ...storedUtm, ...currentUtm }
        : {}),
      ...(referrer ? { referrer: referrer.slice(0, 512) } : {}),
      session_id: readSessionId(),
    });

    fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Swallowed by design — analytics must never disturb the visit.
    });
  }, [pathname, searchParams]);

  return null;
}

export function TrafficTracker() {
  return (
    <Suspense fallback={null}>
      <TrafficTrackerInner />
    </Suspense>
  );
}
