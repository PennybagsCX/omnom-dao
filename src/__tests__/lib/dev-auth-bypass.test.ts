import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  devLogin,
  getMockAccount,
  getMockAccounts,
  MOCK_ACCOUNT_TYPES,
} from "@/lib/dev-auth-bypass";

const fetchMock = vi.fn();

const ACCOUNTS = {
  kraken: {
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    holderClass: "KRAKEN",
    votingPower: 1200000000000,
    displayName: "Test Kraken 🦑",
  },
  whale: {
    walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    holderClass: "WHALE",
    votingPower: 250000000000,
    displayName: "Test Whale 🐋",
  },
  dolphin: {
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    holderClass: "DOLPHIN",
    votingPower: 50000000000,
    displayName: "Test Dolphin 🐬",
  },
  shark: {
    walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    holderClass: "SHARK",
    votingPower: 500000000,
    displayName: "Test Shark 🦈",
  },
  octopus: {
    walletAddress: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    holderClass: "OCTOPUS",
    votingPower: 50000000,
    displayName: "Test Octopus 🐙",
  },
  crab: {
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    holderClass: "CRAB",
    votingPower: 5000000,
    displayName: "Test Crab 🦀",
  },
  seahorse: {
    walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    holderClass: "SEAHORSE",
    votingPower: 1000,
    displayName: "Test Seahorse 🦄",
  },
} as const;

describe("dev-auth-bypass (development-only helper)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "development" });
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    vi.unstubAllGlobals();
  });

  describe("mock account catalog", () => {
    it("exposes all 7 holder tiers", () => {
      expect([...MOCK_ACCOUNT_TYPES].sort()).toEqual(["crab", "dolphin", "kraken", "octopus", "seahorse", "shark", "whale"]);
      const accounts = getMockAccounts();
      for (const type of MOCK_ACCOUNT_TYPES) {
        expect(accounts[type].walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(accounts[type].holderClass).toBe(ACCOUNTS[type].holderClass);
        expect(accounts[type].votingPower).toBe(ACCOUNTS[type].votingPower);
        expect(accounts[type].displayName).toBe(ACCOUNTS[type].displayName);
      }
    });

    it("getMockAccount returns the entry by type", () => {
      expect(getMockAccount("whale").votingPower).toBe(250000000000);
      expect(getMockAccount("dolphin").rank).toBe(50);
      expect(getMockAccount("kraken").displayName).toBe("Test Kraken 🦑");
    });
  });

  describe("devLogin", () => {
    it("refuses to run in production", async () => {
      Object.assign(process.env, { NODE_ENV: "production" });
      await expect(devLogin("whale")).rejects.toThrow(
        "devLogin is only available in development mode",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an unknown account type", async () => {
      await expect(
        devLogin("robot" as "whale"),
      ).rejects.toThrow("Invalid account type: robot");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("defaults to the dolphin account", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, session: { sub: "0x7099" } }),
      } as Response);

      await devLogin();

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/dev-login");
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("include");
      expect(JSON.parse(init.body as string)).toEqual({
        walletAddress: ACCOUNTS.dolphin.walletAddress,
        holderClass: "DOLPHIN",
        votingPower: 50000000000,
      });
    });

    it("merges the session into the returned account", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session: { sub: "0xf39F", holderClass: "WHALE" },
          snapshot: { totalHolders: 3 },
        }),
      } as Response);

      const result = await devLogin("whale");
      expect(result.success).toBe(true);
      expect(result.session).toEqual({ sub: "0xf39F", holderClass: "WHALE" });
      expect(result.snapshot).toEqual({ totalHolders: 3 });
      expect(result.account).toMatchObject({
        walletAddress: ACCOUNTS.whale.walletAddress,
        sub: "0xf39F",
      });
    });

    it("surfaces the server error message on failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: { message: "Dev login disabled" },
        }),
      } as Response);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(devLogin("seahorse")).rejects.toThrow("Dev login disabled");
      errorSpy.mockRestore();
    });

    it("falls back to a generic message when the server sends none", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      } as Response);
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(devLogin("crab")).rejects.toThrow("Dev login failed");
    });
  });
});
