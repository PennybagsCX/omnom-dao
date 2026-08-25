# 🔧 Enhanced Mock Wallet System

## Overview
The Enhanced Mock Wallet System enables comprehensive UI/UX testing of OMNOM DAO's wallet-dependent features without requiring real Web3 wallet connections. This is especially useful for testing in the ChatGPT browser environment or any environment where wallet extensions aren't available.

## 🚀 Features

### **Multiple Test Accounts**
- **Whale** 🐋: 1M tokens, rank #1 - Maximum governance power
- **Dolphin** 🐬: 15K tokens, rank #100 - Mid-tier governance influence  
- **Fish** 🐟: 100 tokens, rank #10,000 - Standard governance participation
- **Error Tester** ⚠️: 1 token, rank #25,000 - Edge case testing

### **Visual Testing Interface**
- Real-time account information display
- One-click account switching
- Status monitoring and feedback
- Development-only visual indicators

### **Comprehensive Coverage**
- SIWE authentication flow testing
- Proposal creation by different holder classes
- Voting mechanism validation
- Dashboard access verification
- Error scenario simulation

## 🎯 How to Use

### **1. Automatic Activation**
The mock wallet activates automatically in development mode:
```typescript
// In src/components/providers.tsx
installEnhancedMockWallet(); // Auto-installed on app load
```

### **2. Visual Controls Panel**
Look for the **"Dev Mock Wallet"** panel in the bottom-right corner of your screen:
- **Green border** = Mock wallet active and working
- **Yellow border** = Mock wallet available but not currently connected

### **3. Account Switching**
1. Click on the mock wallet panel to expand it
2. Use the **"Switch Test Account"** dropdown
3. Select your desired account type (Whale/Dolphin/Fish/Error Tester)
4. Page automatically reloads with the new account

### **4. Testing Scenarios**

#### **Test Whale Governance Power**
```bash
# Switch to Whale account
# Test: Create proposals, vote with maximum influence
# Verify: All whale-specific features and UI states
```

#### **Test Dolphin Voting Influence**
```bash
# Switch to Dolphin account  
# Test: Mid-tier voting power, proposal participation
# Verify: Dolphin-specific features and restrictions
```

#### **Test Regular User Experience**
```bash
# Switch to Fish account
# Test: Standard voting, basic governance features
# Verify: Regular user UI and functionality
```

#### **Test Edge Cases**
```bash
# Switch to Error Tester account
# Test: Error handling, minimal voting power scenarios
# Verify: Error states and edge case handling
```

## 🔒 Production Safety

### **Automatic Safeguards**
- ✅ **Environment check**: Only activates in `NODE_ENV === 'development'`
- ✅ **Production block**: Refuses activation in production with console error
- ✅ **Real wallet detection**: Won't override real wallet extensions
- ✅ **Visual indicators**: Clear "DEV MODE" labels throughout
- ✅ **Build-time removal**: Can be completely excluded from production builds

### **Production Deployment Checklist**
```bash
# Before deploying to production:
1. Verify NODE_ENV=production
2. Check browser console for mock wallet warnings
3. Test with real wallet connections
4. Confirm no dev-mode UI elements visible
5. Verify production-only code paths
```

### **Complete Removal (Optional)**
For extra safety, you can completely remove the mock wallet from production builds:

#### **Option 1: Environment-Based**
```bash
# In next.config.js (if needed)
module.exports = {
  // ... other config
  webpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      // Exclude mock wallet files from production
      config.module.rules.push({
        test: /enhanced-mock-wallet|mock-wallet-controls/,
        use: 'null-loader'
      });
    }
    return config;
  }
};
```

#### **Option 2: Manual Removal**
```bash
# Before production deployment
rm src/config/enhanced-mock-wallet.ts
rm src/components/wallet/mock-wallet-controls.tsx
# Update providers.tsx to remove mock wallet imports
```

## 🛠️ Technical Details

### **Mock Wallet Architecture**
```
┌─────────────────────────────────────────────┐
│           Enhanced Mock Wallet              │
├─────────────────────────────────────────────┤
│  Account Management                         │
│  ├─ Multiple test accounts (Whale/Dolphin) │
│  ├─ Account switching with event emission   │
│  └─ State management and persistence        │
├─────────────────────────────────────────────┤
│  EIP-1193 Provider Implementation          │
│  ├─ Full RPC method support                 │
│  ├─ Message signing with real cryptography  │
│  ├─ Event emission (connect, accountsChange)│
│  └─ Chain/network management                │
├─────────────────────────────────────────────┤
│  Production Safeguards                      │
│  ├─ Environment-based activation            │
│  ├─ Real wallet detection                   │
│  ├─ Visual dev-mode indicators              │
│  └─ Console logging and warnings            │
└─────────────────────────────────────────────┘
```

### **SIWE Authentication Support**
The mock wallet fully supports Sign-In with Ethereum:
- ✅ Real cryptographic signatures using viem
- ✅ Proper message encoding/decoding
- ✅ Server-side verification compatibility
- ✅ Session token generation
- ✅ Authentication state management

### **Account Information Structure**
```typescript
interface MockAccount {
  address: string;           // Ethereum address
  privateKey: string;        // For signing (dev-only)
  holderClass: "WHALE" | "DOLPHIN" | "FISH";
  balance: string;           // Token balance
  votingPower: number;       // Governance power
  rank: number;             // Holder rank
  displayName: string;       // UI display name
  description: string;       // Account description
}
```

## 🧪 Testing Workflow

### **Complete Feature Testing**
```bash
# 1. Start development server
npm run dev

# 2. Open ChatGPT browser or regular browser
# Navigate to http://localhost:3000

# 3. Test each account type systematically:
#    - Whale: Test all governance features
#    - Dolphin: Test mid-tier features
#    - Fish: Test regular user features
#    - Error Tester: Test edge cases

# 4. Verify authentication flows:
#    - Connect/disconnect scenarios
#    - Session persistence
#    - Error handling

# 5. Test UI/UX for each holder class:
#    - Dashboard displays
#    - Voting interfaces
#    - Proposal creation
#    - Navigation and permissions
```

### **Common Test Scenarios**
```bash
# Scenario 1: Whale creates proposal
1. Switch to Whale account
2. Navigate to /proposals/create
3. Create proposal with maximum voting power
4. Verify proposal submission and UI

# Scenario 2: Fish votes on proposal  
1. Switch to Fish account
2. Browse active proposals
3. Cast vote with standard voting power
4. Verify vote recording and UI update

# Scenario 3: Authentication testing
1. Disconnect wallet
2. Verify dashboard/proposal pages redirect
3. Reconnect with different account
4. Verify proper authentication state

# Scenario 4: Error handling
1. Switch to Error Tester account
2. Test minimal voting power scenarios
3. Verify error states and messages
4. Check UI resilience
```

## 📊 Monitoring & Debugging

### **Console Logging**
The mock wallet provides detailed console logs:
```bash
# On activation
🔧 Enhanced Mock Wallet Active
Account: Test Dolphin 🐬 (0x709979...)
Holder Class: DOLPHIN | Balance: 15000.0 tokens
Rank: #100 | Voting Power: 15,000
Mid-tier holder with significant governance influence

# On account switch
🔄 Account Switched
From: Test Dolphin 🐬
To: Test Whale 🐋
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# RPC calls
[MockWallet] RPC call: personal_sign [...]
[MockWallet] Signing message: localhost wants you to sign...
[MockWallet] Event emitted: accountsChanged [...]
```

### **Status Verification**
```javascript
// Check if mock wallet is active
const isActive = window.ethereum?.__isEnhancedMock;
const currentAccount = window.ethereum?.__currentAccountType;
const availableAccounts = window.ethereum?.__mockAccounts;

console.log('Mock wallet active:', isActive);
console.log('Current account:', currentAccount);
console.log('Available accounts:', Object.keys(availableAccounts));
```

## 🚨 Troubleshooting

### **Mock Wallet Not Appearing**
```bash
# Issue: Mock wallet controls not visible
# Solutions:
1. Verify NODE_ENV === 'development'
2. Check browser console for errors
3. Hard refresh the page (Cmd+Shift+R)
4. Verify enhanced-mock-wallet.ts exists
5. Check providers.tsx imports
```

### **Account Switching Not Working**
```bash
# Issue: Account switching fails
# Solutions:
1. Check browser console for RPC call logs
2. Verify event emission in console
3. Try manual page reload after switch
4. Check wallet connection state
5. Verify SIWE authentication flow
```

### **Production Activation Worries**
```bash
# Issue: Concerned about mock wallet in production
# Verification:
1. Check NODE_ENV on production server
2. Look for console errors starting with "[MockWallet] REFUSED"
3. Verify no "Dev Mock Wallet" panel visible
4. Check browser network tab for mock wallet logs
```

## 📈 Performance & Compatibility

### **Performance Impact**
- **Minimal overhead**: Lightweight provider implementation
- **No blockchain calls**: All operations are local
- **Fast account switching**: Sub-second state changes
- **Efficient event handling**: Optimized listener management

### **Browser Compatibility**
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari  
- ✅ ChatGPT integrated browser
- ✅ Mobile browsers (responsive UI)

## 🎓 Best Practices

### **Development Workflow**
```bash
# 1. Use mock wallet for initial UI development
# 2. Test with all account types regularly
# 3. Verify real wallet compatibility before deployment
# 4. Keep mock wallet accounts updated with governance changes
# 5. Document any custom test scenarios
```

### **Testing Strategy**
```bash
# 1. Start with Fish account for basic functionality
# 2. Progress to Dolphin for intermediate features
# 3. Test with Whale for advanced governance features
# 4. Use Error Tester for edge case validation
# 5. Test account switching scenarios frequently
```

### **Team Collaboration**
```bash
# 1. Share mock wallet scenarios with team members
# 2. Document expected behaviors for each account type
# 3. Create reproducible test cases using mock accounts
# 4. Use consistent account types for similar tests
# 5. Report any mock wallet issues immediately
```

---

## 🎉 Conclusion

The Enhanced Mock Wallet System provides a comprehensive, safe, and efficient way to test OMNOM DAO's wallet-dependent features without requiring real Web3 connections. With multiple test accounts, visual controls, and robust production safeguards, it enables thorough UI/UX testing while maintaining security and performance standards.

**Happy Testing! 🚀**
