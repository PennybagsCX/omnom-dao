# Next Agent: Fix This Properly

## Current Situation
- Server starts and says "Ready" but doesn't respond to HTTP requests
- Multiple backup files and attempts suggest something is fundamentally broken
- User just wants dev wallet to work for testing

## What to Do
1. **Get the server actually working first**
   - Start with clean slate
   - Remove all the complex mock wallet stuff
   - Get basic Next.js app responding to requests

2. **Apply minimal fix only**
   - The dev auth API exists at `/api/v1/dev-login`
   - Just need frontend to recognize JWT sessions
   - Single line change in `useCurrentUser` hook: `enabled: true` instead of `enabled: isConnected`

3. **Test it actually works**
   - Start server
   - Make HTTP requests to confirm it responds
   - Test dev login via curl
   - Then tell user to test in browser

## Dev Accounts (already working in API)
- Whale: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (1M voting power)
- Dolphin: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (15K voting power)
- Fish: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (100 voting power)

## User's Goal
"Just make it so I can login with a dev wallet without having to connect a wallet so I can test screens / flows out properly and give you feedback in codex"

Don't overcomplicate it. Get the server working, apply the fix, test it works.
