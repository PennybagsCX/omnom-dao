import { describe, expect, it } from "vitest";
import {
  addressSchema,
  castVoteSchema,
  createCommentSchema,
  createDelegationSchema,
  createProposalSchema,
  getProposalsSchema,
  nonceRequestSchema,
  updateDisplayNameSchema,
  userSettingsSchema,
  verifyWalletSchema,
} from "@/lib/validators";
import { ProposalType, VoteChoice } from "@/types";

const ADDR = "0x5b38da6a701c568545dcfcb03fcb875f56beddc4";

describe("addressSchema", () => {
  it("accepts a valid address and lowercases it", () => {
    expect(addressSchema.parse("0x5B38Da6a701c568545dCfCb03FcB875f56BEdDc4")).toBe(ADDR);
  });
  it("rejects an invalid address", () => {
    expect(() => addressSchema.parse("0xnope")).toThrow();
  });
});

describe("nonceRequestSchema", () => {
  it("accepts a valid address body", () => {
    expect(nonceRequestSchema.parse({ address: ADDR })).toEqual({ address: ADDR });
  });
  it("rejects a missing/invalid address", () => {
    expect(() => nonceRequestSchema.parse({ address: "bad" })).toThrow();
  });
});

describe("verifyWalletSchema", () => {
  it("accepts a message + hex signature", () => {
    expect(verifyWalletSchema.safeParse({ message: "m", signature: "0xdeadbeef" }).success).toBe(true);
  });
  it("rejects a non-hex signature", () => {
    expect(verifyWalletSchema.safeParse({ message: "m", signature: "nope" }).success).toBe(false);
  });
  it("rejects an empty message", () => {
    expect(verifyWalletSchema.safeParse({ message: "", signature: "0xdeadbeef" }).success).toBe(false);
  });
});

describe("createProposalSchema", () => {
  const valid = {
    title: "A valid proposal title",
    description: "This is a sufficiently long description body for the proposal.",
    type: ProposalType.GENERAL,
  };

  it("accepts a valid minimal proposal", () => {
    expect(createProposalSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a title shorter than 10 chars", () => {
    expect(createProposalSchema.safeParse({ ...valid, title: "short" }).success).toBe(false);
  });

  it("rejects a title longer than 200 chars", () => {
    expect(createProposalSchema.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
  });

  it("rejects a description shorter than 50 chars", () => {
    expect(createProposalSchema.safeParse({ ...valid, description: "too short" }).success).toBe(false);
  });

  it("rejects an invalid proposal type", () => {
    expect(createProposalSchema.safeParse({ ...valid, type: "NUKE_EVERYTHING" }).success).toBe(false);
  });

  it("accepts optional quorum and duration within range", () => {
    expect(
      createProposalSchema.safeParse({ ...valid, quorumRequired: 25, durationHours: 168 }).success,
    ).toBe(true);
  });

  it("rejects duration outside the 1–720 range", () => {
    expect(createProposalSchema.safeParse({ ...valid, durationHours: 0 }).success).toBe(false);
    expect(createProposalSchema.safeParse({ ...valid, durationHours: 9999 }).success).toBe(false);
  });
});

describe("getProposalsSchema", () => {
  it("applies defaults for paging/sort", () => {
    const r = getProposalsSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(20);
    expect(r.sortBy).toBe("createdAt");
    expect(r.sortOrder).toBe("desc");
  });

  it("coerces numeric query params from strings", () => {
    const r = getProposalsSchema.parse({ page: "3", pageSize: "5" });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(5);
  });

  it("rejects pageSize over 100 (hard max, no clamping)", () => {
    expect(getProposalsSchema.safeParse({ pageSize: "9999" }).success).toBe(false);
    expect(getProposalsSchema.parse({ pageSize: "100" }).pageSize).toBe(100);
  });

  it("rejects an unknown sortBy", () => {
    expect(getProposalsSchema.safeParse({ sortBy: "random" }).success).toBe(false);
  });
});

describe("castVoteSchema", () => {
  it("accepts a valid choice", () => {
    expect(castVoteSchema.safeParse({ proposalId: "p1", choice: VoteChoice.FOR }).success).toBe(true);
  });
  it("rejects an invalid choice", () => {
    expect(castVoteSchema.safeParse({ proposalId: "p1", choice: "MAYBE" }).success).toBe(false);
  });
  it("rejects an empty proposalId", () => {
    expect(castVoteSchema.safeParse({ proposalId: "", choice: VoteChoice.FOR }).success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    expect(createCommentSchema.safeParse({ proposalId: "p1", content: "nice" }).success).toBe(true);
  });
  it("rejects empty content", () => {
    expect(createCommentSchema.safeParse({ proposalId: "p1", content: "" }).success).toBe(false);
  });
  it("rejects content over 2000 chars", () => {
    expect(createCommentSchema.safeParse({ proposalId: "p1", content: "x".repeat(2001) }).success).toBe(false);
  });
  it("accepts an optional parentId", () => {
    expect(createCommentSchema.safeParse({ proposalId: "p1", content: "reply", parentId: "c1" }).success).toBe(true);
  });
  it("accepts null parentId explicitly", () => {
    expect(createCommentSchema.safeParse({ proposalId: "p1", content: "x", parentId: null }).success).toBe(true);
  });
});

describe("createDelegationSchema", () => {
  it("accepts a valid delegatee address", () => {
    expect(createDelegationSchema.safeParse({ delegateeAddress: ADDR }).success).toBe(true);
  });
  it("rejects an invalid delegatee address", () => {
    expect(createDelegationSchema.safeParse({ delegateeAddress: "0xnope" }).success).toBe(false);
  });
});

describe("updateDisplayNameSchema", () => {
  it("accepts a 1–30 char name", () => {
    expect(updateDisplayNameSchema.safeParse({ displayName: "Whale" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(updateDisplayNameSchema.safeParse({ displayName: "" }).success).toBe(false);
  });
  it("rejects a name over 30 chars", () => {
    expect(updateDisplayNameSchema.safeParse({ displayName: "x".repeat(31) }).success).toBe(false);
  });
});

describe("userSettingsSchema", () => {
  const valid = {
    notifications: {
      proposalCreated: true,
      votingStarted: true,
      votingEndingSoon: false,
      proposalResult: true,
      mention: true,
    },
    preferredWallet: null,
    displayFormat: "full" as const,
  };
  it("accepts a valid settings object", () => {
    expect(userSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an unknown displayFormat", () => {
    expect(userSettingsSchema.safeParse({ ...valid, displayFormat: "alien" }).success).toBe(false);
  });
  it("rejects a missing notification flag", () => {
    const bad = { ...valid, notifications: { ...valid.notifications, mention: undefined } };
    expect(userSettingsSchema.safeParse(bad).success).toBe(false);
  });
});
