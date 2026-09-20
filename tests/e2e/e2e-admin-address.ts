/**
 * The wallet address the E2E suite treats as admin.
 *
 * CI has no .env.local, so NEXT_PUBLIC_ADMIN_ADDRESSES is empty there and
 * nothing would ever pass `isAdminAddress` — the admin-fixture tests would
 * fail with "delete button not found". playwright.config.ts injects this
 * same value into the webServer command, keeping the server's admin
 * allow-list and the fixture's login address in sync in every environment.
 *
 * The address is public by design (NEXT_PUBLIC_* ships in the client
 * bundle); it is a real snapshot holder, which dev-login's
 * registerVerifiedHolder requires.
 */
export const E2E_ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(",")[0]?.trim() ||
  "0x22f4194f6706e70abaa14ab352d0baa6c7ced24a";
