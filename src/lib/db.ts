import { createClient, type Client } from "@libsql/client";

import { getMockDbClient } from "@/lib/mock-db";
import {
  assertAdminConfigProductionSafe,
  assertDevAuthDisabledInProduction,
  assertKvConfiguredInProduction,
} from "@/lib/constants";

/**
 * Database client factory.
 *
 * Reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from the environment. When
 * either is missing / empty (the default local-dev state), the platform
 * transparently falls back to the in-memory **mock** client (`@/lib/mock-db`)
 * seeded by `@/lib/mock-data`. This lets the entire app run — and every page
 * render with realistic data — with ZERO external database configuration.
 *
 * All queries MUST go through this client using parameterized statements — never
 * string interpolation — to prevent SQL injection.
 *
 * In a serverless context, module-level singletons are reused across warm
 * invocations within the same instance.
 */

/**
 * True when no Turso database is configured and the app should run against the
 * in-memory mock data layer. Exposed so callers can branch when needed (e.g. to
 * log diagnostics).
 *
 * CRITICAL: In production, mock mode is NEVER allowed — missing Turso credentials
 * will throw a fatal error instead of silently degrading.
 */
export function isMockMode(): boolean {
  // CRITICAL: Production must never run in mock mode
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  return (
    !url ||
    url.trim() === "" ||
    url.startsWith("mock://") ||
    !token ||
    token.trim() === ""
  );
}

/**
 * Run production startup assertions. Called from getDb() the first time the
 * client is requested in production. Throws if admin list is empty / contains
 * anvil addresses, if dev-auth is enabled, or if Vercel KV is unconfigured.
 *
 * Idempotent across warm serverless invocations via the globalThis guard
 * around getDb() itself.
 */
function runProductionAssertions(): void {
  assertAdminConfigProductionSafe();
  assertDevAuthDisabledInProduction();
  assertKvConfiguredInProduction();
}

/**
 * Get the shared database client. Returns the mock client when Turso is not
 * configured; otherwise returns the real Turso/libsql client.
 *
 * Uses globalThis to ensure all Next.js route modules share the same client
 * instance, even under Turbopack's separate module compilation.
 */
export function getDb(): Client {
  const g = globalThis as typeof globalThis & {
    __omnomDbClient?: Client;
    __omnomDbModeAnnounced?: boolean;
  };

  if (g.__omnomDbClient) return g.__omnomDbClient;

  // CRITICAL: In production, run startup assertions + fatal-error if Turso
  // credentials are missing. Refuses to start without a real database.
  if (process.env.NODE_ENV === "production") {
    runProductionAssertions();
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || url.trim() === "" || url.startsWith("mock://") || !authToken || authToken.trim() === "") {
      throw new Error(
        "FATAL: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN missing in production. " +
          "Refusing to start without a real database. Election integrity cannot be guaranteed."
      );
    }
  }

  if (isMockMode()) {
    if (!g.__omnomDbModeAnnounced) {
      g.__omnomDbModeAnnounced = true;
      console.log(
        "[DB] Running in MOCK mode — no Turso database configured. " +
          "All data is served from the in-memory mock layer (src/lib/mock-data.ts).",
      );
    }
    g.__omnomDbClient = getMockDbClient();
    return g.__omnomDbClient;
  }

  const url = process.env.TURSO_DATABASE_URL!;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  g.__omnomDbClient = createClient({ url, authToken });
  return g.__omnomDbClient;
}

/**
 * Convenience access to the shared client for direct parameterized execution.
 * Works identically against the real Turso client and the mock client.
 *
 * @example
 * const result = await db.execute({
 *   sql: "SELECT * FROM users WHERE wallet_address = ?",
 *   args: [address],
 * });
 */
export const db = new Proxy({} as Client, {
  get(_target, prop) {
    const clientInstance = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (clientInstance as any)[prop];
    return typeof value === "function" ? value.bind(clientInstance) : value;
  },
});
