import { describe, expect, it } from "vitest";

import { ERROR_CODE_MAP } from "@/lib/constants";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/types";

describe("api-response envelope helpers", () => {
  describe("apiSuccess", () => {
    it("wraps data in a 200 success envelope", async () => {
      const res = apiSuccess({ id: "p-1" }, { page: 1, totalItems: 1 });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        data: { id: "p-1" },
        meta: { page: 1, totalItems: 1 },
      });
    });

    it("omits meta when not provided and honors custom status", async () => {
      const res = apiSuccess({ created: true }, undefined, 201);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.meta).toBeUndefined();
      expect(body.success).toBe(true);
    });
  });

  describe("apiError", () => {
    it("derives HTTP status and message from the error code", async () => {
      const code = ErrorCode.NOT_IN_SNAPSHOT;
      const res = apiError(code);
      expect(res.status).toBe(ERROR_CODE_MAP[code].status);
      await expect(res.json()).resolves.toEqual({
        success: false,
        error: {
          code,
          message: ERROR_CODE_MAP[code].message,
        },
      });
    });

    it("lets the caller override message, status and details", async () => {
      const res = apiError(
        ErrorCode.VALIDATION_ERROR,
        "Bad input",
        422,
        ["field: required"],
      );
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Bad input",
          details: ["field: required"],
        },
      });
    });

    it("omits an empty details array", async () => {
      const res = apiError(ErrorCode.UNAUTHORIZED, "no", 401, []);
      const body = await res.json();
      expect(body.error.details).toBeUndefined();
    });
  });

  describe("apiInternalError", () => {
    it("builds a 500 envelope with the default message", async () => {
      const res = apiInternalError();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.error.message).toBe(
        ERROR_CODE_MAP[ErrorCode.INTERNAL_ERROR].message,
      );
    });

    it("propagates a custom message", async () => {
      const res = apiInternalError("boom");
      const body = await res.json();
      expect(body.error.message).toBe("boom");
      expect(body.success).toBe(false);
    });
  });
});
