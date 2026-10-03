import { Loader2 } from "lucide-react";

/**
 * Root loading fallback shown while any route segment is loading.
 *
 * Centers the spinner in the visible content area on every screen size:
 * the container spans from below the fixed header to above the fixed
 * bottom nav (which only renders below `lg`), so on any device the
 * spinner lands in the true middle of the usable space. `dvh` keeps it
 * correct with mobile browser chrome (URL bar) in play.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex w-full max-lg:min-h-[calc(100dvh-9rem)] lg:min-h-[calc(100dvh-4rem)] items-center justify-center"
    >
      <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden />
    </div>
  );
}
