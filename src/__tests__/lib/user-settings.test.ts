import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { execute: executeMock },
}));

import { getUserIdByAddress, getUserSettings } from "@/lib/user-settings";

function result(rows: Record<string, unknown>[]) {
  return { rows, columns: Object.keys(rows[0] ?? {}), rowsAffected: 0 };
}

const settingsRow = {
  user_id: "u-1",
  notif_proposal_created: 1,
  notif_voting_started: 0,
  notif_voting_ending_soon: 1,
  notif_proposal_result: 1,
  notif_mention: 0,
  preferred_wallet: "metamask",
  display_format: "full",
};

describe("user-settings", () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  describe("getUserSettings", () => {
    it("maps an existing row to the typed settings shape", async () => {
      executeMock.mockResolvedValueOnce(result([settingsRow]));

      const settings = await getUserSettings("u-1");
      expect(settings).toEqual({
        userId: "u-1",
        notifications: {
          proposalCreated: true,
          votingStarted: false,
          votingEndingSoon: true,
          proposalResult: true,
          mention: false,
        },
        preferredWallet: "metamask",
        displayFormat: "full",
      });
    });

    it("treats NULL notification flags as default-on (explicit opt-out only)", async () => {
      executeMock.mockResolvedValueOnce(
        result([
          {
            ...settingsRow,
            notif_proposal_created: null,
            notif_voting_started: null,
            notif_voting_ending_soon: null,
            notif_proposal_result: null,
            notif_mention: null,
          },
        ]),
      );

      const settings = await getUserSettings("u-1");
      expect(settings.notifications).toEqual({
        proposalCreated: true,
        votingStarted: true,
        votingEndingSoon: true,
        proposalResult: true,
        mention: true,
      });
    });

    it("lazily creates a default row on first access", async () => {
      executeMock.mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([]));

      const settings = await getUserSettings("u-new");
      expect(settings).toEqual({
        userId: "u-new",
        notifications: {
          proposalCreated: true,
          votingStarted: true,
          votingEndingSoon: true,
          proposalResult: true,
          mention: true,
        },
        preferredWallet: null,
        displayFormat: "abbreviated",
      });

      const insert = executeMock.mock.calls[1]![0] as { sql: string; args: string[] };
      expect(insert.sql).toContain("INSERT INTO user_settings");
      expect(insert.sql).toContain("ON CONFLICT(user_id) DO NOTHING");
      expect(insert.args).toEqual(["u-new"]);
    });

    it("defaults null channel fields to null", async () => {
      executeMock.mockResolvedValueOnce(
        result([
          {
            ...settingsRow,
            telegram_chat_id: null,
            telegram_username: null,
            email_address: null,
            preferred_wallet: null,
            display_format: null,
          },
        ]),
      );

      const settings = await getUserSettings("u-1");
      expect(settings.preferredWallet).toBeNull();
      expect(settings.displayFormat).toBe("abbreviated");
    });

    it("queries keyed by the internal user id", async () => {
      executeMock.mockResolvedValueOnce(result([settingsRow]));
      await getUserSettings("u-1");
      const call = executeMock.mock.calls[0]![0] as { sql: string; args: string[] };
      expect(call.sql).toContain("FROM user_settings WHERE user_id = ?");
      expect(call.args).toEqual(["u-1"]);
    });
  });

  describe("getUserIdByAddress", () => {
    it("returns the id for a known address, lowercasing the input", async () => {
      executeMock.mockResolvedValueOnce(result([{ id: "u-9" }]));
      expect(await getUserIdByAddress("0xABCDEF")).toBe("u-9");
      const call = executeMock.mock.calls[0]![0] as { sql: string; args: string[] };
      expect(call.sql).toContain("FROM users WHERE wallet_address = ?");
      expect(call.args).toEqual(["0xabcdef"]);
    });

    it("returns null for an unknown address", async () => {
      executeMock.mockResolvedValueOnce(result([]));
      expect(await getUserIdByAddress("0xunknown")).toBeNull();
    });
  });
});
