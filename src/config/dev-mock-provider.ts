/**
 * Legacy compatibility layer for the enhanced mock wallet.
 * 
 * This file maintains backward compatibility with existing code that imports
 * from the old dev-mock-provider path while redirecting to the enhanced system.
 */

export {
  installEnhancedMockWallet as installDevMockProvider,
  isEnhancedMockWalletActive as isDevMockWalletActive,
  DEV_ADDRESS
} from "./enhanced-mock-wallet";
