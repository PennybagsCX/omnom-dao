// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalStatusBadge } from "@/components/shared/proposal-status-badge";
import { PROPOSAL_STATUS_CONFIG } from "@/lib/constants";
import { ProposalStatus } from "@/types";

describe("<ProposalStatusBadge />", () => {
  it.each(Object.values(ProposalStatus))("renders label + icon for status %s", (status) => {
    const cfg = PROPOSAL_STATUS_CONFIG[status];
    const { container, unmount } = render(<ProposalStatusBadge status={status} />);
    expect(screen.getByText(cfg.label)).toBeInTheDocument();
    // Emoji is now a scalable lucide-react SVG icon rendered via <DynamicIcon />.
    expect(container.querySelector("svg")).not.toBeNull();
    unmount();
  });

  it("applies the active status badge classes", () => {
    render(<ProposalStatusBadge status={ProposalStatus.ACTIVE} />);
    const badge = screen.getByText(PROPOSAL_STATUS_CONFIG[ProposalStatus.ACTIVE].label).closest("span");
    expect(badge?.className).toContain("bg-emerald-500/15");
    expect(badge?.className).toContain("border");
  });

  it("applies the failed status rose classes", () => {
    render(<ProposalStatusBadge status={ProposalStatus.FAILED} />);
    const badge = screen.getByText("Failed").closest("span");
    expect(badge?.className).toContain("bg-rose-500/15");
  });

  it("adds the pulse-glow animation only for ACTIVE when pulse is set", () => {
    const { rerender } = render(<ProposalStatusBadge status={ProposalStatus.ACTIVE} pulse />);
    let badge = screen.getByText("Active").closest("span");
    expect(badge?.className).toContain("animate-pulse-glow");

    // Closed status with pulse should NOT get the animation class.
    rerender(<ProposalStatusBadge status={ProposalStatus.CLOSED} pulse />);
    badge = screen.getByText("Closed").closest("span");
    expect(badge?.className).not.toContain("animate-pulse-glow");
  });

  it("does not pulse ACTIVE when pulse prop is omitted", () => {
    render(<ProposalStatusBadge status={ProposalStatus.ACTIVE} />);
    const badge = screen.getByText("Active").closest("span");
    expect(badge?.className).not.toContain("animate-pulse-glow");
  });
});
