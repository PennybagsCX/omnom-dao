# Simple Dev Wallet Solution

## The Problem
Multiple competing mock wallet implementations are causing server issues.

## The Solution
A minimal, simple fix that works:

1. **Simple Dev Login API** (already exists at `/api/v1/dev-login`)
2. **Browser Console Testing** (no UI components needed)
3. **JWT Session Testing** (proves it works)

## How to Test Right Now

1. **Start server:**
   ```bash
   npm run dev
   ```

2. **Open browser** to http://localhost:3000

3. **Open DevTools Console** (F12) and run:
   ```javascript
   // Login as Dolphin
   fetch('/api/v1/dev-login', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     credentials: 'include',
     body: JSON.stringify({
       walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
       holderClass: 'DOLPHIN',
       votingPower: 15000
     })
   }).then(r => r.json()).then(console.log)
   ```

4. **Refresh the page** - you should be authenticated

## Dev Accounts
- **Whale**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (1M voting power)
- **Dolphin**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (15K voting power)
- **Fish**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (100 voting power)

This is the minimal working solution. The UI integration can be added once we confirm the server works properly.
