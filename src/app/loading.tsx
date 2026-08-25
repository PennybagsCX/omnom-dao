import { Loader2 } from "lucide-react";

/**
 * Root loading fallback shown while any route segment is loading.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gold" aria-label="Loading" />
    </div>
  );
}
