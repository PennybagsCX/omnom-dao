import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional Tailwind class names, resolving conflicts intelligently.
 * Composes clsx (conditionals) with tailwind-merge (dedupe conflicting utils).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** EVM address regex (basic shape check before checksum validation). */
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Returns true when `address` looks like a valid EVM address. */
export function isValidAddress(address: string): boolean {
  return ADDRESS_REGEX.test(address);
}

/**
 * Truncate an EVM address to the `0x1234…5678` format.
 * Falls back to the input when it is not a recognizable address.
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!isValidAddress(address)) return address;
  const prefix = address.slice(0, 2 + chars);
  const suffix = address.slice(-chars);
  return `${prefix}…${suffix}`;
}

/**
 * Format an EVM address for display with a copy-friendly truncation.
 * Alias of {@link shortenAddress} for semantic clarity.
 */
export function formatAddress(address: string, chars = 4): string {
  return shortenAddress(address, chars);
}

/**
 * Format a raw-wei balance (string | bigint) into a human-readable token amount
 * with thousands separators and fixed decimals.
 *
 * @param balanceRaw  Raw wei amount (18 decimals).
 * @param decimals    Token decimals (default 18).
 * @param displayDigits  Max fraction digits to show.
 */
export function formatTokenAmount(
  balanceRaw: bigint | string,
  decimals = 18,
  displayDigits = 3,
): string {
  const raw = typeof balanceRaw === "string" ? BigInt(balanceRaw) : balanceRaw;
  if (decimals <= 0) {
    return new Intl.NumberFormat("en-US").format(Number(raw));
  }
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionStr = fraction.toString().padStart(decimals, "0");
  const trimmed = fractionStr.slice(0, displayDigits).replace(/0+$/, "");
  const wholeFormatted = new Intl.NumberFormat("en-US").format(Number(whole));
  return trimmed.length > 0 ? `${wholeFormatted}.${trimmed}` : wholeFormatted;
}

/**
 * Compact token formatter for large balances, e.g. 1.2M, 3.4K.
 */
export function formatTokenAmountCompact(
  balanceRaw: bigint | string,
  decimals = 18,
): string {
  const raw = typeof balanceRaw === "string" ? BigInt(balanceRaw) : balanceRaw;
  const base = 10n ** BigInt(decimals);
  const value = Number(raw) / Number(base);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Relative "time ago" string, e.g. "3 hours ago", "2 days ago".
 */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * Absolute date formatting, e.g. "Jun 7, 2026".
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date + time, e.g. "Jun 7, 2026, 11:59 PM".
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a percentage value with fixed decimals and a trailing %.
 */
export function formatPercentage(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

/**
 * Remaining-time countdown object for a voting window end.
 */
export interface TimeRemaining {
  ended: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
}

/**
 * Compute a human-readable countdown to an ISO end timestamp.
 */
export function getTimeRemaining(endIso: string): TimeRemaining {
  const end = new Date(endIso).getTime();
  const diffMs = end - Date.now();

  if (diffMs <= 0) {
    return { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0, label: "Ended" };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  let label: string;
  if (days > 0) label = `${days}d ${hours}h left`;
  else if (hours > 0) label = `${hours}h ${minutes}m left`;
  else label = `${minutes}m ${seconds}s left`;

  return { ended: false, days, hours, minutes, seconds, label };
}

/**
 * Compact number formatter for large values.
 *
 * Uses Intl compact notation: 1,234,567 → "1.2M", 12,500 → "12.5K",
 * 1,000,000,000 → "1B". Falls back to the full number for values < 1,000.
 *
 * Accepts either a number or a formatted string like "1,234.5".
 */
export function formatCompact(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (Number.isNaN(num)) return String(value);
  if (Math.abs(num) < 1000) {
    // Show up to 1 decimal for sub-1000 values that have a fractional part.
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}
