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
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": {
    holderClass: "WHALE" as HolderClass,
    balanceRaw: "1000000000000000000000000", 
    balanceFormatted: "1000000.0",
    rank: 1,
    votingPower: 1000000
  },
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": {
    holderClass: "DOLPHIN" as HolderClass,
    balanceRaw: "15000000000000000000000", 
    balanceFormatted: "15000.0", 
    rank: 100,
    votingPower: 15000
  },
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": {
    holderClass: "FISH" as HolderClass,
    balanceRaw: "100000000000000000000", 
    balanceFormatted: "100.0",
    rank: 10000,
    votingPower: 100
  }
};

export async function POST(request: NextRequest) {
  // Server-side NODE_ENV guard
  if (process.env.NODE_ENV !== "development") {
    return apiError(ErrorCode.UNAUTHORIZED, "Dev login is disabled", 404);
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
      sessionData = {
        walletAddress: walletAddress,
        holderClass: holderClass as HolderClass,
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
