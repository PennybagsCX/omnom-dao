/**
 * Simple Development Authentication - 7-Tier Holder Class Version
 *
 * Comprehensive mock accounts covering all 7 holder tiers (KRAKEN through SEAHORSE).
 * Default account remains 'dolphin' to maintain high-impact proposal creation capability.
 *
 * All addresses verified via viem privateKeyToAddress from standard anvil keys.
 */

const MOCK_ACCOUNTS = {
  kraken: {
    walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    holderClass: "KRAKEN" as const,
    votingPower: 1200000000000,
    displayName: "Test Kraken 🦑",
    balance: "1200000000000.0",
    rank: 1,
  },
  whale: {
    walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    holderClass: "WHALE" as const,
    votingPower: 250000000000,
    displayName: "Test Whale 🐋",
    balance: "250000000000.0",
    rank: 2,
  },
  dolphin: {
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    holderClass: "DOLPHIN" as const,
    votingPower: 50000000000,
    displayName: "Test Dolphin 🐬",
    balance: "50000000000.0",
    rank: 50,
  },
  shark: {
    walletAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    holderClass: "SHARK" as const,
    votingPower: 500000000,
    displayName: "Test Shark 🦈",
    balance: "500000000.0",
    rank: 500,
  },
  octopus: {
    walletAddress: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    holderClass: "OCTOPUS" as const,
    votingPower: 50000000,
    displayName: "Test Octopus 🐙",
    balance: "50000000.0",
    rank: 5000,
  },
  crab: {
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    holderClass: "CRAB" as const,
    votingPower: 5000000,
    displayName: "Test Crab 🦀",
    balance: "5000000.0",
    rank: 10000,
  },
  seahorse: {
    walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    holderClass: "SEAHORSE" as const,
    votingPower: 1000,
    displayName: "Test Seahorse 🦄",
    balance: "1000.0",
    rank: 25000,
  },
};

export type MockAccountType = keyof typeof MOCK_ACCOUNTS;
export const MOCK_ACCOUNT_TYPES = Object.keys(MOCK_ACCOUNTS) as MockAccountType[];

export async function devLogin(accountType: MockAccountType = 'dolphin') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('devLogin is only available in development mode');
  }

  const account = MOCK_ACCOUNTS[accountType];
  if (!account) {
    throw new Error(`Invalid account type: ${accountType}`);
  }

  try {
    const response = await fetch('/api/v1/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        walletAddress: account.walletAddress,
        holderClass: account.holderClass,
        votingPower: account.votingPower,
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Dev login failed');
    }

    console.log('✅ Dev login successful:', account.walletAddress);

    return {
      success: true,
      account: { ...account, ...data.session },
      session: data.session,
      snapshot: data.snapshot
    };
  } catch (error) {
    console.error('❌ Dev login failed:', error);
    throw error;
  }
}

export function getMockAccounts() {
  return MOCK_ACCOUNTS;
}

export function getMockAccount(accountType: MockAccountType) {
  return MOCK_ACCOUNTS[accountType];
}
