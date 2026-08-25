import { NextResponse } from "next/server";

import { ERROR_CODE_MAP } from "@/lib/constants";
import { ErrorCode, type ApiMeta, type ApiResponse } from "@/types";

/**
 * Helpers for producing the standard {@link ApiResponse} envelope from route
 * handlers. Every endpoint returns either {@link apiSuccess} or {@link apiError}
 * so the wire shape is uniform across the API surface.
 */

/** Build a success envelope (HTTP 200 by default). */
export function apiSuccess<T>(
  data: T,
  meta?: ApiMeta,
  status = 200,
): NextResponse<ApiResponse<T>> {
  const body: ApiResponse<T> = { success: true, data, meta };
  return NextResponse.json(body, { status });
}

/** Build an error envelope (HTTP status derived from the error code). */
export function apiError(
  code: ErrorCode,
  message?: string,
  status?: number,
  details?: unknown[],
): NextResponse<ApiResponse<never>> {
  const config = ERROR_CODE_MAP[code];
  const httpStatus = status ?? config.status;
  const body: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message: message ?? config.message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status: httpStatus });
}

/** Build a 500 internal-error envelope for caught exceptions. */
export function apiInternalError(message?: string): NextResponse<ApiResponse<never>> {
  return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
}
