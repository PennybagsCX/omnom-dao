/**
 * Simple Development Authentication - Restore Working Version
 * 
 * Back to the simple version that was working before we started overcomplicating things.
 */

const MOCK_ACCOUNTS = {
  whale: {
    walletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    holderClass: "WHALE" as const,
    votingPower: 1000000,
    displayName: "Test Whale 🐋",
    balance: "1000000.0",
    rank: 1,
  },
  dolphin: {
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    holderClass: "DOLPHIN" as const,
    votingPower: 15000,
    displayName: "Test Dolphin 🐬",
    balance: "15000.0",
    rank: 100,
  },
  fish: {
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    holderClass: "FISH" as const,
    votingPower: 100,
    displayName: "Test Fish 🐟",
    balance: "100.0",
    rank: 10000,
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
