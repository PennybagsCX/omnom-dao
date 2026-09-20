// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Tests for the auto-open state machine in <SiweAuthFlow>.
 *
 * Regression context: the guard used to be `if (me === undefined) return;`,
 * which conflated "auth probe still loading" with "probe settled as 401".
 * Anonymous visitors' `me` data stays undefined FOREVER (retry: false), so
 * the verify dialog never auto-opened after a fresh wallet connect — every
 * connect required a second click. The fix gates on `isPending` (settles on
 * success OR error) plus a `connectModalOpen` stacking guard.
 */

const h = vi.hoisted(() => ({
  address: undefined as string | undefined,
  connectModalOpen: false,
  pickerOpens: 0,
  openConnectModal: (() => {
    h.pickerOpens += 1;
  }) as () => void,
  meData: undefined as unknown,
  mePending: true,
  meFetching: true,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: h.address }),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({
    openConnectModal: h.openConnectModal,
    connectModalOpen: h.connectModalOpen,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  queryKeys: { me: ["me"] },
  useCurrentUser: () => ({
    data: h.meData,
    isPending: h.mePending,
    isFetching: h.meFetching,
  }),
}));

vi.mock("@/components/wallet/connect-wallet-dialog", () => ({
  ConnectWalletDialog: (props: { open: boolean }) => (
    <div data-testid="stub-dialog" data-open={String(props.open)} />
  ),
}));

import { SiweAuthFlow } from "@/components/wallet/siwe-auth-flow";

function flowUi(): React.ReactElement {
  return (
    <React.StrictMode>
      <SiweAuthFlow>
        <div>app</div>
      </SiweAuthFlow>
    </React.StrictMode>
  );
}

function dialogOpenState(): string | undefined {
  return screen.getByTestId("stub-dialog").dataset.open;
}

describe("<SiweAuthFlow> auto-open", () => {
  beforeEach(() => {
    h.address = undefined;
    h.connectModalOpen = false;
    h.meData = undefined;
    h.mePending = true;
    h.meFetching = true;
    h.pickerOpens = 0;
    h.openConnectModal = () => {
      h.pickerOpens += 1;
    };
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("REGRESSION: auto-opens the verify dialog when a fresh connect lands after the probe settled as logged-out", async () => {
    const { rerender } = render(flowUi());
    expect(dialogOpenState()).toBe("false");

    // wagmi reconnect/connect completes while `me` is settled-as-401
    // (anonymous visitor: data undefined forever, isPending false).
    h.mePending = false;
    h.meFetching = false;
    rerender(flowUi());
    h.address = "0xabc";
    rerender(flowUi());

    await waitFor(() => expect(dialogOpenState()).toBe("true"));
  });

  it("does not auto-open while a background me refetch is in flight (dev-auth race)", async () => {
    // Dev-auth chain: devLogin succeeds → invalidateQueries starts a
    // background refetch (status stays "error" → isPending false, but
    // isFetching true) → THEN autoConnect sets the address. The auto-open
    // must wait: the refetch is about to reveal the user as authenticated.
    const { rerender } = render(flowUi());
    h.mePending = false;
    h.meFetching = true;
    rerender(flowUi());

    h.address = "0xabc";
    rerender(flowUi());
    expect(dialogOpenState()).toBe("false");

    // Refetch resolves as logged-in → stays closed (and the transition was
    // not consumed, so nothing fires late).
    h.meFetching = false;
    h.meData = { address: "0xabc", holderClass: "DOLPHIN" };
    rerender(flowUi());
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(dialogOpenState()).toBe("false");
  });

  it("defers the auto-open while the probe is pending, then fires once it settles as logged-out", async () => {
    const { rerender } = render(flowUi());

    // Address arrives while /me is still in flight — must not open (this is
    // the Ledger-reload guard window) and must not consume the transition.
    h.address = "0xabc";
    rerender(flowUi());
    expect(dialogOpenState()).toBe("false");

    // Probe settles as 401 → the deferred transition fires.
    h.mePending = false;
    h.meFetching = false;
    rerender(flowUi());

    await waitFor(() => expect(dialogOpenState()).toBe("true"));
  });

  it("does not auto-open for an already-verified wallet (Bug-4 guard)", async () => {
    h.mePending = false;
    h.meFetching = false;
    h.meData = { address: "0xabc", holderClass: "DOLPHIN" };
    const { rerender } = render(flowUi());

    h.address = "0xabc";
    rerender(flowUi());

    // Give the effect every chance to misfire.
    await waitFor(() => expect(dialogOpenState()).toBeDefined());
    expect(dialogOpenState()).toBe("false");
  });

  it("does not stack the verify dialog while RainbowKit's connect modal is open; fires when it closes", async () => {
    h.mePending = false;
    h.meFetching = false;
    const { rerender } = render(flowUi());

    h.connectModalOpen = true;
    rerender(flowUi());
    h.address = "0xabc";
    rerender(flowUi());
    expect(dialogOpenState()).toBe("false");

    // User picked a wallet → RainbowKit closes its modal → now auto-open.
    h.connectModalOpen = false;
    rerender(flowUi());

    await waitFor(() => expect(dialogOpenState()).toBe("true"));
  });

  it("?login=1 opens the connect flow exactly once, after the probe settles (StrictMode-safe)", async () => {
    window.history.replaceState(null, "", "/?login=1&next=/verify/result");
    h.mePending = false;
    h.meFetching = false; // anonymous: settled-as-401
    render(flowUi());

    // Address is undefined → connect() opens RainbowKit's picker.
    await waitFor(() => expect(h.pickerOpens).toBe(1));
    expect(dialogOpenState()).toBe("false");
  });

  it("ignores ?login=1 on subsequent effect runs after handling it once (pins the handled-ref)", async () => {
    window.history.replaceState(null, "", "/?login=1");
    h.mePending = false;
    h.meFetching = false;
    const { rerender } = render(flowUi());
    await waitFor(() => expect(h.pickerOpens).toBe(1));

    // New openConnectModal IDENTITY → connect() identity changes → the login
    // effect re-runs while the address is still undefined. Only the
    // handled-ref inside the timer callback prevents a second picker open.
    h.openConnectModal = () => {
      h.pickerOpens += 1;
    };
    rerender(flowUi());
    // Let any (wrongly) scheduled timer fire.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(h.pickerOpens).toBe(1);
  });

  it("?login=1 does nothing for an already-verified wallet", async () => {
    window.history.replaceState(null, "", "/?login=1");
    h.mePending = false;
    h.meFetching = false;
    h.meData = { address: "0xabc", holderClass: "DOLPHIN" };
    h.address = "0xabc";
    render(flowUi());
    // Let any (wrongly) scheduled timer fire.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(h.pickerOpens).toBe(0);
    expect(dialogOpenState()).toBe("false");
  });
});
