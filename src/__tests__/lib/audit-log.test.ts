import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { execute: executeMock },
}));

import {
  listAuditEntries,
  recordAuditEvent,
} from "@/lib/audit-log";

function result(rows: Record<string, unknown>[]) {
  return { rows, columns: Object.keys(rows[0] ?? {}), rowsAffected: rows.length };
}

const entryRow = {
  id: "a-1",
  actor_address: "0xadmin",
  action: "PROPOSAL_APPROVED",
  target_type: "proposal",
  target_id: "p-1",
  details: '{"reason":"ok"}',
  created_at: "2026-08-24T00:00:00.000Z",
};

describe("audit-log", () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  describe("recordAuditEvent", () => {
    it("inserts the event with lowercased actor and stringified details", async () => {
      executeMock.mockResolvedValueOnce(result([]));

      await recordAuditEvent(
        "0xADMIN",
        "PROPOSAL_APPROVED",
        "proposal",
        "p-1",
        { reason: "ok" },
      );

      expect(executeMock).toHaveBeenCalledTimes(1);
      const call = executeMock.mock.calls[0]![0] as {
        sql: string;
        args: unknown[];
      };
      expect(call.sql).toContain("INSERT INTO audit_log");
      expect(call.args).toEqual([
        "0xadmin",
        "PROPOSAL_APPROVED",
        "proposal",
        "p-1",
        '{"reason":"ok"}',
      ]);
    });

    it("writes null details when omitted", async () => {
      executeMock.mockResolvedValueOnce(result([]));

      await recordAuditEvent("0xadmin", "PROPOSAL_REJECTED", "proposal", "p-2");

      const call = executeMock.mock.calls[0]![0] as { args: unknown[] };
      expect(call.args[4]).toBeNull();
    });

    it("never throws when the audit write fails (governance must proceed)", async () => {
      executeMock.mockRejectedValueOnce(new Error("db down"));
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        recordAuditEvent("0xadmin", "PROPOSAL_STATUS_OVERRIDE", "platform", "x"),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        "[audit-log] Failed to record event:",
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe("listAuditEntries", () => {
    it("returns mapped entries plus the total count", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 3 }]))
        .mockResolvedValueOnce(result([entryRow]));

      const page = await listAuditEntries(1, 2);
      expect(page.total).toBe(3);
      expect(page.entries).toEqual([
        {
          id: "a-1",
          actorAddress: "0xadmin",
          action: "PROPOSAL_APPROVED",
          targetType: "proposal",
          targetId: "p-1",
          details: '{"reason":"ok"}',
          createdAt: "2026-08-24T00:00:00.000Z",
        },
      ]);

      const list = executeMock.mock.calls[1]![0] as { sql: string; args: number[] };
      expect(list.sql).toContain("ORDER BY created_at DESC");
      expect(list.args).toEqual([1, 2]);
    });

    it("maps a null details column to null", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 1 }]))
        .mockResolvedValueOnce(result([{ ...entryRow, details: null }]));

      const page = await listAuditEntries();
      expect(page.entries[0]!.details).toBeNull();
    });

    it("clamps the limit into the 1–100 range", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 0 }]))
        .mockResolvedValueOnce(result([]))
        .mockResolvedValueOnce(result([{ cnt: 0 }]))
        .mockResolvedValueOnce(result([]));

      await listAuditEntries(500, 0);
      let call = executeMock.mock.calls[1]![0] as { args: number[] };
      expect(call.args[0]).toBe(100);

      await listAuditEntries(0, 0);
      call = executeMock.mock.calls[3]![0] as { args: number[] };
      expect(call.args[0]).toBe(1);
    });

    it("defaults to 50 entries", async () => {
      executeMock
        .mockResolvedValueOnce(result([{ cnt: 0 }]))
        .mockResolvedValueOnce(result([]));

      await listAuditEntries();
      const call = executeMock.mock.calls[1]![0] as { args: number[] };
      expect(call.args[0]).toBe(50);
    });
  });
});
