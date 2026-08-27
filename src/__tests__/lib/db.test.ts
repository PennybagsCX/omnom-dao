import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * db.ts reads env + globalThis singletons at call time, so every case loads a
 * fresh module instance with its own env/mocks and clears the shared globals.
 */

interface DbGlobals {
  __omnomDbClient?: unknown;
  __omnomDbModeAnnounced?: boolean;
}

function resetGlobals(): void {
  const g = globalThis as typeof globalThis & DbGlobals;
  delete g.__omnomDbClient;
  delete g.__omnomDbModeAnnounced;
}

type EnvPatch = Record<string, string | undefined>;

const REAL_CLIENT = { protocol: "real-turso" } as const;
const MOCK_CLIENT = { protocol: "mock" } as const;

const createClientMock = vi.fn(() => REAL_CLIENT);
const getMockDbClientMock = vi.fn(() => MOCK_CLIENT);

const ENV_KEYS = ["NODE_ENV", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"] as const;

// Pristine snapshot taken once at load; restored after every test so the env
// patch applied by freshDb is still active while the test body runs.
const SAVED_ENV: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) SAVED_ENV[key] = process.env[key];

function applyEnv(patch: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    // NODE_ENV is typed read-only; Object.assign sidesteps it in tests.
    else Object.assign(process.env, { [key]: value });
  }
}

function restoreEnv(): void {
  applyEnv(SAVED_ENV);
}

/** Patch env, load a fresh db module with libsql/mock-db/constants mocked, keep env patched. */
async function freshDb(env: EnvPatch): Promise<typeof import("@/lib/db")> {
  vi.resetModules();
  vi.doMock("@libsql/client", () => ({ createClient: createClientMock }));
  vi.doMock("@/lib/mock-db", () => ({ getMockDbClient: getMockDbClientMock }));
  // No-op the production assertions so this test can exercise getDb() in
  // production-like env without setting up a full admin / KV env.
  vi.doMock("@/lib/constants", () => ({
    assertAdminConfigProductionSafe: () => {},
    assertDevAuthDisabledInProduction: () => {},
    assertKvConfiguredInProduction: () => {},
    getAdminAddresses: () => [],
    isAdminAddress: () => false,
    ANVIL_DENYLIST: new Set(),
  }));
  applyEnv(env);
  const mod = await import("@/lib/db");
  vi.doUnmock("@libsql/client");
  vi.doUnmock("@/lib/mock-db");
  vi.doUnmock("@/lib/constants");
  return mod;
}

describe("db client factory", () => {
  beforeEach(() => {
    resetGlobals();
    createClientMock.mockClear();
    getMockDbClientMock.mockClear();
    applyEnv({ NODE_ENV: "test", TURSO_DATABASE_URL: undefined, TURSO_AUTH_TOKEN: undefined });
  });

  afterEach(() => {
    resetGlobals();
    restoreEnv();
  });

  describe("isMockMode", () => {
    it("is never true in production", async () => {
      const { isMockMode } = await freshDb({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(isMockMode()).toBe(false);
    });

    it("is true when neither Turso credential is set (dev default)", async () => {
      const { isMockMode } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(isMockMode()).toBe(true);
    });

    it("is true for an empty or whitespace URL", async () => {
      const empty = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "",
        TURSO_AUTH_TOKEN: "token",
      });
      expect(empty.isMockMode()).toBe(true);

      const whitespace = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "   ",
        TURSO_AUTH_TOKEN: "token",
      });
      expect(whitespace.isMockMode()).toBe(true);
    });

    it("is true for an explicit mock:// URL", async () => {
      const { isMockMode } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "mock://local",
        TURSO_AUTH_TOKEN: "token",
      });
      expect(isMockMode()).toBe(true);
    });

    it("is true when the auth token is missing or blank", async () => {
      const missing = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(missing.isMockMode()).toBe(true);

      const blank = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "  ",
      });
      expect(blank.isMockMode()).toBe(true);
    });

    it("is false when both credentials are configured", async () => {
      const { isMockMode } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "eyJtoken",
      });
      expect(isMockMode()).toBe(false);
    });
  });

  describe("getDb", () => {
    it("throws a FATAL error in production when Turso credentials are missing", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(() => getDb()).toThrow(/FATAL: TURSO_DATABASE_URL/);
    });

    it("throws in production even when only the token is missing", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(() => getDb()).toThrow(/Election integrity/);
    });

    it("throws in production for a mock:// URL", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "mock://local",
        TURSO_AUTH_TOKEN: "token",
      });
      expect(() => getDb()).toThrow();
    });

    it("returns the real Turso client in production when configured", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "eyJtoken",
      });
      const client = getDb();
      expect(client).toBe(REAL_CLIENT);
      expect(createClientMock).toHaveBeenCalledWith({
        url: "libsql://db.turso.io",
        authToken: "eyJtoken",
      });
    });

    it("falls back to the mock client in dev when unconfigured", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      expect(getDb()).toBe(MOCK_CLIENT);
      expect(createClientMock).not.toHaveBeenCalled();
    });

    it("caches the client on globalThis (singleton per process)", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      const first = getDb();
      const second = getDb();
      expect(first).toBe(second);
      expect(getMockDbClientMock).toHaveBeenCalledTimes(1);
      const g = globalThis as typeof globalThis & DbGlobals;
      expect(g.__omnomDbClient).toBe(MOCK_CLIENT);
      expect(g.__omnomDbModeAnnounced).toBe(true);
    });

    it("announces mock mode only once", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { getDb } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: undefined,
        TURSO_AUTH_TOKEN: undefined,
      });
      getDb();
      getDb();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("MOCK mode"));
      logSpy.mockRestore();
    });

    it("creates the real client in dev when Turso is configured", async () => {
      const { getDb } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "eyJtoken",
      });
      expect(getDb()).toBe(REAL_CLIENT);
    });
  });

  describe("db proxy", () => {
    it("delegates property access to the active client, bound correctly", async () => {
      const execute = vi.fn(async () => ({ rows: [] }));
      createClientMock.mockImplementationOnce(
        () => ({ execute }) as unknown as ReturnType<typeof createClientMock>,
      );
      const { db } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "eyJtoken",
      });

      const result = await db.execute({ sql: "SELECT 1", args: [] });
      expect(result).toEqual({ rows: [] });
      expect(execute).toHaveBeenCalledWith({ sql: "SELECT 1", args: [] });
    });

    it("reads non-function properties from the client", async () => {
      createClientMock.mockImplementationOnce(
        () =>
          ({ closed: false }) as unknown as ReturnType<typeof createClientMock>,
      );
      const { db } = await freshDb({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://db.turso.io",
        TURSO_AUTH_TOKEN: "eyJtoken",
      });
      expect(db.closed).toBe(false);
    });
  });
});
