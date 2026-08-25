"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary — catches unhandled errors in any route segment and
 * shows a branded fallback instead of a white screen. The user can retry
 * or navigate back home.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OMNOM] Unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset} variant="outline">
          <RotateCcw className="h-4 w-4" aria-hidden /> Try Again
        </Button>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
