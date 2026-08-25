"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { PRIMARY_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Clean Professional Navigation Header
 * 
 * Breakpoint Strategy:
 * - Mobile & Tablets (< 1024px): Logo + Wallet only (bottom nav provides navigation)
 * - Desktop (1024px+): Logo + Full Navigation + Wallet
 */
export function SiteHeader() {
  const pathname = usePathname();

  const anyExactMatch = PRIMARY_NAV_ITEMS.some((i) => i.href === pathname);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href ||
        (pathname.startsWith(href + "/") && !anyExactMatch);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-bg-deep/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo - Clean typography */}
        <Link
          href="/"
          className="flex shrink-0 items-center text-base font-bold tracking-tight text-foreground transition-opacity hover:opacity-80 sm:text-lg lg:text-xl"
        >
          <span className="text-gold">OMNOM</span>
          <span className="text-foreground">DAO</span>
        </Link>

        {/* Navigation - Desktop only (1024px+) */}
        <nav className="hidden items-center gap-3 lg:flex lg:gap-6">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Clean, modern base styles
                  "group relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 lg:text-sm",
                  
                  // Subtle hover effects - no folder tab look
                  "hover:bg-bg-elevated/50 hover:text-foreground",
                  
                  // Active state
                  active
                    ? "text-gold"
                    : "text-muted-foreground",
                )}
              >
                <DynamicIcon
                  name={item.iconName}
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:scale-110 lg:h-4.5 lg:w-4.5"
                />
                <span className="relative">{item.label}</span>
                
                {/* Minimal active indicator */}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-gold/80" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Section */}
        <div className="flex shrink-0 items-center relative z-50">
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
