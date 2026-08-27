"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { ShieldCheck, ChevronDown, LogOut, Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { useCurrentUser } from "@/lib/api";
import { useWalletDialog } from "@/components/wallet/siwe-auth-flow";
import { ACCOUNT_NAV_ITEMS, isAdminAddress } from "@/lib/constants";
import { isDevMockWalletActive } from "@/config/dev-mock-provider";
import { cn } from "@/lib/utils";
import { useUnreadNotificationCount } from "@/lib/delegation-api";

/**
 * Wallet Connection Button that works with both JWT sessions (dev auth) and
 * SIWE-authenticated wallet connections.
 */
export function ConnectWalletButton() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: me } = useCurrentUser({ retry: false });
  const { connect } = useWalletDialog();
  const pathname = usePathname();

  const connectedButUnverified = Boolean(address) && !me;
  const isAuthenticated = Boolean(me);

  // Fetch notifications for authenticated users
  const { data: countData } = useUnreadNotificationCount(isAuthenticated);
  const unreadCount = countData?.unreadCount ?? 0;

  const handleVerifyHoldings = () => {
    if (connectedButUnverified) {
      connect();
      return;
    }
    router.push("/verify/result");
    router.refresh();
  };

  const handleSignOut = async () => {
    disconnect();
    qc.removeQueries({ queryKey: ["me"] });
    qc.removeQueries({ queryKey: ["dashboard"] });
    qc.clear();

    if (isDevMockWalletActive()) {
      window.location.href = "/api/v1/logout?next=/";
      return;
    }

    try {
      await fetch("/api/v1/logout", { method: "POST" });
    } catch {
      // Best-effort; proceed to navigate regardless.
    }
    router.push("/");
    router.refresh();
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal: _, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div
            {...(!mounted && !isAuthenticated
              ? {
                  "aria-hidden": true,
                  style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                }
              : {})}
            className="flex items-center gap-2"
          >
            {(() => {
              // If authenticated via JWT (dev auth), show user state even without wallet connection
              if (isAuthenticated && me) {
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" type="button" className="font-mono">
                        {me.displayName || me.address.slice(0, 6)}
                        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={24} align="end" className="w-56">
                      <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                        {me.class} - Dev Auth
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {ACCOUNT_NAV_ITEMS.filter(
                        (item) => item.href !== "/admin" || isAdminAddress(me.address),
                      ).map((item) => {
                        const active =
                          item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);
                        return (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "cursor-pointer",
                                active && "text-gold",
                              )}
                            >
                              <DynamicIcon
                                name={item.iconName}
                                aria-hidden
                                className="mr-2 h-4 w-4"
                              />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      
                      {/* Notifications Section */}
                      <DropdownMenuItem asChild>
                        <Link
                          href="/notifications"
                          className="cursor-pointer"
                        >
                          <Bell className="mr-2 h-4 w-4" aria-hidden />
                          <span className="flex-1">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="ml-auto rounded-full bg-danger/15 px-1.5 py-0.5 text-xs font-medium text-danger">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </Link>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" aria-hidden />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              if (!connected) {
                return (
                  <Button onClick={connect} size="sm" type="button">
                    Connect Wallet
                  </Button>
                );
              }
              if (chain.unsupported) {
                return (
                  <Button onClick={openAccountModal} size="sm" variant="destructive" type="button">
                    Unsupported network — verify from any network
                  </Button>
                );
              }
              return (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" type="button" className="font-mono">
                        {account.displayName}
                        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={24} align="end" className="w-56">
                      <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                        Account
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      {ACCOUNT_NAV_ITEMS.filter(
                        (item) => item.href !== "/admin" || (address && isAdminAddress(address)),
                      ).map((item) => {
                        const active =
                          item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);
                        return (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "cursor-pointer",
                                active && "text-gold",
                              )}
                            >
                              <DynamicIcon
                                name={item.iconName}
                                aria-hidden
                                className="mr-2 h-4 w-4"
                              />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      
                      {/* Notifications Section */}
                      <DropdownMenuItem asChild>
                        <Link
                          href="/notifications"
                          className="cursor-pointer"
                        >
                          <Bell className="mr-2 h-4 w-4" aria-hidden />
                          <span className="flex-1">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="ml-auto rounded-full bg-danger/15 px-1.5 py-0.5 text-xs font-medium text-danger">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </Link>
                      </DropdownMenuItem>
                      
                      
                      {/* Wallet Actions */}
                      <DropdownMenuItem
                        onClick={handleVerifyHoldings}
                        className="cursor-pointer"
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                        Verify Holdings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={openAccountModal}
                        className="cursor-pointer"
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                        Manage Wallet
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" aria-hidden />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
