// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoteBar } from "@/components/shared/vote-bar";

describe("<VoteBar />", () => {
  it("renders the three proportions as segment widths", () => {
    const { container } = render(<VoteBar votesFor={60} votesAgainst={30} votesAbstain={10} />);
    const segments = container.querySelectorAll(".h-full.transition-all");
    expect(segments).toHaveLength(3);
    expect((segments[0] as HTMLElement).style.width).toBe("60%");
    expect((segments[1] as HTMLElement).style.width).toBe("30%");
    expect((segments[2] as HTMLElement).style.width).toBe("10%");
  });

  it("exposes an aria-label with the rounded percentages", () => {
    render(<VoteBar votesFor={60} votesAgainst={30} votesAbstain={10} />);
    const bar = screen.getByRole("img");
    expect(bar).toHaveAttribute("aria-label", "For 60.0%, Against 30.0%, Abstain 10.0%");
  });

  it("renders zero segments when all votes are zero", () => {
    const { container } = render(<VoteBar votesFor={0} votesAgainst={0} votesAbstain={0} />);
    expect(container.querySelectorAll(".h-full.transition-all")).toHaveLength(0);
    // All three legend items show 0.0%.
    expect(screen.getAllByText("0.0%")).toHaveLength(3);
  });

  it("shows counts and percentages in the legend by default", () => {
    render(<VoteBar votesFor={1000} votesAgainst={0} votesAbstain={0} />);
    expect(screen.getByText("For")).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(screen.getByText(/\(1,000\)/)).toBeInTheDocument();
  });

  it("hides the legend when showLabels is false", () => {
    render(<VoteBar votesFor={1} votesAgainst={0} votesAbstain={0} showLabels={false} />);
    expect(screen.queryByText("For")).not.toBeInTheDocument();
  });

  it("applies design-system color classes (emerald/rose/slate)", () => {
    const { container } = render(<VoteBar votesFor={1} votesAgainst={1} votesAbstain={1} />);
    const segments = container.querySelectorAll(".h-full.transition-all");
    expect((segments[0] as HTMLElement).className).toContain("bg-emerald-500");
    expect((segments[1] as HTMLElement).className).toContain("bg-rose-500");
    expect((segments[2] as HTMLElement).className).toContain("bg-slate-500");
  });
});
