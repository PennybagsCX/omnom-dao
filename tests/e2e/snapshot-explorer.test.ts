import { test, expect } from "./auth.fixture";

// Destructuring `authenticated` in the beforeEach pre-mints the dev session
// BEFORE navigation, so AutoDevAuthTrigger sees /me succeed on load and
// skips its whole chain. Without this, the chain completes at a random time
// after load (dev-server compile speed) — its me-invalidation storm disrupts
// the debounced search queries and was the root cause of the CI-only search
// flakiness (traces show dev-login landing mid-test + the default list
// refiring 3x while "Wallet found" never renders).

const RUN_E2E = !process.env.VITEST;

if (RUN_E2E) {
  test.describe("Snapshot Explorer", () => {
    test.beforeEach(async ({ page, authenticated: _authenticated }) => {
      await page.goto("/snapshot-explorer");
      await page.waitForLoadState("domcontentloaded");
    });

    test("renders summary and source provenance", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /Snapshot Explorer/i })).toBeVisible();
      // The summary block renders this label more than once (stat card +
      // footnote) — strict mode would reject the multi-match locator.
      await expect(page.getByText("ever-held wallets").first()).toBeVisible();
      await expect(page.getByText(/DBOT-DC\/omnom-snapshot/i)).toBeVisible();
      await expect(page.getByText("2c38af7", { exact: true })).toBeVisible();
    });

    test("lists top holders by default", async ({ page }) => {
      // First hit compiles the route on the dev server — allow for it.
      await expect(page.getByRole("cell", { name: "#1", exact: true })).toBeVisible({ timeout: 30_000 });
      // Class badges render as "🐋Whale" (emoji + title-case) — match the
      // accessible name loosely; the committed snapshot's top ranks 2-4
      // are Whale-class holders.
      await expect(page.getByRole("cell", { name: /whale/i }).first()).toBeVisible();
    });

    test("finds the admin wallet by address", async ({ page }) => {
      await page
        .getByRole("textbox", { name: /search snapshot by address or rank/i })
        .fill("0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a");
      await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/23,946,101,250/i)).toBeVisible();
    });

    test("finds a holder by rank", async ({ page }) => {
      // Rank search scans the full 25k-holder snapshot server-side; CI's
      // 2-core runners need far longer than local hardware.
      test.setTimeout(150_000);
      // Forensics for a CI-only failure: log every snapshot-explorer API
      // response, and dump the page's visible state on failure.
      page.on("response", (res) => {
        if (res.url().includes("/api/v1/snapshot-explorer")) {
          console.log(`[rank-test] API ${res.status()} ${res.url()}`);
        }
      });
      try {
        await page
          .getByRole("textbox", { name: /search snapshot by address or rank/i })
          .fill("840");
        await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 120_000 });
      } catch (err) {
        const mainText = await page
          .locator("main")
          .innerText()
          .catch(() => "<main unavailable>");
        console.log(`[rank-test] FAILURE page main text:\n${mainText.slice(0, 1500)}`);
        throw err;
      }
    });

    test("shows live prefix matches and then an exact wallet", async ({ page }) => {
      // Each keystroke settlement scans the full snapshot server-side; CI's
      // 2-core runners need far longer than local hardware.
      test.setTimeout(150_000);
      const input = page.getByRole("textbox", {
        name: /search snapshot by address or rank/i,
      });
      await input.fill("0x22F4194F");
      await expect(
        page.getByText(/Showing wallet addresses that start with/i),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        page.getByRole("cell", { name: "0x22f4…d24a" }),
      ).toBeVisible({ timeout: 60_000 });
      await input.fill("0x22F4194F6706E70aBaA14AB352D0baA6C7ceD24a");
      await expect(page.getByText("Wallet found")).toBeVisible({ timeout: 60_000 });
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
