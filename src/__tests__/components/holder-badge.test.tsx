// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HolderBadge } from "@/components/shared/holder-badge";
import { HolderClass } from "@/types";

describe("<HolderBadge />", () => {
  it("renders the kraken emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.KRAKEN} />);
    expect(screen.getByText("🦑")).toBeInTheDocument();
    expect(screen.getByText("Kraken")).toBeInTheDocument();
  });

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

  it("renders the shark emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.SHARK} />);
    expect(screen.getByText("🦈")).toBeInTheDocument();
    expect(screen.getByText("Shark")).toBeInTheDocument();
  });

  it("renders the octopus emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.OCTOPUS} />);
    expect(screen.getByText("🐙")).toBeInTheDocument();
    expect(screen.getByText("Octopus")).toBeInTheDocument();
  });

  it("renders the crab emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.CRAB} />);
    expect(screen.getByText("🦀")).toBeInTheDocument();
    expect(screen.getByText("Crab")).toBeInTheDocument();
  });

  it("renders the seahorse emoji + label", () => {
    render(<HolderBadge holderClass={HolderClass.SEAHORSE} />);
    expect(screen.getByText("🦄")).toBeInTheDocument();
    expect(screen.getByText("Seahorse")).toBeInTheDocument();
  });

  it("applies the kraken fuchsia color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.KRAKEN} />);
    expect(container.querySelector("span")?.className).toContain("text-fuchsia-400");
  });

  it("applies the whale amber color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.WHALE} />);
    expect(container.querySelector("span")?.className).toContain("text-amber-400");
  });

  it("applies the dolphin sky color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.DOLPHIN} />);
    expect(container.querySelector("span")?.className).toContain("text-sky-400");
  });

  it("applies the shark indigo color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.SHARK} />);
    expect(container.querySelector("span")?.className).toContain("text-indigo-400");
  });

  it("applies the octopus violet color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.OCTOPUS} />);
    expect(container.querySelector("span")?.className).toContain("text-violet-400");
  });

  it("applies the crab orange color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.CRAB} />);
    expect(container.querySelector("span")?.className).toContain("text-orange-400");
  });

  it("applies the seahorse slate color class on the badge root", () => {
    const { container } = render(<HolderBadge holderClass={HolderClass.SEAHORSE} />);
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
    expect(badge?.className).toContain("bg-amber-500/10");
  });
});
