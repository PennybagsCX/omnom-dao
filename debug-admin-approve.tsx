// Debug admin approve functionality
const ADMIN_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MOCK_WALLET = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

console.log("=== ADMIN APPROVE DEBUG INFO ===");
console.log("Admin wallet:", ADMIN_WALLET);
console.log("Mock wallet:", MOCK_WALLET);
console.log("Match:", ADMIN_WALLET.toLowerCase() === MOCK_WALLET.toLowerCase());

// Test admin validation
function isAdminAddress(address: string): boolean {
  const adminAddresses = ["0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"];
  return adminAddresses.map(a => a.toLowerCase()).includes(address.toLowerCase());
}

console.log("Is mock wallet admin?", isAdminAddress(MOCK_WALLET));
console.log("Is admin wallet admin?", isAdminAddress(ADMIN_WALLET));
console.log("Expected: both should be true");

// What happens when approve is clicked?
console.log("\n=== APPROVE FLOW ===");
console.log("1. User clicks approve button");
console.log("2. Frontend calls: POST /api/v1/proposals/{id}/approve");
console.log("3. Backend checks: requireAuth()");
console.log("4. Backend validates: isAdminAddress(session.sub)");
console.log("5. Backend executes: UPDATE proposals SET status = ACTIVE");
console.log("6. Frontend invalidates queries");

console.log("\n=== POSSIBLE ISSUES ===");
console.log("Issue A: No JWT session cookie -> requireAuth() fails -> 401");
console.log("Issue B: Wallet connected but not verified -> no JWT issued");
console.log("Issue C: Admin address mismatch -> 403 Forbidden");
console.log("Issue D: Mock wallet not properly simulating auth session");

console.log("\n=== CHECKLIST ===");
console.log("□ Mock wallet is connected (wagmi)");
console.log("□ User has gone through SIWE verification");
console.log("□ JWT cookie is set and valid");
console.log("□ JWT contains correct admin address");
console.log("□ Admin address is in allowed list");

