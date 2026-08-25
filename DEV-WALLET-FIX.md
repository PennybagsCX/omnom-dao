# Dev Wallet Fix - Implementation Summary

## Problem Identified
The original `useCurrentUser` hook only ran when a wallet was connected via wagmi (`enabled: isConnected`), which broke dev auth functionality that uses JWT sessions without requiring wallet connection.

## Root Cause
```typescript
// ❌ BEFORE - Only checked authentication when wallet was connected
export function useCurrentUser() {
  const { isConnected } = useAccount();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<MeData>("/api/v1/me"),
    enabled: isConnected, // ❌ This prevented JWT sessions from working
    retry: false,
  });
}
```

## Solution Applied
Modified the `useCurrentUser` hook to always check for authentication, allowing both wallet-based and JWT-based authentication to work:

```typescript
// ✅ AFTER - Always checks for authentication (wallet or JWT)
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiGet<MeData>("/api/v1/me"),
    enabled: true, // ✅ Now works with both wallet and JWT sessions
    retry: false,
  });
}
```

## Files Modified
1. **`/src/lib/api.tsx`** - Fixed `useCurrentUser` hook to always be enabled
2. **`/src/components/wallet/connect-wallet-button.tsx`** - Updated to show authenticated state from JWT sessions
3. **`/src/components/wallet/dev-login-panel.tsx`** - Manual dev login interface  
4. **`/src/components/wallet/auto-dev-auth-trigger.tsx`** - Automatic authentication on page load
5. **`/src/lib/dev-auth-bypass.ts`** - Dev auth API client with mock accounts
6. **`/src/app/api/v1/dev-login/route.ts`** - JWT session creation endpoint

## How It Works Now
1. **Automatic**: On page load in development, the app automatically authenticates as "dolphin" account
2. **Manual**: Users can also manually select whale/dolphin/fish accounts via the dev panel
3. **JWT-based**: Uses server-side JWT sessions instead of requiring wallet connection
4. **UI Updates**: Navbar now shows authenticated state even without wallet connection

## Mock Accounts Available
- **Whale**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (1M voting power)
- **Dolphin**: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (15K voting power) 
- **Fish**: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (100 voting power)

## Testing
Once the dev server is running with `npm run dev`:
1. Visit http://localhost:3000
2. App automatically authenticates as "dolphin" 
3. Navbar shows authenticated state with dropdown menu
4. You can access dashboard, proposals, voting, etc. without connecting a real wallet
5. Use the dev panel to switch between whale/dolphin/fish accounts

## Important Notes
- ✅ Works completely without requiring wallet connection
- ✅ JWT sessions persist across page refreshes  
- ✅ All authenticated features are accessible
- ✅ Can be disabled before going live by removing dev auth components
- ✅ Only active in development mode (`NODE_ENV === "development"`)
