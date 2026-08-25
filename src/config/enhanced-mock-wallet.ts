/**
 * Enhanced Mock Wallet for Development Testing - SIWE-Compliant Version
 *
 * This version properly handles EIP-191 personal_sign and EIP-4361 SIWE message signing
 * to work correctly with the server-side verification.
 */

import { privateKeyToAccount } from "viem/accounts";

// Mock test accounts with different holder classes and characteristics
export const MOCK_ACCOUNTS = {
  whale: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const,
    holderClass: "WHALE" as const,
    balance: "1000000.0",
    votingPower: 1000000,
    rank: 1,
    displayName: "Test Whale 🐋",
    description: "Top holder with maximum governance power",
  },
  dolphin: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const,
    holderClass: "DOLPHIN" as const,
    balance: "15000.0",
    votingPower: 15000,
    rank: 100,
    displayName: "Test Dolphin 🐬",
    description: "Mid-tier holder with significant governance influence",
  },
  fish: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const,
    holderClass: "FISH" as const,
    balance: "100.0",
    votingPower: 100,
    rank: 10000,
    displayName: "Test Fish 🐟",
    description: "Regular holder with standard governance participation",
  },
  errorTester: {
    address: "0x90F79bf6EB2c4f870365E785982E47f92493D450",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const,
    holderClass: "FISH" as const,
    balance: "1.0",
    votingPower: 1,
    rank: 25000,
    displayName: "Error Tester ⚠️",
    description: "For testing error scenarios and edge cases",
  },
};

export type MockAccountType = keyof typeof MOCK_ACCOUNTS;
export const MOCK_ACCOUNT_TYPES = Object.keys(MOCK_ACCOUNTS) as MockAccountType[];

type MockAccount = (typeof MOCK_ACCOUNTS)[MockAccountType];
type MockAccountKey = ReturnType<typeof privateKeyToAccount>;
type MockEventHandler = (payload: unknown) => void;

/** Minimal structural type for any EIP-1193 provider (ours or a real extension). */
interface Eip1193ProviderLike {
  __isEnhancedMock?: boolean;
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: MockEventHandler) => void;
  removeListener?: (event: string, handler: MockEventHandler) => void;
}

/** The full mock provider object created by {@link createMockProvider}. */
interface MockProvider extends Eip1193ProviderLike {
  __isEnhancedMock: true;
  __currentAccountType: MockAccountType;
  isMetaMask: boolean;
  chainId: string;
  selectedAddress: string;
  address: string;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: MockEventHandler): void;
  removeListener(event: string, handler: MockEventHandler): void;
  emit(event: string, payload: unknown): void;
}

/** Window globals the mock wallet installs for diagnostics/dev tooling. */
interface MockWalletGlobals {
  ethereum?: Eip1193ProviderLike;
  useMockWallet?: unknown;
  enhancedMockWalletLoaded?: boolean;
  currentMockAccount?: unknown;
}

// Current active mock account state
let currentAccountType: MockAccountType = "dolphin";
let enhancedMockWalletLoaded = false;
let originalEthereum: Eip1193ProviderLike | null = null;
const eventListeners = new Map<string, Set<MockEventHandler>>();

// The property name we'll use for our mock wallet
const MOCK_WALLET_PROPERTY = "__enhancedMockWallet";

/** Typed view of window for mock-wallet globals. Only call in browser context. */
function mockWindow(): MockWalletGlobals & Record<string, unknown> {
  return window as unknown as MockWalletGlobals & Record<string, unknown>;
}

// Helper functions for hex encoding/decoding
function hexToUtf8(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function utf8ToHex(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return "0x" + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isHexString(s: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
}

// Get current active account
function getCurrentAccount() {
  return MOCK_ACCOUNTS[currentAccountType];
}

// Emit events to registered listeners
function emit(event: string, payload: unknown) {
  eventListeners.get(event)?.forEach(fn => fn(payload));
  console.log(`[MockWallet] Event emitted: ${event}`, payload);
}

/**
 * Check if a real wallet extension is blocking installation
 */
function hasRealWalletExtension(): boolean {
  if (typeof window === "undefined") return false;

  const eth = mockWindow().ethereum;
  if (!eth) return false;

  // Check if it's a real extension (not our mock)
  if (eth.__isEnhancedMock) return false;

  // Try to check if the property is configurable
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, "ethereum");
    return descriptor?.configurable === false || descriptor?.writable === false;
  } catch {
    return true; // Assume there's an extension if we can't check
  }
}

/**
 * Check if we can safely override the existing window.ethereum
 */
function canInstallMockWallet(forceOverride: boolean): { canInstall: boolean; reason: string; needsAlternative: boolean } {
  if (process.env.NODE_ENV === "production") {
    return { canInstall: false, reason: "Production mode - mock wallet disabled", needsAlternative: false };
  }

  const hasRealExtension = hasRealWalletExtension();

  if (!hasRealExtension) {
    return { canInstall: true, reason: "No blocking wallet extension detected", needsAlternative: false };
  }

  if (forceOverride) {
    return {
      canInstall: false,
      reason: "Cannot force override - real wallet extension blocking property",
      needsAlternative: true
    };
  }

  return {
    canInstall: false,
    reason: "Real wallet extension detected - using alternative installation",
    needsAlternative: true
  };
}

/**
 * Install the enhanced mock wallet provider
 * Uses alternative property when real extension is present
 */
export function installEnhancedMockWallet(forceOverride: boolean = false): boolean {
  if (typeof window === "undefined") return false;

  const { canInstall, reason, needsAlternative } = canInstallMockWallet(forceOverride);

  if (needsAlternative) {
    console.log(`[MockWallet] Using alternative installation: ${reason}`);
    return installAlternativeMockWallet();
  }

  if (!canInstall) {
    console.warn(`[MockWallet] Installation prevented: ${reason}`);
    console.warn("[MockWallet] Real wallet detected. Try disabling browser wallet extension or use incognito mode");
    return false;
  }

  console.log(`[MockWallet] Installing mock wallet: ${reason}`);

  const account = getCurrentAccount();
  const accountKey = privateKeyToAccount(account.privateKey);

  // Create the mock provider
  const provider = createMockProvider(account, accountKey);

  // Safe installation without attempting illegal redefinitions
  try {
    // Try direct assignment first
    mockWindow().ethereum = provider;
    console.log("[MockWallet] ✅ Installed via direct assignment");
  } catch (assignmentError) {
    console.error("[MockWallet] ❌ Failed to install mock wallet:", assignmentError);
    console.error("[MockWallet] Cannot override window.ethereum - trying alternative method");
    return installAlternativeMockWallet();
  }

  finalizeInstallation(account);
  return true;
}

/**
 * Create the mock provider object with proper SIWE signing support
 */
function createMockProvider(account: MockAccount, accountKey: MockAccountKey): MockProvider {
  return {
    __isEnhancedMock: true,
    __currentAccountType: currentAccountType,
    isMetaMask: true,
    chainId: "0x7d0",
    selectedAddress: account.address,
    address: account.address,

    // Standard RPC methods
    async request({ method, params }: { method: string; params?: unknown[] }) {
      console.log(`[MockWallet] RPC: ${method}`, params);

      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts": {
          return [account.address];
        }

        case "eth_chainId": {
          return "0x7d0";
        }

        case "wallet_switchEthereumChain": {
          emit("chainChanged", "0x7d0");
          return null;
        }

        case "eth_signTypedData_v4":
        case "eth_signTypedData": {
          // SIWE message signing via typed data
          const [, typedData] = params ?? [];
          if (typeof typedData === "string" && isHexString(typedData)) {
            return await accountKey.signMessage({ message: hexToUtf8(typedData) });
          }
          return await accountKey.signMessage({ message: JSON.stringify(typedData) });
        }

        case "personal_sign": {
          // EIP-191 personal_sign: personal_sign(message, address)
          // params are typically [message, address]
          const [messageHex] = params ?? [];

          if (typeof messageHex === "string" && isHexString(messageHex)) {
            const message = hexToUtf8(messageHex);
            console.log(`[MockWallet] personal_sign message:`, message);

            // Sign using viem's signMessage which handles EIP-191 properly
            const signature = await accountKey.signMessage({ message });
            console.log(`[MockWallet] personal_sign signature:`, signature);
            return signature;
          }

          // Fallback for non-hex messages
          return await accountKey.signMessage({ message: String(messageHex ?? "") });
        }

        case "eth_sign": {
          // eth_sign is similar to personal_sign but without EIP-191 prefix
          const raw = params?.[1];
          if (typeof raw === "string" && isHexString(raw)) {
            return await accountKey.signMessage({ message: hexToUtf8(raw) });
          }
          return await accountKey.signMessage({ message: typeof raw === "string" ? raw : String(raw ?? "") });
        }

        case "wallet_addEthereumChain": {
          return null;
        }

        case "net_version": {
          return "2000";
        }

        case "eth_getBalance": {
          return utf8ToHex(account.balance);
        }

        case "eth_getTransactionCount": {
          return "0x0";
        }

        case "eth_blockNumber": {
          return "0x1";
        }

        default:
          console.warn(`[MockWallet] Unhandled method: ${method}`);
          return null;
      }
    },

    // Event emitter methods
    on(event: string, handler: MockEventHandler) {
      if (!eventListeners.has(event)) eventListeners.set(event, new Set());
      eventListeners.get(event)!.add(handler);
      console.log(`[MockWallet] Listener added for: ${event}`);
    },

    removeListener(event: string, handler: MockEventHandler) {
      eventListeners.get(event)?.delete(handler);
    },

    emit,
  };
}

/**
 * Install mock wallet to alternative property when real extension is present
 */
function installAlternativeMockWallet(): boolean {
  if (typeof window === "undefined") return false;

  console.log("[MockWallet] Installing to alternative property due to real wallet extension");

  const account = getCurrentAccount();
  const accountKey = privateKeyToAccount(account.privateKey);
  const provider = createMockProvider(account, accountKey);

  try {
    // Store our mock wallet in a separate property
    mockWindow()[MOCK_WALLET_PROPERTY] = provider;

    // Also set up ethereum to point to our mock when appropriate
    // We'll do this by creating a getter that can be controlled
    Object.defineProperty(window, "useMockWallet", {
      get() {
        return mockWindow()[MOCK_WALLET_PROPERTY];
      },
      set(value) {
        mockWindow()[MOCK_WALLET_PROPERTY] = value;
      },
      configurable: true,
    });

    console.log("[MockWallet] ✅ Installed to alternative property:", MOCK_WALLET_PROPERTY);
    console.log("[MockWallet] ℹ️  Access via window.", MOCK_WALLET_PROPERTY, "or window.useMockWallet");

    finalizeInstallation(account);
    return true;
  } catch (error) {
    console.error("[MockWallet] ❌ Alternative installation failed:", error);
    return false;
  }
}

/**
 * Finalize installation and set up global state
 */
function finalizeInstallation(account: MockAccount) {
  mockWindow().enhancedMockWalletLoaded = true;
  mockWindow().currentMockAccount = account;

  if (!enhancedMockWalletLoaded) {
    enhancedMockWalletLoaded = true;

    console.log(
      `%c🔧 Enhanced Mock Wallet Active%c\n` +
      `Account: ${account.displayName} (${account.address})\n` +
      `Holder Class: ${account.holderClass} | Balance: ${account.balance} tokens\n` +
      `Rank: #${account.rank} | Voting Power: ${account.votingPower.toLocaleString()}\n` +
      `${account.description}\n` +
      `%cSIWE-compliant signing ready!`,
      "background: #FFD700; color: #000; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
      "color: #FFD700; font-weight: bold;",
      "color: #00FF00; font-weight: bold;"
    );
  }
}

/**
 * Get the mock wallet provider (from either property)
 */
export function getMockWalletProvider(): Eip1193ProviderLike | null {
  if (typeof window === "undefined") return null;

  // Try alternative property first (when real extension is present)
  const alternativeProvider = mockWindow()[MOCK_WALLET_PROPERTY] as Eip1193ProviderLike | undefined;
  if (alternativeProvider?.__isEnhancedMock) {
    return alternativeProvider;
  }

  // Try standard ethereum property
  const ethProvider = mockWindow().ethereum;
  if (ethProvider?.__isEnhancedMock) {
    return ethProvider;
  }

  return null;
}

/**
 * Make the mock wallet the active ethereum provider
 * This temporarily overrides the real extension for development
 */
export function activateMockWalletProvider(): boolean {
  if (typeof window === "undefined") return false;

  const mockProvider = getMockWalletProvider();
  if (!mockProvider) {
    console.error("[MockWallet] No mock wallet found. Install it first.");
    return false;
  }

  try {
    // Store the real ethereum if we haven't already
    const realEth = mockWindow().ethereum;
    if (realEth && !realEth.__isEnhancedMock && !originalEthereum) {
      originalEthereum = realEth;
      console.log("[MockWallet] Stored original ethereum object");
    }

    // Try to set our mock as the active provider
    try {
      mockWindow().ethereum = mockProvider;
      console.log("[MockWallet] ✅ Mock wallet is now the active provider");
      return true;
    } catch {
      console.warn("[MockWallet] Could not set as active provider (property may be non-configurable)");
      console.log("[MockWallet] Mock wallet is available via window.", MOCK_WALLET_PROPERTY);
      return false;
    }
  } catch (error) {
    console.error("[MockWallet] Failed to activate mock provider:", error);
    return false;
  }
}

/**
 * Restore the original ethereum provider
 */
export function restoreOriginalProvider(): boolean {
  if (typeof window === "undefined") return false;

  if (originalEthereum) {
    try {
      mockWindow().ethereum = originalEthereum;
      console.log("[MockWallet] ✅ Restored original ethereum provider");
      return true;
    } catch {
      console.warn("[MockWallet] Could not restore original provider");
      return false;
    }
  }

  return false;
}

/**
 * Clean up the mock wallet
 */
export function cleanupEnhancedMockWallet() {
  if (typeof window === "undefined") return;

  console.log("[MockWallet] Cleaning up mock wallet");

  // Remove from alternative property
  try {
    delete mockWindow()[MOCK_WALLET_PROPERTY];
  } catch {}

  // Remove useMockWallet accessor
  try {
    delete mockWindow().useMockWallet;
  } catch {}

  // Try to restore original ethereum
  restoreOriginalProvider();

  // Clean up global state
  mockWindow().enhancedMockWalletLoaded = false;
  mockWindow().currentMockAccount = null;
  enhancedMockWalletLoaded = false;
  originalEthereum = null;

  console.log("[MockWallet] ✅ Cleanup complete");
}

/**
 * Switch to a different mock account type
 */
export function switchMockAccount(accountType: MockAccountType): boolean {
  if (!MOCK_ACCOUNTS[accountType]) {
    console.error(`[MockWallet] Invalid account type: ${accountType}`);
    return false;
  }

  const previousType = currentAccountType;
  currentAccountType = accountType;
  const newAccount = getCurrentAccount();

  console.log(
    `%c🔄 Account Switched%c\n` +
    `From: ${MOCK_ACCOUNTS[previousType].displayName}\n` +
    `To: ${newAccount.displayName}\n` +
    `Address: ${newAccount.address}`,
    "background: #FFD700; color: #000; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
    "color: #FFD700; font-weight: bold;"
  );

  // Update both providers (alternative and standard if applicable)
  const accountKey = privateKeyToAccount(newAccount.privateKey);

  // Update alternative provider
  const altProvider = mockWindow()[MOCK_WALLET_PROPERTY] as Eip1193ProviderLike | undefined;
  if (altProvider?.__isEnhancedMock) {
    const updatedProvider = createMockProvider(newAccount, accountKey);
    Object.assign(altProvider, updatedProvider);
  }

  // Update standard provider if it's our mock
  const stdProvider = mockWindow().ethereum;
  if (stdProvider?.__isEnhancedMock) {
    const updatedProvider = createMockProvider(newAccount, accountKey);
    Object.assign(stdProvider, updatedProvider);
  }

  // Update global state
  mockWindow().currentMockAccount = newAccount;

  // Emit account change event
  emit("accountsChanged", [newAccount.address]);

  // Trigger reconnection simulation
  emit("disconnect", null);
  setTimeout(() => {
    emit("connect", { chainId: "0x7d0" });
    emit("accountsChanged", [newAccount.address]);
  }, 100);

  return true;
}

/**
 * Get current active account info
 */
export function getCurrentMockAccount() {
  return getCurrentAccount();
}

/**
 * Get all available mock accounts
 */
export function getAllMockAccounts() {
  return MOCK_ACCOUNTS;
}

/**
 * Check if enhanced mock wallet is active
 */
export function isEnhancedMockWalletActive(): boolean {
  if (typeof window === "undefined") return false;
  return getMockWalletProvider()?.__isEnhancedMock === true;
}

/**
 * Get current account type
 */
export function getCurrentAccountType(): MockAccountType {
  return currentAccountType;
}

// Maintain backward compatibility
export { isEnhancedMockWalletActive as isDevMockWalletActive };

// Export DEV_ADDRESS for backward compatibility
export const DEV_ADDRESS = MOCK_ACCOUNTS.whale.address;
