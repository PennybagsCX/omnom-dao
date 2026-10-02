"use client";

import { useCallback, useState } from "react";
import { Check, Link2, Send } from "lucide-react";

import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  /** App path to share, e.g. "/vote". Combined with the current origin. */
  path: string;
  /** Share text for X / Telegram prefills. */
  title: string;
  /**
   * Cache-buster appended as `?v=<version>`. Platforms cache link previews
   * per exact URL — pass something that changes per vote (e.g. the vote's
   * votingEndsAt) so every new vote shares a fresh-crawl URL and platforms
   * can never serve a previous vote's preview card.
   */
  version?: string | null;
  className?: string;
}

type ShareChannel = "x" | "telegram" | "copy";

/**
 * "2026-11-01T00:00:00.000Z" → "20261101" — a compact per-vote version for
 * `version`: stable for the life of a vote, different for the next one, so
 * every vote's share links get a URL the platforms have never cached.
 */
export function versionFromDate(iso: string | null | undefined): string | undefined {
  return iso ? iso.slice(0, 10).replace(/-/g, "") : undefined;
}

/**
 * Outbound share row for live votes: X intent, Telegram share, and copy-link.
 * Every click fires a fire-and-forget `share_click` event to the first-party
 * traffic endpoint (best-effort — sharing must work even if the endpoint
 * doesn't respond; nothing here surfaces an error UI).
 */
export function ShareButtons({ path, title, version: versionProp, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const track = useCallback((channel: ShareChannel) => {
    try {
      void fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "share_click",
          channel,
          path,
        }),
      }).catch(() => {});
    } catch {
      // Analytics must never break sharing.
    }
  }, [path]);

  const shareUrl = useCallback(() => {
    const version = versionProp ? `?v=${encodeURIComponent(versionProp)}` : "";
    if (typeof window === "undefined") return `${path}${version}`;
    return `${window.location.origin}${path}${version}`;
  }, [path, versionProp]);

  const onX = useCallback(() => {
    track("x");
    const url = encodeURIComponent(shareUrl());
    const text = encodeURIComponent(title);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareUrl, title, track]);

  const onTelegram = useCallback(() => {
    track("telegram");
    const url = encodeURIComponent(shareUrl());
    const text = encodeURIComponent(title);
    window.open(
      `https://t.me/share/url?url=${url}&text=${text}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [shareUrl, title, track]);

  const onCopy = useCallback(async () => {
    track("copy");
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context). No-op.
    }
  }, [shareUrl, track]);

  const base =
    "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold sm:min-h-9";

  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
      data-testid="share-buttons"
    >
      <button type="button" onClick={onX} className={base} aria-label="Share on X">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share on X
      </button>
      <button type="button" onClick={onTelegram} className={base} aria-label="Share on Telegram">
        <Send className="h-3.5 w-3.5" aria-hidden /> Telegram
      </button>
      <button
        type="button"
        onClick={onCopy}
        className={base}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" aria-hidden /> Copied
          </>
        ) : (
          <>
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Copy link
          </>
        )}
      </button>
    </div>
  );
}
