import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Branded 404 page — shown when a route or proposal ID doesn't exist.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
        <Compass className="h-8 w-8 text-gold" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden /> Go Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/proposals">Browse Proposals</Link>
        </Button>
      </div>
    </div>
  );
}
