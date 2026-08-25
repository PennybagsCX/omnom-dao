import { type NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import {
  getSnapshotMetadata,
  listHoldersByRank,
  lookupEnrichedSnapshotHolder,
  lookupHolderByRank,
  searchHoldersByAddressPrefix,
  type EnrichedSnapshotHolder,
} from "@/lib/snapshot";
import { ErrorCode, HolderClass } from "@/types";

/**
 * GET /api/v1/snapshot-explorer
 *
 * Public, read-only explorer over the platform's pinned snapshot artifact.
 *
 * Modes:
 *   ?address=0x…          — exact address lookup
 *   ?rank=1               — exact rank lookup
 *   default               — ranked list, optionally filtered by class
 *
 * Query:
 *   class=WHALE|DOLPHIN|FISH
 *   page=1
 *   pageSize=1..100
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address")?.trim();
  const rankParam = params.get("rank")?.trim();
  const classParam = params.get("class")?.trim().toUpperCase();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(params.get("pageSize") ?? "25") || 25),
  );

  const metadata = await getSnapshotMetadata();
  const summary = {
    snapshotType: metadata.snapshotType,
    totalHolders: metadata.totalHolders,
    distribution: metadata.distribution,
    blockNumber: metadata.blockNumber,
    timestamp: metadata.timestamp,
    latestSnapshotDate: metadata.latestSnapshotDate,
    latestSnapshotHolders: metadata.latestSnapshotHolders,
    sourceCommit: metadata.sourceCommit,
    sourceRepository: metadata.sourceRepository,
    sourceFile: metadata.sourceFile,
    sourceFileSha256: metadata.sourceFileSha256,
    electionEligibility: metadata.electionEligibility,
  };

  if (address) {
    const normalized = address.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
      return apiError(ErrorCode.INVALID_ADDRESS, "Invalid EVM address format.", 400);
    }
    const holder = await lookupEnrichedSnapshotHolder(normalized);
    if (!holder) {
      return apiError(
        ErrorCode.NOT_IN_SNAPSHOT,
        "This address is not in the pinned ever-held snapshot corpus.",
        404,
      );
    }
    return apiSuccess({
      mode: "address" as const,
      summary,
      holder,
    });
  }

  if (rankParam) {
    const rank = Number(rankParam);
    if (!Number.isInteger(rank) || rank < 1) {
      return apiError(ErrorCode.INVALID_ADDRESS, "Rank must be a positive integer.", 400);
    }
    const holder = await lookupHolderByRank(rank);
    if (!holder) {
      return apiError(ErrorCode.NOT_IN_SNAPSHOT, "No holder has that rank.", 404);
    }
    return apiSuccess({
      mode: "rank" as const,
      summary,
      holder,
    });
  }

  const addressPrefix = params.get("prefix")?.trim().toLowerCase() ?? "";
  if (addressPrefix.length >= 3 && !address) {
    const holders = await searchHoldersByAddressPrefix(addressPrefix, 25);
    return apiSuccess<ExplorerListData>({
      mode: "list",
      summary,
      holders,
      holderClass: null,
    });
  }

  const holderClass =
    classParam === "WHALE" ||
    classParam === "DOLPHIN" ||
    classParam === "FISH"
      ? (classParam as HolderClass)
      : undefined;

  const holders = await listHoldersByRank({
    offset: (page - 1) * pageSize,
    limit: pageSize,
    holderClass,
  });

  const classCount = holderClass
    ? metadata.distribution[
        holderClass === "WHALE"
          ? "whales"
          : holderClass === "DOLPHIN"
            ? "dolphins"
            : "fish"
      ]
    : metadata.totalHolders;

  const meta = {
    page,
    pageSize,
    totalItems: classCount,
    totalPages: Math.max(1, Math.ceil(classCount / pageSize)),
  };

  return apiSuccess<ExplorerListData>({
    mode: "list" as const,
    summary,
    holders,
    holderClass: holderClass ?? null,
  }, meta);
}

export interface ExplorerListData {
  mode: "list";
  summary: Record<string, unknown>;
  holders: EnrichedSnapshotHolder[];
  holderClass: HolderClass | null;
}
