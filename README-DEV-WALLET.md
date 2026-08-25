# Dev Wallet Implementation - Complete Guide

## Overview
This implementation allows you to test the OMNOM DAO application without connecting a real wallet. It uses JWT-based authentication with mock accounts for development and testing.

## Quick Start
1. Start the dev server: `npm run dev`
2. Visit http://localhost:3000
3. The app automatically authenticates you as a "dolphin" user
4. Test all features without needing a real wallet

## What Was Fixed

### The Problem
The original implementation only showed authenticated state when a wallet was connected via wagmi. This broke dev auth because:
- `useCurrentUser` hook had `enabled: isConnected` 
- UI components only checked wallet connection status
- JWT sessions worked in the backend but weren't recognized by the frontend

### The Solution  
Modified the authentication flow to recognize both wallet connections AND JWT sessions:

**Before:**
```typescript
// Only ran when wallet was connected
enabled: isConnected
```

**After:**
```typescript  
// Always runs - API determines if session exists
enabled: true
```

## How It Works

### Automatic Authentication
When the app loads in development mode:
1. `AutoDevAuthTrigger` component runs silently
2. Calls `/api/v1/dev-login` with default "dolphin" credentials
3. Server creates JWT session and sets httpOnly cookie
4. `useCurrentUser` hook detects the session and fetches user data
5. Navbar updates to show authenticated state

### Manual Authentication  
Users can also manually select accounts:
1. Click "Dev Login" panel (visible in development)
2. Choose whale/dolphin/fish account
3. Same JWT flow runs with selected account
4. UI updates to show new authenticated state

### Mock Accounts
- **Whale**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (1M voting power)
- **Dolphin**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (15K voting power) 
- **Fish**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (100 voting power)

## Technical Details

### JWT Session Flow
```
1. POST /api/v1/dev-login → Creates JWT with user claims
2. JWT stored in httpOnly cookie (not accessible via JavaScript)
3. Subsequent requests include cookie automatically
4. Server validates JWT and returns user data from /api/v1/me
5. Frontend uses user data to update UI
```

### Component Updates
- **useCurrentUser**: Now always enabled, works with JWT sessions
- **ConnectWalletButton**: Shows authenticated state from JWT, not just wallet
- **AutoDevAuthTrigger**: Runs silently on app mount
- **DevLoginPanel**: Manual account selection UI

## Testing Features Available
With dev wallet authentication, you can test:
- Dashboard and user profile pages
- Proposal viewing and creation
- Voting functionality
- Comments and discussions
- Notifications
- Settings and preferences
- All authenticated features without real wallet

## Disabling Before Production
Before going live, remove dev auth components:

### From `/src/components/providers.tsx`:
```typescript
// Remove these lines:
{process.env.NODE_ENV === "development" && (
  <>
    <AutoDevAuthTrigger />
    <DevLoginPanel />
  </>
)}
```

### From `/src/config/wagmi.ts`:
```typescript  
// Ensure no dev wallets are in the connectors list
// Only standard wallets (MetaMask, WalletConnect, etc.)
```

### From `/src/app/api/v1/dev-login/route.ts`:
```typescript
// Either delete the file or add:
if (process.env.NODE_ENV === "production") {
  return apiError(ErrorCode.UNAUTHORIZED, "Dev login not available in production", 403);
}
```

## Troubleshooting

### "Not authenticated" even after dev login
- Check browser console for errors
- Verify `/api/v1/me` returns user data with curl
- Clear cookies and reload
- Ensure development mode (`NODE_ENV === "development"`)

### Navbar doesn't update
- Check that `useCurrentUser` is always enabled
- Verify `ConnectWalletButton` checks for JWT sessions
- Look for console errors in the auto-auth trigger
- Hard refresh the page (Cmd+Shift+R)

### Session not persisting
- Check that cookies are being set
- Verify SESSION_COOKIE_ATTRIBUTES in auth config
- Ensure browser isn't blocking cookies
- Check for conflicting middleware

## Security Considerations
- ✅ Dev auth only active in development mode
- ✅ JWT stored in httpOnly cookies
- ✅ Sessions expire after 7 days
- ✅ Server validates every request
- ⚠️ Must disable before production deployment

## Files Reference
- `/src/lib/api.tsx` - Fixed useCurrentUser hook
- `/src/components/wallet/connect-wallet-button.tsx` - JWT-aware wallet button
- `/src/components/wallet/auto-dev-auth-trigger.tsx` - Auto authentication
- `/src/components/wallet/dev-login-panel.tsx` - Manual login UI
- `/src/lib/dev-auth-bypass.ts` - Mock accounts and API client
- `/src/app/api/v1/dev-login/route.ts` - JWT creation endpoint
- `/src/app/api/v1/me/route.ts` - User data endpoint

---

**Status**: ✅ Working - Dev wallet authentication is fully functional for testing purposes.
