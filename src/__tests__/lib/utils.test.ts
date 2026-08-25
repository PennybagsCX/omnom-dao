import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatAddress,
  formatDateTime,
  formatPercentage,
  formatTokenAmount,
  formatTokenAmountCompact,
  formatDate,
  getTimeRemaining,
  isValidAddress,
  shortenAddress,
  timeAgo,
} from "@/lib/utils";

const VALID = "0x5b38da6a701c568545dcfcb03fcb875f56beddc4";

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("dedupes conflicting tailwind utilities (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("isValidAddress", () => {
  it.each([
    ["valid lowercase", VALID, true],
    ["valid checksummed", "0x5B38Da6a701c568545dCfCb03FcB875f56BEdDc4", true],
    ["too short", "0x1234", false],
    ["missing 0x", "5b38da6a701c568545dcfcb03fcb875f56beddc4", false],
    ["empty", "", false],
    ["non-hex chars", "0xZZZZa6a701c568545dcfcb03fcb875f56beddc4", false],
  ])("%s -> %s", (_label, input, expected) => {
    expect(isValidAddress(input)).toBe(expected);
  });
});

describe("shortenAddress / formatAddress", () => {
  it("truncates to 0x1234…abcd by default (chars=4)", () => {
    expect(shortenAddress(VALID)).toBe("0x5b38…ddc4");
  });

  it("respects custom chars", () => {
    expect(shortenAddress(VALID, 6)).toBe("0x5b38da…beddc4");
  });

  it("returns input unchanged for invalid addresses", () => {
    expect(shortenAddress("not-an-address")).toBe("not-an-address");
  });

  it("formatAddress is an alias of shortenAddress", () => {
    expect(formatAddress(VALID)).toBe(shortenAddress(VALID));
    expect(formatAddress(VALID, 2)).toBe(shortenAddress(VALID, 2));
  });
});

describe("formatTokenAmount", () => {
  it("formats whole + fraction for 18 decimals", () => {
    // 1.5 tokens
    expect(formatTokenAmount(1_500_000_000_000_000_000n)).toBe("1.5");
  });

  it("adds thousands separators to the whole part", () => {
    // 1,234 tokens
    expect(formatTokenAmount(1_234_000_000_000_000_000_000n)).toBe("1,234");
  });

  it("trims trailing zeros in the fraction", () => {
    expect(formatTokenAmount(1_230_000_000_000_000_000n)).toBe("1.23");
  });

  it("respects displayDigits (slices, no rounding)", () => {
    expect(formatTokenAmount(1_234_567_000_000_000_000n, 18, 3)).toBe("1.234");
  });

  it("accepts string balance input", () => {
    expect(formatTokenAmount("1500000000000000000")).toBe("1.5");
  });

  it("formats zero", () => {
    expect(formatTokenAmount(0n)).toBe("0");
  });

  it("returns integer-only when decimals <= 0", () => {
    expect(formatTokenAmount(12345n, 0)).toBe("12,345");
  });
});

describe("formatTokenAmountCompact", () => {
  it("formats large values with compact notation", () => {
    // 2,000,000 tokens -> "2M"
    expect(formatTokenAmountCompact(2_000_000_000_000_000_000_000_000n)).toBe("2M");
  });

  it("formats thousands as K", () => {
    expect(formatTokenAmountCompact(5_000_000_000_000_000_000_000n)).toBe("5K");
  });
});

describe("timeAgo", () => {
  const NOW = new Date("2026-06-15T12:00:00.000Z");
  const realNow = Date.now;

  function minutesAgo(min: number): string {
    return new Date(NOW.getTime() - min * 60_000).toISOString();
  }
  function daysAgo(days: number): string {
    return new Date(NOW.getTime() - days * 86_400_000).toISOString();
  }

  beforeEach(() => {
    Date.now = () => NOW.getTime();
  });
  afterEach(() => {
    Date.now = realNow;
  });

  it("returns 'just now' under 60s", () => {
    expect(timeAgo(minutesAgo(0.5))).toBe("just now");
  });
  it("returns minutes", () => {
    expect(timeAgo(minutesAgo(3))).toBe("3 minutes ago");
    expect(timeAgo(minutesAgo(1))).toBe("1 minute ago");
  });
  it("returns hours", () => {
    expect(timeAgo(minutesAgo(120))).toBe("2 hours ago");
  });
  it("returns days", () => {
    expect(timeAgo(daysAgo(3))).toBe("3 days ago");
  });
  it("returns weeks", () => {
    expect(timeAgo(daysAgo(14))).toBe("2 weeks ago");
  });
  it("returns months", () => {
    expect(timeAgo(daysAgo(60))).toBe("2 months ago");
  });
  it("returns years", () => {
    expect(timeAgo(daysAgo(400))).toBe("1 year ago");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formats an absolute date", () => {
    expect(formatDate("2026-06-07T23:59:58.000Z")).toMatch(/Jun.*7.*2026/);
  });
  it("formats a date + time", () => {
    expect(formatDateTime("2026-06-07T23:59:58.000Z")).toContain("2026");
  });
});

describe("formatPercentage", () => {
  it("formats with default 2 digits and trailing %", () => {
    expect(formatPercentage(13.789)).toBe("13.79%");
  });
  it("respects custom digits", () => {
    expect(formatPercentage(13.789, 0)).toBe("14%");
  });
});

describe("getTimeRemaining", () => {
  const NOW_MS = new Date("2026-06-15T12:00:00.000Z").getTime();
  const realNow = Date.now;
  beforeEach(() => {
    Date.now = () => NOW_MS;
  });
  afterEach(() => {
    Date.now = realNow;
  });

  it("returns ended state when the timestamp is in the past", () => {
    const r = getTimeRemaining("2026-06-10T00:00:00.000Z");
    expect(r.ended).toBe(true);
    expect(r.label).toBe("Ended");
  });

  it("computes days/hours/minutes/seconds for a future end", () => {
    // 2 days, 3 hours, 4 minutes, 5 seconds in the future
    const end = new Date(NOW_MS + (((2 * 24 + 3) * 60 + 4) * 60 + 5) * 1000).toISOString();
    const r = getTimeRemaining(end);
    expect(r.ended).toBe(false);
    expect(r.days).toBe(2);
    expect(r.hours).toBe(3);
    expect(r.minutes).toBe(4);
    expect(r.seconds).toBe(5);
    expect(r.label).toContain("2d");
  });

  it("uses an hours/minutes label when under a day", () => {
    const end = new Date(NOW_MS + 5 * 3_600_000 + 2 * 60_000).toISOString();
    const r = getTimeRemaining(end);
    expect(r.label).toContain("5h");
  });
});
