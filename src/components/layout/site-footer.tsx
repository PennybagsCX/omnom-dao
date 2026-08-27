import { GitFork } from "lucide-react";

import { SNAPSHOT } from "@/lib/constants";

/**
 * Clean site footer with essential info only - no navigation links
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg-surface pb-16 md:pb-0">
      {/* Essential info section */}
      <div className="border-t border-border px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs text-text-dim">
            Ever-Held Master · 11 Snapshots ·{" "}
            {new Date(SNAPSHOT.timestamp).toISOString().slice(0, 10)} – 2026-08-08 ·{" "}
            {SNAPSHOT.totalHolders.toLocaleString()} holders
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span><span className="text-gold">OMNOM</span><span className="text-foreground">DAO</span> — Community Governance</span>
            <span className="text-text-dim">·</span>
            <a
              href="https://github.com/DBOT-DC/omnom-dao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-gold"
            >
              <GitFork className="h-3.5 w-3.5" aria-hidden />
              Open Source
            </a>
            <span className="text-text-dim">·</span>
            <span className="text-foreground">MIT Licensed</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
