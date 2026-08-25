/**
 * Development mock wallet holder data integration
 * 
 * This file provides the mock wallet addresses that should be recognized
 * during development as valid holders in the snapshot corpus.
 */

import { HolderSnapshot, HolderClass } from "@/types";

/**
 * Mock wallet addresses that should be recognized during development.
 * These correspond to the test accounts in injectable-mock-wallet.tsx
 */
const MOCK_HOLDERS_BY_NAME: Record<string, HolderSnapshot> = {
  whale: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    rank: 1,
    balanceRaw: BigInt("1000000000000000000000000"),
    balanceFormatted: "1000000.0",
    percentageOfSupply: 1.0,
    holderClass: HolderClass.WHALE,
  },
  dolphin: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    rank: 100,
    balanceRaw: BigInt("15000000000000000000000"),
    balanceFormatted: "15000.0",
    percentageOfSupply: 0.015,
    holderClass: HolderClass.DOLPHIN,
  },
  fish: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    rank: 10000,
    balanceRaw: BigInt("100000000000000000000"),
    balanceFormatted: "100.0",
    percentageOfSupply: 0.0001,
    holderClass: HolderClass.FISH,
  },
  errorTester: {
    address: "0x90F79bf6EB2c4f870365E785982E47f92493D450",
    rank: 25000,
    balanceRaw: BigInt("1000000000000000000"),
    balanceFormatted: "1.0",
    percentageOfSupply: 0.000001,
    holderClass: HolderClass.FISH,
  },
};

// Create address-to-holder mapping for efficient lookup
export const DEV_MOCK_HOLDERS: Record<string, HolderSnapshot> = {};

Object.values(MOCK_HOLDERS_BY_NAME).forEach(holder => {
  DEV_MOCK_HOLDERS[holder.address.toLowerCase()] = holder;
});

// Export the original mapping for other uses
export { MOCK_HOLDERS_BY_NAME };
