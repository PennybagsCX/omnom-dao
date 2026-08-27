import { test as base } from "@playwright/test";

/**
 * Authentication fixtures for E2E testing.
 *
 * Provides pre-authenticated browser contexts for testing authenticated flows
 * like voting, vote-change, and other user-specific features.
 *
 * This fixture uses the existing dev-login API endpoint (/api/v1/dev-login)
 * to create real authenticated sessions that work with the actual JWT/session system.
 *
 * The dev-login endpoint creates sessions for wallet addresses in the mock snapshot
 * or accepts custom holderClass/votingPower for testing.
 *
 * Usage:
 *   test.extend(fixtures) in your test file
 *   use authenticated as a fixture in tests
 */

interface AuthFixtures {
  authenticated: void;
}

// Mock wallet addresses from the 7-tier mock snapshot data for testing
// All verified via viem privateKeyToAddress from standard anvil keys
const TEST_WALLET_ADDRESSES = {
  KRAKEN: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65", // 1.2T OMNOM, rank #1
  WHALE: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // 250B OMNOM, rank #2
  DOLPHIN: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8", // 50B OMNOM, rank #50 (DEFAULT)
  SHARK: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc", // 500M OMNOM, rank #500
  OCTOPUS: "0x976ea74026e726554db657fa54763abd0c3a0aa9", // 50M OMNOM, rank #5000
  CRAB: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc", // 5M OMNOM, rank #10000
  SEAHORSE: "0x90f79bf6eb2c4f870365e785982e1f101e93b906", // 1K OMNOM, rank #25000
};

export const test = base.extend<AuthFixtures>({
  authenticated: async ({ page }, use) => {
    const res = await page.request.post("/api/v1/dev-login",
      { data: { walletAddress: TEST_WALLET_ADDRESSES.DOLPHIN } });
    if (!res.ok()) throw new Error(`dev-login failed: ${res.status}`);
    const me = await page.request.get("/api/v1/me");
    if (!me.ok()) throw new Error("session verification failed");
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture, not React
    await use();
  },
});

export { expect } from "@playwright/test";
export { TEST_WALLET_ADDRESSES };
