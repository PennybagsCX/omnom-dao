// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { CountdownTimer } from "@/components/shared/countdown-timer";

const REAL_NOW = Date.now;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
  Date.now = REAL_NOW;
});

describe("<CountdownTimer />", () => {
  it("displays the segmented days/hours/minutes/seconds remaining", () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds in the future
    const end = new Date("2026-06-16T14:03:04.000Z").toISOString();
    render(<CountdownTimer endsAt={end} />);
    const timer = screen.getByRole("timer");
    expect(timer).toBeInTheDocument();
    expect(timer.textContent).toContain("01");
    expect(timer.textContent).toContain("d");
    expect(timer.textContent).toContain("h");
  });

  it("turns red (text-danger) when less than 24h remain", () => {
    // 2 hours in the future
    const end = new Date("2026-06-15T14:00:00.000Z").toISOString();
    const { container } = render(<CountdownTimer endsAt={end} />);
    expect(container.querySelector(".text-danger")).not.toBeNull();
  });

  it("stays non-red when more than 24h remain", () => {
    const end = new Date("2026-06-20T12:00:00.000Z").toISOString();
    const { container } = render(<CountdownTimer endsAt={end} />);
    // No text-danger in the segmented numeric block.
    const dangerNumeric = container.querySelector(".font-mono.text-danger");
    expect(dangerNumeric).toBeNull();
  });

  it("shows 'Ended' when the timestamp is in the past", () => {
    const end = new Date("2026-06-10T00:00:00.000Z").toISOString();
    render(<CountdownTimer endsAt={end} />);
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("updates the seconds segment over time", () => {
    const end = new Date("2026-06-15T12:00:10.000Z").toISOString(); // 10s
    render(<CountdownTimer endsAt={end} />);
    // Initial seconds = 10
    expect(screen.getByRole("timer").textContent).toContain("10");
    // Advance 5 seconds and flush React state updates via act.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    // After re-render the seconds segment drops to ~5
    expect(screen.getByRole("timer").textContent).toContain("05");
  });

  it("compact mode renders a label string with the clock icon", () => {
    const end = new Date("2026-06-16T14:00:00.000Z").toISOString();
    const { container } = render(<CountdownTimer endsAt={end} compact />);
    // The clock is now a scalable SVG icon (lucide Clock).
    expect(container.querySelector("svg.lucide-clock")).not.toBeNull();
    // Compact shows an "Xd Yh left" style label.
    expect(screen.getByText(/left/)).toBeInTheDocument();
  });
});
