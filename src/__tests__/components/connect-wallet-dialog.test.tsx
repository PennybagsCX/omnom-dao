// @vitest-environment jsdom
import React from "react";
import "@/__tests__/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorCode } from "@/types";
import { ApiRequestError } from "@/lib/api";

/**
 * Tests for the verify pipeline guards in <ConnectWalletDialog>.
 *
 * Regression context: a transient `isConnected` flicker during
 * `awaiting-signature` used to reset the phase and re-arm the auto-start
 * effect, firing a second runVerify whose nonce POST overwrote the
 * single-use server nonce — so the correctly-signed first attempt failed
 * with NONCE_EXPIRED and the user had to retry ("connect twice").
 */

const h = vi.hoisted(() => ({
  address: undefined as string | undefined,
  isConnected: false,
  signCalls: [] as string[],
  signResolve: null as null | ((signature: string) => void),
  signReject: null as null | ((err: unknown) => void),
  fetchCalls: [] as Array<{ path: string; method?: string }>,
  fetchResponder: null as null | ((path: string) => Promise<unknown>),
  disconnect: vi.fn(),
  onOpenChange: vi.fn(),
  nextParam: null as string | null,
  pushed: [] as string[],
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: h.address, isConnected: h.isConnected }),
  useConnect: () => ({ connect: vi.fn() }),
  useDisconnect: () => ({ disconnect: h.disconnect }),
  useSignMessage: () => ({
    signMessageAsync: ({ message }: { message: string }) =>
      new Promise<string>((resolve, reject) => {
        h.signCalls.push(message);
        h.signResolve = resolve;
        h.signReject = reject;
      }),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (path: string) => {
      h.pushed.push(path);
    },
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? h.nextParam : null),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchApi: (path: string, opts?: { method?: string; body?: unknown }) => {
      h.fetchCalls.push({ path, method: opts?.method });
      return h.fetchResponder!(path);
    },
  };
});

import { ConnectWalletDialog } from "@/components/wallet/connect-wallet-dialog";

const VERIFY_DATA = {
  address: "0xabc",
  class: "DOLPHIN",
  balanceRaw: "50000000000000000000000000000",
  balanceFormatted: "50000000000",
  rank: 50,
  votingPower: 223606,
};

function respondHappyPath() {
  h.fetchResponder = (path: string) => {
    if (path === "/api/v1/nonce") {
      return Promise.resolve({ nonce: "cafe01", issuedAt: "2026-09-20T00:00:00.000Z" });
    }
    return Promise.resolve(VERIFY_DATA);
  };
}

function nonceCalls(): number {
  return h.fetchCalls.filter((c) => c.path === "/api/v1/nonce").length;
}

function verifyCalls(): number {
  return h.fetchCalls.filter((c) => c.path === "/api/v1/verify").length;
}

function dialogUi(open: boolean): React.ReactElement {
  return <ConnectWalletDialog open={open} onOpenChange={h.onOpenChange} />;
}

/** Mounts closed, then opens with a connected wallet — auto-start fires. */
async function openConnected() {
  const utils = render(dialogUi(false));
  h.address = "0xabc";
  h.isConnected = true;
  utils.rerender(dialogUi(true));
  await screen.findByText(/check your wallet to sign/i);
  return utils;
}

describe("<ConnectWalletDialog> verify pipeline guards", () => {
  beforeEach(() => {
    h.address = undefined;
    h.isConnected = false;
    h.signCalls = [];
    h.signResolve = null;
    h.signReject = null;
    h.fetchCalls = [];
    h.fetchResponder = null;
    h.disconnect = vi.fn();
    h.onOpenChange = vi.fn();
    h.nextParam = null;
    h.pushed = [];
  });

  it("REGRESSION: an isConnected flicker mid-signature does not re-fire runVerify", async () => {
    respondHappyPath();
    const { rerender } = await openConnected();
    expect(nonceCalls()).toBe(1);
    expect(h.signCalls).toHaveLength(1);

    // The flicker: connected → disconnected → connected while sign pending.
    h.isConnected = false;
    rerender(dialogUi(true));
    h.isConnected = true;
    rerender(dialogUi(true));

    // Phase survived the flicker — no reset to idle, no second pipeline run.
    expect(screen.getByText(/check your wallet to sign/i)).toBeInTheDocument();
    expect(nonceCalls()).toBe(1);
    expect(h.signCalls).toHaveLength(1);

    // The original signature completes and verifies.
    h.signResolve!("0xsigned");
    await screen.findByText(/you're verified/i);
    expect(nonceCalls()).toBe(1);
    expect(verifyCalls()).toBe(1);
  });

  it('"Try again" still re-runs the pipeline after a signature rejection', async () => {
    respondHappyPath();
    await openConnected();

    h.signReject!({ code: 4001, message: "user rejected the request" });
    await screen.findByText(/signature rejected/i);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(nonceCalls()).toBe(2));
    await waitFor(() => expect(h.signCalls).toHaveLength(2));
  });

  it("reopen while a signature is still pending starts a fresh pipeline (no dead idle)", async () => {
    respondHappyPath();
    const { rerender } = await openConnected();

    // Close mid-signature, then reopen before anything resolves. The close
    // must fully end the pipeline (orphaning run #1) so the reopen can
    // auto-start run #2 with a fresh nonce — otherwise the dialog would sit
    // dead on idle until the abandoned wallet prompt settled.
    rerender(dialogUi(false));
    rerender(dialogUi(true));

    await waitFor(() => expect(nonceCalls()).toBe(2));

    // Run #2's signature completes and verifies.
    h.signResolve!("0xsig2");
    await screen.findByText(/you're verified/i);
    expect(verifyCalls()).toBe(1);
  });

  it("rejects an off-site ?next redirect target after a successful verify", async () => {
    respondHappyPath();
    h.nextParam = "https://evil.example/verify-again";
    const { rerender } = await openConnected();
    h.signResolve!("0xsigned");
    await screen.findByText(/you're verified/i);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(h.pushed).toEqual(["/verify/result"]));
  });

  it("keeps a same-origin relative ?next redirect target", async () => {
    respondHappyPath();
    h.nextParam = "/governance-vote";
    const { rerender } = await openConnected();
    h.signResolve!("0xsigned");
    await screen.findByText(/you're verified/i);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(h.pushed).toEqual(["/governance-vote"]));
  });

  it("re-arms auto-start after being closed mid-signature, and the late run cannot paint success", async () => {
    respondHappyPath();
    const { rerender } = await openConnected();

    // Close the dialog while the signature is still pending.
    rerender(dialogUi(false));

    // The in-flight run notices the close and bails — no verify request.
    h.signResolve!("0xsigned");
    await waitFor(() => expect(verifyCalls()).toBe(0));

    // Reopening must auto-start a fresh pipeline (nonce #2), not stick idle.
    rerender(dialogUi(true));
    await waitFor(() => expect(nonceCalls()).toBe(2));
    expect(screen.queryByText(/you're verified/i)).not.toBeInTheDocument();
  });

  it("a run resolving after a real disconnect cannot resurrect the success UI", async () => {
    respondHappyPath();
    const { rerender } = await openConnected();

    // Wallet genuinely disconnects (dialog stays open).
    h.isConnected = false;
    rerender(dialogUi(true));

    h.signResolve!("0xsigned");
    // The in-flight run must bail to idle (not verifying, not success).
    await screen.findByText(/verify your \$omnom holdings/i);
    expect(verifyCalls()).toBe(0);
    expect(screen.queryByText(/you're verified/i)).not.toBeInTheDocument();
  });

  it("shows a rate-limit message when the nonce endpoint returns 429", async () => {
    h.fetchResponder = () =>
      Promise.reject(
        new ApiRequestError(
          { code: ErrorCode.RATE_LIMITED, message: "Too many nonce requests. Please slow down." },
          429,
        ),
      );
    const { rerender } = render(dialogUi(false));
    h.address = "0xabc";
    h.isConnected = true;
    rerender(dialogUi(true));

    await screen.findByText(/too many attempts\. please wait a few minutes/i);
  });

  it("shows the generic error for non-rate-limit nonce failures", async () => {
    h.fetchResponder = () =>
      Promise.reject(
        new ApiRequestError({ code: ErrorCode.INTERNAL_ERROR, message: "boom" }, 500),
      );
    const { rerender } = render(dialogUi(false));
    h.address = "0xabc";
    h.isConnected = true;
    rerender(dialogUi(true));

    await screen.findByText(/something went wrong starting verification/i);
  });
});
