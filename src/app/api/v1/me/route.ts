import { getSession, UnauthorizedError } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { db } from "@/lib/db";
import { lookupHolder } from "@/lib/snapshot";
import { getUserSettings } from "@/lib/user-settings";
import { ErrorCode, type HolderClass } from "@/types";

interface MeResponseData {
  address: string;
  displayName: string;
  class: HolderClass;
  balanceRaw: string;  // Changed from BigInt to string
  balanceFormatted: string;
  rank: number;
  votingPower: number;
  createdAt: string;
  settings: {
    notifications: {
      proposalCreated: boolean;
      votingStarted: boolean;
      votingEndingSoon: boolean;
      proposalResult: boolean;
      mention: boolean;
    };
    preferredWallet: string | null;
    displayFormat: "full" | "abbreviated" | "raw";
  };
}

/**
 * GET /api/v1/me
 *
 * Return the current authenticated user's profile. Requires JWT (enforced by
 * middleware, but we re-verify server-side for defense in depth).
 */
export async function GET() {
  let session;
  try {
    session = await getSession();
    if (!session) throw new UnauthorizedError(ErrorCode.UNAUTHORIZED);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return apiError(err.code, undefined, err.statusCode);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, undefined, 500);
  }

  const address = session.sub;

  const userRes = await db.execute({
    sql: "SELECT id, wallet_address, display_name, created_at, last_login_at FROM users WHERE wallet_address = ?",
    args: [address.toLowerCase()],
  });
  if (userRes.rows.length === 0) {
    return apiError(ErrorCode.USER_NOT_FOUND, undefined, 404);
  }
  const userRow = userRes.rows[0]!;

  const holder = await lookupHolder(address);
  if (!holder) {
    return apiError(ErrorCode.NOT_IN_SNAPSHOT, undefined, 404);
  }

  // Read the user's persisted settings instead of always returning defaults (C1.2).
  const userSettings = await getUserSettings(userRow.id as string);

  // Convert BigInt balanceRaw to string for JSON serialization
  const balanceRawStr = holder.balanceRaw.toString();

  const data: MeResponseData = {
    address: userRow.wallet_address as string,
    displayName: (userRow.display_name as string) || (userRow.wallet_address as string),
    class: holder.holderClass,
    balanceRaw: balanceRawStr,
    balanceFormatted: holder.balanceFormatted,
    rank: holder.rank,
    votingPower: session.votingPower,
    createdAt: userRow.created_at as string,
    settings: {
      notifications: userSettings.notifications,
      preferredWallet: userSettings.preferredWallet,
      displayFormat: userSettings.displayFormat,
    },
  };

  return apiSuccess<MeResponseData>(data);
}
