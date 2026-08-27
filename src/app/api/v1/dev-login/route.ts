import { type NextRequest } from "next/server";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_ATTRIBUTES, registerVerifiedHolder, UnauthorizedError } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode, HolderClass } from "@/types";

interface MockSnapshotEntry {
  holderClass: HolderClass;
  balanceRaw: string;
  balanceFormatted: string;
  rank: number;
  votingPower: number;
}

const MOCK_SNAPSHOT_DATA: Record<string, MockSnapshotEntry> = {
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": {
    holderClass: HolderClass.KRAKEN,
    balanceRaw: "1200000000000000000000000000",
    balanceFormatted: "1200000000000.0",
    rank: 1,
    votingPower: 1200000000000
  },
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
    holderClass: HolderClass.WHALE,
    balanceRaw: "250000000000000000000000000",
    balanceFormatted: "250000000000.0",
    rank: 2,
    votingPower: 250000000000
  },
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": {
    holderClass: HolderClass.DOLPHIN,
    balanceRaw: "50000000000000000000000000",
    balanceFormatted: "50000000000.0",
    rank: 50,
    votingPower: 50000000000
  },
  "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc": {
    holderClass: HolderClass.SHARK,
    balanceRaw: "500000000000000000000000",
    balanceFormatted: "500000000.0",
    rank: 500,
    votingPower: 500000000
  },
  "0x976ea74026e726554db657fa54763abd0c3a0aa9": {
    holderClass: HolderClass.OCTOPUS,
    balanceRaw: "50000000000000000000000",
    balanceFormatted: "50000000.0",
    rank: 5000,
    votingPower: 50000000
  },
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": {
    holderClass: HolderClass.CRAB,
    balanceRaw: "5000000000000000000000",
    balanceFormatted: "5000000.0",
    rank: 10000,
    votingPower: 5000000
  },
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": {
    holderClass: HolderClass.SEAHORSE,
    balanceRaw: "1000000000000000000",
    balanceFormatted: "1000.0",
    rank: 25000,
    votingPower: 1000
  },
};

export async function POST(request: NextRequest) {
  // Server-side NODE_ENV guard — any non-development environment (including
  // production and test) returns 404 without revealing the endpoint exists.
  if (process.env.NODE_ENV !== "development") {
    return apiError(ErrorCode.NOT_FOUND, "Not found", 404);
  }

  console.log("[DevLogin] Starting request...");

  try {
    const body = await request.json();
    const { walletAddress, holderClass, votingPower } = body;

    if (!walletAddress) {
      return apiError(ErrorCode.MISSING_FIELDS, "walletAddress is required", 400);
    }

    console.log("[DevLogin] Processing wallet:", walletAddress);

    const normalizedAddress = walletAddress.toLowerCase();
    let sessionData;
    const snapshotData = MOCK_SNAPSHOT_DATA[normalizedAddress];

    if (snapshotData) {
      sessionData = {
        walletAddress: walletAddress,
        holderClass: snapshotData.holderClass,
        votingPower: snapshotData.votingPower
      };
    } else if (holderClass && votingPower) {
      // Validate holderClass against allowed values
      const validHolderClasses = Object.values(HolderClass);
      if (!validHolderClasses.includes(holderClass as HolderClass)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `Invalid holderClass: ${holderClass}. Must be one of: ${validHolderClasses.join(", ")}`, 400);
      }

      // Normalize FISH → SEAHORSE (legacy value mapping)
      const normalizedClass = holderClass === "FISH" ? HolderClass.SEAHORSE : holderClass as HolderClass;

      sessionData = {
        walletAddress: walletAddress,
        holderClass: normalizedClass,
        votingPower: votingPower
      };
    } else {
      return apiError(ErrorCode.MISSING_FIELDS, "Invalid request", 400);
    }

    const token = await signSession(sessionData);

    // Register the verified holder (ensures users row exists, upserts if needed)
    await registerVerifiedHolder(walletAddress);

    const response = apiSuccess({
      success: true,
      session: sessionData,
      snapshot: snapshotData || {
        holderClass: sessionData.holderClass,
        balanceRaw: "0",
        balanceFormatted: "0",
        rank: 0,
        votingPower: sessionData.votingPower
      }
    });

    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_ATTRIBUTES);

    console.log(`[DevLogin] ✅ Created JWT session for ${walletAddress} as ${sessionData.holderClass}`);

    return response;

  } catch (error) {
    console.error("[DevLogin] ❌ Error:", error);

    // Special case: NOT_IN_SNAPSHOT should be loud, not INTERNAL_ERROR
    if (error instanceof UnauthorizedError) {
      return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 404);
    }

    return apiError(ErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : "Failed to create dev session", 500);
  }
}
