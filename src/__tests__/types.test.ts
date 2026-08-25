import { describe, expect, it } from "vitest";
import {
  ApiError,
  ApiResponse,
  ChainSelectionMeta,
  ErrorCode,
  HolderClass,
  ProposalMetadata,
  ProposalStatus,
  ProposalType,
  TechnicalMeta,
  TokenomicsChangeMeta,
  TreasuryMeta,
  VoteChoice,
} from "@/types";

/**
 * Type-level + value tests for the central type barrel.
 * These exercise the discriminated-union narrowing on `ProposalMetadata` and
 * the `ApiResponse<T>` envelope shape.
 */

describe("enums have stable string values", () => {
  it.each([
    [HolderClass.WHALE, "WHALE"],
    [HolderClass.DOLPHIN, "DOLPHIN"],
    [HolderClass.FISH, "FISH"],
  ])("%s serializes to %s", (en, val) => {
    expect(en).toBe(val as HolderClass);
  });

  it.each([
    [VoteChoice.FOR, "FOR"],
    [VoteChoice.AGAINST, "AGAINST"],
    [VoteChoice.ABSTAIN, "ABSTAIN"],
  ])("%s serializes to %s", (en, val) => {
    expect(en).toBe(val as VoteChoice);
  });

  it("ProposalStatus.ACTIVE is 'ACTIVE'", () => {
    expect(ProposalStatus.ACTIVE).toBe("ACTIVE");
  });
  it("ProposalType.GENERAL is 'GENERAL'", () => {
    expect(ProposalType.GENERAL).toBe("GENERAL");
  });
});

describe("ProposalMetadata discriminated union", () => {
  function narrow(m: ProposalMetadata): string {
    switch (m.type) {
      case "CHAIN_SELECTION":
        return `chain:${m.candidateChains.length}`;
      case "TOKENOMICS_CHANGE":
        return `tokenomics:${m.changeType}`;
      case "TREASURY":
        return `treasury:${m.amount}`;
      case "TECHNICAL":
        return `tech:${m.specification}`;
      case "base":
        return `base:${m.links.length}`;
      default:
        return "unknown";
    }
  }

  it("narrows ChainSelectionMeta", () => {
    const m: ChainSelectionMeta = {
      type: "CHAIN_SELECTION",
      links: [],
      tags: [],
      candidateChains: [{ chainId: 1, chainName: "Ethereum", rationale: "why" }],
    };
    expect(narrow(m)).toBe("chain:1");
  });

  it("narrows TokenomicsChangeMeta (burn)", () => {
    const m: TokenomicsChangeMeta = {
      type: "TOKENOMICS_CHANGE",
      links: [],
      tags: [],
      changeType: "burn",
      targetAmount: "1000",
      description: "burn it",
    };
    expect(narrow(m)).toBe("tokenomics:burn");
  });

  it("narrows TreasuryMeta", () => {
    const m: TreasuryMeta = {
      type: "TREASURY",
      links: [],
      tags: [],
      amount: "500",
      purpose: "fund X",
    };
    expect(narrow(m)).toBe("treasury:500");
  });

  it("narrows TechnicalMeta", () => {
    const m: TechnicalMeta = {
      type: "TECHNICAL",
      links: [],
      tags: [],
      specification: "spec text",
    };
    expect(narrow(m)).toBe("tech:spec text");
  });

  it("narrows BaseMeta fallback", () => {
    const m = { type: "base", links: ["a"], tags: [] } as ProposalMetadata;
    expect(narrow(m)).toBe("base:1");
  });
});

describe("ApiResponse<T> envelope shape", () => {
  it("success envelope carries data + meta", () => {
    const ok: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: "1" },
      meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    };
    expect(ok.success).toBe(true);
    expect(ok.data?.id).toBe("1");
    expect(ok.error).toBeUndefined();
  });

  it("error envelope carries an ApiError code", () => {
    const err: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: "slow down",
        details: ["retry-after: 60"],
      },
    };
    expect(err.success).toBe(false);
    expect(err.error?.code).toBe(ErrorCode.RATE_LIMITED);
    expect(err.error).toBeDefined();
    expect(err.data).toBeUndefined();
  });

  it("ApiError optionally omits details", () => {
    const apiError: ApiError = { code: ErrorCode.INTERNAL_ERROR, message: "boom" };
    expect(apiError.details).toBeUndefined();
  });

  it("ErrorCode covers all documented status families", () => {
    const codes = Object.values(ErrorCode);
    expect(codes).toContain(ErrorCode.UNAUTHORIZED);
    expect(codes).toContain(ErrorCode.RATE_LIMITED);
    expect(codes).toContain(ErrorCode.ALREADY_VOTED);
  });
});
