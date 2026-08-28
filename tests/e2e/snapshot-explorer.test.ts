import { test, expect } from "@playwright/test";

const RUN_E2E = !process.env.VITEST;

if (RUN_E2E) {
  test.describe("Snapshot Explorer", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/snapshot-explorer");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders summary and source provenance", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /Snapshot Explorer/i })).toBeVisible();
      await expect(page.getByText("ever-held wallets")).toBeVisible();
      await expect(page.getByText(/DBOT-DC\/omnom-snapshot/i)).toBeVisible();
      await expect(page.getByText("2c38af7", { exact: true })).toBeVisible();
    });

    test("lists top holders by default", async ({ page }) => {
      await expect(page.getByRole("cell", { name: "#1", exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "WHALE", exact: true }).first()).toBeVisible();
    });

    test("finds the admin wallet by address", async ({ page }) => {
      await page
        .getByRole("textbox", { name: /search snapshot by address or rank/i })
        .fill("0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a");
      await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/23,946,101,250/i)).toBeVisible();
    });

    test("finds a holder by rank", async ({ page }) => {
      await page
        .getByRole("textbox", { name: /search snapshot by address or rank/i })
        .fill("840");
      await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 10_000 });
    });

    test("shows live prefix matches and then an exact wallet", async ({ page }) => {
      const input = page.getByRole("textbox", {
        name: /search snapshot by address or rank/i,
      });
      await input.fill("0x22F4194F");
      await expect(
        page.getByText(/Showing wallet addresses that start with/i),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByRole("cell", { name: "0x22f4…d24a" }),
      ).toBeVisible();
      await input.fill("0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a");
      await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 10_000 });
      await input.fill("0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz");
      await expect(
        page.getByText(/not a valid EVM address/i),
      ).toBeVisible();
    });

    test("links back to the election", async ({ page }) => {
      await expect(page.getByRole("link", { name: /Foundational Governance Election/i })).toBeVisible();
    });

    test("is responsive at mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}

if (process.env.VITEST) {
  const { describe, it } = await import("vitest");
  describe.skip("[e2e] Snapshot Explorer — run via `npm run test:e2e`", () => {
    it("skipped under vitest", () => {});
  });
}
