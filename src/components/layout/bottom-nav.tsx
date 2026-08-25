"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { PRIMARY_NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Mobile and Tablet bottom navigation - Clean, modern design
 * 
 * Breakpoint Strategy:
 * - Mobile & Tablets (< 1024px): Visible
 * - Desktop (1024px+): Hidden (top nav provides navigation)
 */
export function BottomNav() {
  const pathname = usePathname();

  const anyExactMatch = PRIMARY_NAV_ITEMS.some((i) => i.href === pathname);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href ||
        (pathname.startsWith(href + "/") && !anyExactMatch);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-bg-deep/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const isCreate = item.href === "/proposals/create";

          if (isCreate) {
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all hover:scale-105"
                >
                  <span className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 transition-all",
                    active && "bg-gold/30 scale-110",
                  )}>
                    <DynamicIcon
                      name={item.iconName}
                      aria-hidden
                      className="h-5 w-5 text-gold transition-transform"
                    />
                  </span>
                  <span className={cn(
                    "transition-colors",
                    active ? "text-gold font-medium" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-all hover:scale-105",
                  active ? "text-gold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <DynamicIcon
                  name={item.iconName}
                  aria-hidden
                  className={cn(
                    "h-5 w-5 transition-transform",
                    active && "scale-110",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
