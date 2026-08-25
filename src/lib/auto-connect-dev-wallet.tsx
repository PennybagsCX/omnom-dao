/**
 * Auto-Connect Development Wallet System
 * 
 * This module provides automatic wallet connection for development testing
 * without requiring manual RainbowKit interaction. It works alongside MetaMask
 * by using the enhanced mock wallet's alternative property.
 */

import { getMockWalletProvider, isEnhancedMockWalletActive } from '@/config/enhanced-mock-wallet';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

/**
 * Hook to auto-connect the enhanced mock wallet when available
 */
export function useAutoConnectDevWallet() {
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();

  const autoConnect = async () => {
    if (typeof window === 'undefined') return false;
    
    // Check if enhanced mock wallet is available
    if (!isEnhancedMockWalletActive()) {
      console.log('[AutoConnect] Enhanced mock wallet not active');
      return false;
    }

    // Check if already connected
    if (isConnected) {
      console.log('[AutoConnect] Already connected to', address);
      return true;
    }

    try {
      console.log('[AutoConnect] Attempting to connect enhanced mock wallet...');

      // Get the mock wallet provider
      const mockProvider = getMockWalletProvider();
      if (!mockProvider) {
        console.log('[AutoConnect] Mock wallet provider not found');
        return false;
      }

      // Connect using injected connector
      await connect({
        connector: injected()
      });

      console.log('[AutoConnect] ✅ Successfully connected enhanced mock wallet');
      return true;
      
    } catch (error) {
      console.error('[AutoConnect] ❌ Failed to connect:', error);
      return false;
    }
  };

  const autoDisconnect = async () => {
    try {
      if (isConnected) {
        await disconnect();
        console.log('[AutoConnect] ✅ Disconnected');
      }
    } catch (error) {
      console.error('[AutoConnect] ❌ Disconnect failed:', error);
    }
  };

  return {
    autoConnect,
    autoDisconnect,
    isAutoConnected: isConnected && isEnhancedMockWalletActive(),
    mockWalletReady: isEnhancedMockWalletActive()
  };
}

/**
 * React component that provides auto-connect functionality
 */
import { useEffect, ReactNode } from 'react';

interface AutoConnectDevWalletProps {
  children: ReactNode;
  enabled?: boolean;
  onConnected?: (success: boolean) => void;
}

export function AutoConnectDevWallet({ 
  children, 
  enabled = true, 
  onConnected 
}: AutoConnectDevWalletProps) {
  const { autoConnect, mockWalletReady } = useAutoConnectDevWallet();

  useEffect(() => {
    if (!enabled || process.env.NODE_ENV !== 'development') return;
    
    // Auto-connect when mock wallet is ready
    if (mockWalletReady) {
      console.log('[AutoConnect] Mock wallet ready, attempting auto-connect...');
      
      // Small delay to ensure all providers are initialized
      const timer = setTimeout(async () => {
        const success = await autoConnect();
        onConnected?.(success);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [enabled, mockWalletReady, autoConnect, onConnected]);

  return <>{children}</>;
}

/**
 * Manual trigger for auto-connect (useful for button clicks)
 */
export async function triggerAutoConnect(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    const mockProvider = getMockWalletProvider();
    if (!mockProvider) {
      console.log('[AutoConnect] No mock wallet available');
      return false;
    }

    // Trigger account request to start connection
    const accounts = await mockProvider.request?.({ method: 'eth_requestAccounts' });
    console.log('[AutoConnect] ✅ Accounts requested:', accounts);
    
    return true;
  } catch (error) {
    console.error('[AutoConnect] ❌ Auto-connect failed:', error);
    return false;
  }
}

/**
 * Check if auto-connect is available and ready
 */
export function isAutoConnectReady(): boolean {
  if (typeof window === 'undefined') return false;
  return isEnhancedMockWalletActive();
}
