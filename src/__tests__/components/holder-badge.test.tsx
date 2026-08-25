// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HolderBadge } from "@/components/shared/holder-badge";
import { HolderClass } from "@/types";

describe("<HolderBadge />", () => {
  it("renders the whale emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.WHALE} />);
    expect(screen.getByText("🐋")).toBeInTheDocument();
    expect(screen.getByText("Whale")).toBeInTheDocument();
  });

  it("renders the dolphin emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.DOLPHIN} />);
    expect(screen.getByText("🐬")).toBeInTheDocument();
    expect(screen.getByText("Dolphin")).toBeInTheDocument();
  });

  it("renders the fish emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.FISH} />);
    expect(screen.getByText("🐟")).toBeInTheDocument();
    expect(screen.getByText("Fish")).toBeInTheDocument();
  });

  it("applies the whale amber color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.WHALE} />);
    expect(container.querySelector("span")?.className).toContain("text-amber-400");
  });

  it("applies the dolphin sky color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.DOLPHIN} />);
    expect(container.querySelector("span")?.className).toContain("text-sky-400");
  });

  it("applies the fish slate color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.FISH} />);
    expect(container.querySelector("span")?.className).toContain("text-slate-400");
  });

  it("renders the plain variant without the pill background", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.WHALE} plain />);
    const badge = container.querySelector("span");
    expect(badge?.className).not.toContain("rounded-full");
  });

  it("renders the pill variant with a rounded-full background", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.WHALE} />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("rounded-full");
    expect(badge?.className).toContain("bg-amber-500/15");
  });
});
