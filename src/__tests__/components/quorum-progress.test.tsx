// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuorumProgress } from "@/components/shared/quorum-progress";

describe("<QuorumProgress />", () => {
  it("shows the met state when achieved >= required", () => {
    render(<QuorumProgress achieved={15} required={10} />);
    expect(screen.getByText(/Quorum reached/)).toBeInTheDocument();
  });

  it("shows the not-met state when achieved < required", () => {
    render(<QuorumProgress achieved={5} required={10} />);
    expect(screen.getByText("Quorum not yet reached")).toBeInTheDocument();
  });

  it("renders the achieved / required percentages", () => {
    render(<QuorumProgress achieved={5} required={10} />);
    expect(screen.getByText("5.00% / 10.00%")).toBeInTheDocument();
  });

  it("fills the progress bar relative to the required threshold", () => {
    const { container } = render(<QuorumProgress achieved={5} required={10} />);
    const fill = container.querySelector(".h-full.rounded-full") as HTMLElement;
    expect(fill).not.toBeNull();
    // 5/10 = 50%
    expect(fill.style.width).toBe("50%");
  });

  it("caps the visual width at 100% when achieved exceeds required", () => {
    const { container } = render(<QuorumProgress achieved={30} required={10} />);
    const fill = container.querySelector(".h-full.rounded-full") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("uses the success color class when quorum is met", () => {
    const { container } = render(<QuorumProgress achieved={15} required={10} />);
    const fill = container.querySelector(".h-full.rounded-full") as HTMLElement;
    expect(fill.className).toContain("bg-success");
  });

  it("uses the warning color class when quorum is not met", () => {
    const { container } = render(<QuorumProgress achieved={5} required={10} />);
    const fill = container.querySelector(".h-full.rounded-full") as HTMLElement;
    expect(fill.className).toContain("bg-warning");
  });

  it("exposes progressbar role with aria-valuenow/max", () => {
    render(<QuorumProgress achieved={5} required={10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
  });
});
