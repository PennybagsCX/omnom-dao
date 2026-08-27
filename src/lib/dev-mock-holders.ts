/**
 * Development mock wallet holder data integration
 *
 * This file provides the mock wallet addresses that should be recognized
 * during development as valid holders in the snapshot corpus.
 *
 * Covers all 7 holder tiers (KRAKEN through SEAHORSE) for comprehensive testing.
 *
 * All addresses verified via viem privateKeyToAddress derivation from standard anvil keys.
 */

import { HolderSnapshot, HolderClass } from "@/types";

/**
 * Mock wallet addresses that should be recognized during development.
 * These correspond to the test accounts in enhanced-mock-wallet.ts
 *
 * Addresses are verified standard anvil accounts (mnemonic path m/44'/60'/0'/0/i):
 * - KRAKEN: anvil #4 (verified)
 * - SHARK:  anvil #5 (verified)
 * - OCTOPUS: anvil #6 (verified)
 * - SEAHORSE: corrected address (was errorTester with typo)
 */
const MOCK_HOLDERS_BY_NAME: Record<string, HolderSnapshot> = {
  kraken: {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    rank: 1,
    balanceRaw: BigInt("1200000000000000000000000000000"),
    balanceFormatted: "1200000000000.0",
    percentageOfSupply: 12.0,
    holderClass: HolderClass.KRAKEN,
  },
  whale: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    rank: 2,
    balanceRaw: BigInt("250000000000000000000000000000"),
    balanceFormatted: "250000000000.0",
    percentageOfSupply: 2.5,
    holderClass: HolderClass.WHALE,
  },
  dolphin: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    rank: 50,
    balanceRaw: BigInt("50000000000000000000000000000"),
    balanceFormatted: "50000000000.0",
    percentageOfSupply: 0.5,
    holderClass: HolderClass.DOLPHIN,
  },
  shark: {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    rank: 500,
    balanceRaw: BigInt("500000000000000000000000000"),
    balanceFormatted: "500000000.0",
    percentageOfSupply: 0.05,
    holderClass: HolderClass.SHARK,
  },
  octopus: {
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    rank: 5000,
    balanceRaw: BigInt("50000000000000000000000000"),
    balanceFormatted: "50000000.0",
    percentageOfSupply: 0.005,
    holderClass: HolderClass.OCTOPUS,
  },
  crab: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    rank: 10000,
    balanceRaw: BigInt("5000000000000000000000000"),
    balanceFormatted: "5000000.0",
    percentageOfSupply: 0.0005,
    holderClass: HolderClass.CRAB,
  },
  seahorse: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    rank: 25000,
    balanceRaw: BigInt("1000000000000000000000"),
    balanceFormatted: "1000.0",
    percentageOfSupply: 0.000001,
    holderClass: HolderClass.SEAHORSE,
  },
};

// Create address-to-holder mapping for efficient lookup
export const DEV_MOCK_HOLDERS: Record<string, HolderSnapshot> = {};

Object.values(MOCK_HOLDERS_BY_NAME).forEach(holder => {
  DEV_MOCK_HOLDERS[holder.address.toLowerCase()] = holder;
});

// Export the original mapping for other uses
export { MOCK_HOLDERS_BY_NAME };
