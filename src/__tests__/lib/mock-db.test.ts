import { beforeEach, describe, expect, it } from "vitest";
import type { InArgs } from "@libsql/client";

import { executeMock, getMockDbClient } from "@/lib/mock-db";
import { getMockStore, resetMockStore } from "@/lib/mock-data";

/**
 * mock-db tests run the real mini-SQL interpreter against the real in-memory
 * store (no mocks). `resetMockStore()` in beforeEach guarantees isolation.
 */

function q(sql: string, args: InArgs = []) {
  return executeMock({ sql, args });
}

/** Wipe comments and seed three deterministic rows (c1, c2 on p1; c3 on p2). */
async function seedComments(): Promise<void> {
  await q("DELETE FROM comments");
  await q(
    "INSERT INTO comments (id, proposal_id, author_address, content, created_at) VALUES ('c1', 'p1', '0xaaa', 'first', '2026-01-01T00:00:00.000Z')",
  );
  await q(
    "INSERT INTO comments (id, proposal_id, author_address, content, created_at) VALUES ('c2', 'p1', '0xbbb', 'second', '2026-01-02T00:00:00.000Z')",
  );
  await q(
    "INSERT INTO comments (id, proposal_id, author_address, content, created_at) VALUES ('c3', 'p2', '0xccc', 'third', '2026-01-03T00:00:00.000Z')",
  );
}

/** Wipe notifications and seed three rows: 2x type A read=1, 1x type B read=0. */
async function seedNotifications(): Promise<void> {
  await q("DELETE FROM notifications");
  await q("INSERT INTO notifications (id, user_id, type, read) VALUES ('n1', 'u1', 'A', 1)");
  await q("INSERT INTO notifications (id, user_id, type, read) VALUES ('n2', 'u1', 'A', 1)");
  await q("INSERT INTO notifications (id, user_id, type, read) VALUES ('n3', 'u2', 'B', 0)");
}

beforeEach(() => {
  resetMockStore();
});

describe("executeMock — SELECT", () => {
  it("SELECT * returns every seeded row with the full column list", async () => {
    const rs = await q("SELECT * FROM comments");
    expect(rs.rows).toHaveLength(9);
    expect(rs.columns).toEqual(
      expect.arrayContaining([
        "id",
        "proposal_id",
        "author_address",
        "content",
        "created_at",
        "parent_id",
        "deleted_at",
      ]),
    );
  });

  it("projects selected columns and honors AS aliases", async () => {
    await seedComments();
    const rs = await q("SELECT id AS comment_id, content FROM comments WHERE id = 'c1'");
    expect(rs.columns).toEqual(["comment_id", "content"]);
    expect(rs.rows[0]).toEqual({ comment_id: "c1", content: "first" });
  });

  it("projects missing columns as null", async () => {
    await seedComments();
    const rs = await q("SELECT id, parent_id FROM comments WHERE id = 'c1'");
    expect(rs.rows[0]).toEqual({ id: "c1", parent_id: null });
  });

  it("filters with = on a quoted literal", async () => {
    await seedComments();
    const rs = await q("SELECT id FROM comments WHERE proposal_id = 'p1'");
    expect(rs.rows).toEqual([{ id: "c1" }, { id: "c2" }]);
  });

  it("filters with a ? placeholder (statement object form)", async () => {
    await seedComments();
    const rs = await executeMock({
      sql: "SELECT id FROM comments WHERE proposal_id = ?",
      args: ["p2"],
    });
    expect(rs.rows).toEqual([{ id: "c3" }]);
  });

  it("supports != and <> as inequality forms", async () => {
    await seedComments();
    expect((await q("SELECT id FROM comments WHERE proposal_id != 'p1'")).rows).toEqual([
      { id: "c3" },
    ]);
    expect((await q("SELECT id FROM comments WHERE proposal_id <> 'p1'")).rows).toEqual([
      { id: "c3" },
    ]);
  });

  it("supports IN lists", async () => {
    await seedComments();
    const rs = await q("SELECT id FROM comments WHERE id IN ('c1', 'c3')");
    expect(rs.rows).toEqual([{ id: "c1" }, { id: "c3" }]);
  });

  it("compares ISO strings lexicographically with > and <", async () => {
    await seedComments();
    const after = await q(
      "SELECT id FROM comments WHERE created_at > '2026-01-01T00:00:00.000Z'",
    );
    expect(after.rows).toEqual([{ id: "c2" }, { id: "c3" }]);
    const before = await q(
      "SELECT id FROM comments WHERE created_at < '2026-01-02T00:00:00.000Z'",
    );
    expect(before.rows).toEqual([{ id: "c1" }]);
  });

  it("compares numeric cells with >= and <", async () => {
    await seedNotifications();
    expect((await q("SELECT id FROM notifications WHERE read >= 1")).rows).toHaveLength(2);
    expect((await q("SELECT id FROM notifications WHERE read < 1")).rows).toHaveLength(1);
  });

  it("treats a numeric string arg as equal to a numeric cell", async () => {
    await seedNotifications();
    // The arg arrives as the string "1" while the cell is the number 1.
    const rs = await q("SELECT id FROM notifications WHERE read = ?", ["1"]);
    expect(rs.rows).toHaveLength(2);
  });

  it("orders descending, then applies LIMIT and OFFSET", async () => {
    await seedComments();
    const rs = await q("SELECT id FROM comments ORDER BY created_at DESC LIMIT 2 OFFSET 1");
    expect(rs.rows).toEqual([{ id: "c2" }, { id: "c1" }]);
  });

  it("binds WHERE placeholders before LIMIT/OFFSET placeholders", async () => {
    await seedComments();
    const rs = await q(
      "SELECT id FROM comments WHERE proposal_id = ? ORDER BY created_at LIMIT ? OFFSET ?",
      ["p1", 1, 1],
    );
    // p1 rows are c1, c2; ascending order → offset 1 skips c1, limit 1 keeps c2.
    expect(rs.rows).toEqual([{ id: "c2" }]);
  });

  it("aggregates COUNT(*) into a single row", async () => {
    await seedComments();
    const rs = await q("SELECT COUNT(*) AS cnt FROM comments");
    expect(rs.rows).toEqual([{ cnt: 3 }]);
  });

  it("counts non-null columns with COUNT(col)", async () => {
    await seedNotifications();
    const rs = await q("SELECT COUNT(id) AS n FROM notifications");
    expect(rs.rows).toEqual([{ n: 3 }]);
  });

  it("sums numeric columns with SUM", async () => {
    await seedNotifications();
    const rs = await q("SELECT SUM(read) AS total FROM notifications");
    expect(rs.rows).toEqual([{ total: 2 }]);
  });

  it("groups aggregates by column value", async () => {
    await seedNotifications();
    const rs = await q("SELECT type, COUNT(*) AS n FROM notifications GROUP BY type");
    expect(rs.rows).toHaveLength(2);
    expect(rs.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "A", n: 2 }),
        expect.objectContaining({ type: "B", n: 1 }),
      ]),
    );
  });

  it("returns an empty page when nothing matches", async () => {
    await seedComments();
    const rs = await q("SELECT id FROM comments WHERE id = 'nope'");
    expect(rs.rows).toEqual([]);
  });

  it("returns an empty result for an unknown table", async () => {
    const rs = await q("SELECT * FROM not_a_table");
    expect(rs.rows).toEqual([]);
  });
});

describe("executeMock — INSERT", () => {
  it("reports rowsAffected and a numeric lastInsertRowid", async () => {
    await q("DELETE FROM comments");
    const rs = await q("INSERT INTO comments (id, proposal_id) VALUES ('i1', 'p1')");
    expect(rs.rowsAffected).toBe(1);
    expect(rs.lastInsertRowid).toBe(1n);
  });

  it("defaults created_at to now when omitted", async () => {
    // No wipe: the default derives the column list from the table's first row,
    // so the seeded table must still be populated.
    await q("INSERT INTO comments (id, proposal_id) VALUES ('i2', 'p1')");
    const row = getMockStore().comments.find((r) => r.id === "i2")!;
    expect(Date.parse(row.created_at ?? "")).toBeGreaterThan(Date.now() - 60_000);
  });

  it("fills proposal defaults (status, tallies, quorum, metadata)", async () => {
    await q("INSERT INTO proposals (id, title) VALUES ('prop-x', 'Scratch proposal')");
    const rs = await q("SELECT * FROM proposals WHERE id = 'prop-x'");
    expect(rs.rows[0]).toMatchObject({
      status: "DRAFT",
      votes_for: 0,
      votes_against: 0,
      votes_abstain: 0,
      quorum_required: 10,
      metadata: "{}",
    });
  });

  it("unescapes doubled single quotes in string literals", async () => {
    await q("DELETE FROM comments");
    await q("INSERT INTO comments (id, content) VALUES ('i3', 'it''s fine')");
    const row = getMockStore().comments.find((r) => r.id === "i3")!;
    expect(row.content).toBe("it's fine");
  });

  it("evaluates datetime('now') to the current ISO timestamp (UPDATE SET)", async () => {
    await seedComments();
    await q("UPDATE comments SET created_at = datetime('now') WHERE id = 'c1'");
    const row = getMockStore().comments.find((r) => r.id === "c1")!;
    expect(Date.parse(row.created_at ?? "")).toBeGreaterThan(Date.now() - 60_000);
  });

  it("parses datetime('now') whole inside INSERT VALUES (governance-vote shape)", async () => {
    // Regression: a lazy VALUES regex used to truncate at the first ')',
    // storing the garbage string "datetime('now'" as the timestamp.
    await q("INSERT INTO comments (id, created_at) VALUES ('i4', datetime('now'))");
    const row = getMockStore().comments.find((r) => r.id === "i4")!;
    expect(Date.parse(row.created_at ?? "")).toBeGreaterThan(Date.now() - 60_000);
  });

  it("applies sqlite-style datetime modifiers (UPDATE SET)", async () => {
    await seedComments();
    await q("UPDATE comments SET created_at = datetime('now', '+2 days') WHERE id = 'c1'");
    const row = getMockStore().comments.find((r) => r.id === "c1")!;
    const delta = Math.abs(Date.parse(row.created_at ?? "") - (Date.now() + 2 * 86_400_000));
    expect(delta).toBeLessThan(300_000);
  });

  it("coerces bound args: boolean → 1, Date → ISO, undefined → null", async () => {
    await seedNotifications();
    await q(
      "INSERT INTO notifications (id, user_id, type, read, title, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["i6", "u9", "C", true, new Date(Date.UTC(2026, 0, 1)), undefined] as unknown as InArgs,
    );
    const row = getMockStore().notifications.find((r) => r.id === "i6")!;
    expect(row.read).toBe(1);
    expect(row.title).toBe("2026-01-01T00:00:00.000Z");
    expect(row.created_at).toBeNull();
  });

  it("returns the inserted row via RETURNING with explicit columns", async () => {
    const rs = await q(
      "INSERT INTO comments (id, proposal_id, content) VALUES ('i7', 'p1', 'returned') RETURNING id, proposal_id, content, created_at",
    );
    expect(rs.columns).toEqual(["id", "proposal_id", "content", "created_at"]);
    expect(rs.rows[0]).toMatchObject({ id: "i7", proposal_id: "p1", content: "returned" });
    // created_at was defaulted during INSERT and surfaces in RETURNING.
    expect(Date.parse(String(rs.rows[0]!.created_at))).toBeGreaterThan(Date.now() - 60_000);
  });

  it("skips conflicting rows with ON CONFLICT DO NOTHING", async () => {
    await seedComments();
    const rs = await q(
      "INSERT INTO comments (id, proposal_id) VALUES ('c1', 'pX') ON CONFLICT (id) DO NOTHING",
    );
    expect(rs.rowsAffected).toBe(0);
    // The original row is untouched.
    expect(getMockStore().comments.find((r) => r.id === "c1")!.proposal_id).toBe("p1");
  });

  it("projects the existing row when ON CONFLICT DO NOTHING has RETURNING", async () => {
    await seedComments();
    const rs = await q(
      "INSERT INTO comments (id, proposal_id) VALUES ('c1', 'pX') ON CONFLICT (id) DO NOTHING RETURNING id, proposal_id",
    );
    expect(rs.rows[0]).toEqual({ id: "c1", proposal_id: "p1" });
  });

  it("inserts when the ON CONFLICT key does not collide", async () => {
    await seedComments();
    const rs = await q(
      "INSERT INTO comments (id, proposal_id) VALUES ('c9', 'p1') ON CONFLICT (id) DO NOTHING",
    );
    expect(rs.rowsAffected).toBe(1);
    expect(getMockStore().comments).toHaveLength(4);
  });
});

describe("executeMock — UPDATE", () => {
  it("updates matching rows with literal SET and WHERE", async () => {
    await seedComments();
    const rs = await q("UPDATE comments SET content = 'edited' WHERE id = 'c1'");
    expect(rs.rowsAffected).toBe(1);
    expect(getMockStore().comments.find((r) => r.id === "c1")!.content).toBe("edited");
  });

  it("binds SET placeholders before WHERE placeholders", async () => {
    await seedComments();
    await q("UPDATE comments SET content = ? WHERE id = ?", ["moved-on", "c2"]);
    expect(getMockStore().comments.find((r) => r.id === "c2")!.content).toBe("moved-on");
    expect(getMockStore().comments.find((r) => r.id === "c1")!.content).toBe("first");
  });

  it("reports every affected row on a multi-row update", async () => {
    await seedComments();
    const rs = await q(
      "UPDATE comments SET author_address = '0xnew' WHERE proposal_id = 'p1'",
    );
    expect(rs.rowsAffected).toBe(2);
  });

  it("affects nothing when no row matches", async () => {
    await seedComments();
    const rs = await q("UPDATE comments SET content = 'x' WHERE id = 'nope'");
    expect(rs.rowsAffected).toBe(0);
  });

  it("updates numeric columns", async () => {
    await seedNotifications();
    const rs = await q("UPDATE notifications SET read = 1 WHERE read = 0");
    expect(rs.rowsAffected).toBe(1);
    const sum = await q("SELECT SUM(read) AS total FROM notifications");
    expect(sum.rows).toEqual([{ total: 3 }]);
  });
});

describe("executeMock — DELETE", () => {
  it("removes only the rows matching the WHERE clause", async () => {
    await seedComments();
    const rs = await q("DELETE FROM comments WHERE id = 'c1'");
    expect(rs.rowsAffected).toBe(1);
    const remaining = await q("SELECT id FROM comments");
    expect(remaining.rows).toEqual([{ id: "c2" }, { id: "c3" }]);
  });

  it("binds WHERE placeholders in scoped deletes", async () => {
    await seedComments();
    const rs = await q("DELETE FROM comments WHERE proposal_id = ?", ["p2"]);
    expect(rs.rowsAffected).toBe(1);
    expect(getMockStore().comments).toHaveLength(2);
  });

  it("deletes every row when no WHERE clause is given", async () => {
    await seedComments();
    const rs = await q("DELETE FROM comments");
    expect(rs.rowsAffected).toBe(3);
    expect(getMockStore().comments).toHaveLength(0);
  });

  it("is a no-op for unknown tables", async () => {
    const rs = await q("DELETE FROM not_a_table WHERE id = 'x'");
    expect(rs.rows).toEqual([]);
    expect(rs.rowsAffected).toBe(0);
  });
});

describe("executeMock — degenerate statements", () => {
  it("returns an empty result for unsupported statement verbs", async () => {
    const rs = await q("DROP TABLE comments");
    expect(rs.rows).toEqual([]);
  });
});

describe("executeMock — comment_reactions", () => {
  // Regression for the production bug where the route referenced
  // comment_reactions but the mock-db switch did not register it; the
  // interpreter silently returned an empty result instead of throwing,
  // which made every proposal-comment reaction look successful in dev
  // mode but never persisted.

  beforeEach(async () => {
    await q("DELETE FROM comment_reactions");
  });

  it("INSERT/SELECT/DELETE round-trip on comment_reactions", async () => {
    const ins = await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-1', 'cmt-1', '0xabc', 'up')",
    );
    expect(ins.rowsAffected).toBe(1);

    const sel = await q(
      "SELECT id, type FROM comment_reactions WHERE comment_id = 'cmt-1'",
    );
    expect(sel.rows).toEqual([{ id: "rxn-1", type: "up" }]);

    const del = await q("DELETE FROM comment_reactions WHERE id = 'rxn-1'");
    expect(del.rowsAffected).toBe(1);

    const after = await q("SELECT id FROM comment_reactions");
    expect(after.rows).toEqual([]);
  });

  it("UPDATE swaps reaction type in place (used by the SWAP branch)", async () => {
    await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-2', 'cmt-2', '0xabc', 'up')",
    );
    await q("UPDATE comment_reactions SET type = 'down' WHERE id = 'rxn-2'");
    const sel = await q(
      "SELECT type FROM comment_reactions WHERE id = 'rxn-2'",
    );
    expect(sel.rows).toEqual([{ type: "down" }]);
  });

  it("supports ON CONFLICT (UNIQUE) DO NOTHING on (comment_id, user_address)", async () => {
    await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-3', 'cmt-3', '0xabc', 'up')",
    );
    const rs = await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-4', 'cmt-3', '0xabc', 'down') ON CONFLICT (comment_id, user_address) DO NOTHING",
    );
    expect(rs.rowsAffected).toBe(0);
    const after = await q(
      "SELECT type FROM comment_reactions WHERE comment_id = 'cmt-3'",
    );
    expect(after.rows).toEqual([{ type: "up" }]);
  });

  it("filters by user_address to hydrate myReaction", async () => {
    await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-5a', 'cmt-5', '0xaaa', 'up')",
    );
    await q(
      "INSERT INTO comment_reactions (id, comment_id, user_address, type) VALUES ('rxn-5b', 'cmt-5', '0xbbb', 'down')",
    );
    const sel = await q(
      "SELECT id, type FROM comment_reactions WHERE comment_id = 'cmt-5' AND user_address = ?",
      ["0xaaa"],
    );
    expect(sel.rows).toEqual([{ id: "rxn-5a", type: "up" }]);
  });
});

describe("getMockDbClient", () => {
  beforeEach(() => {
    delete (globalThis as typeof globalThis & { __omnomMockDbClient?: unknown })
      .__omnomMockDbClient;
  });

  it("caches the client on globalThis as a singleton", () => {
    const a = getMockDbClient();
    const b = getMockDbClient();
    expect(a).toBe(b);
    expect(
      (globalThis as typeof globalThis & { __omnomMockDbClient?: unknown }).__omnomMockDbClient,
    ).toBe(a);
  });

  it("execute delegates to executeMock", async () => {
    const client = getMockDbClient();
    const rs = await client.execute("SELECT * FROM comments");
    expect(rs.rows).toHaveLength(9);
  });

  it("batch resolves to an empty array", async () => {
    await expect(getMockDbClient().batch([])).resolves.toEqual([]);
  });

  it("transaction is explicitly unsupported", async () => {
    await expect(getMockDbClient().transaction()).rejects.toThrow(
      "mock-db: transactions are not supported",
    );
  });

  it("executeMultiple is a no-op that leaves data untouched", async () => {
    await expect(
      getMockDbClient().executeMultiple("DELETE FROM comments"),
    ).resolves.toBeUndefined();
    expect((await q("SELECT * FROM comments")).rows).toHaveLength(9);
  });

  it("migrate runs each statement sequentially and returns one result each", async () => {
    const client = getMockDbClient();
    const results = await client.migrate([
      "DELETE FROM comments",
      { sql: "INSERT INTO comments (id, proposal_id) VALUES ('m1', 'p1')" },
    ]);
    expect(results).toHaveLength(2);
    const rs = await q("SELECT id FROM comments");
    expect(rs.rows).toEqual([{ id: "m1" }]);
  });

  it("sync resolves undefined; reconnect/close are no-ops", async () => {
    const client = getMockDbClient();
    await expect(client.sync()).resolves.toBeUndefined();
    expect(() => {
      client.reconnect();
      client.close();
    }).not.toThrow();
    expect(client.closed).toBe(false);
    expect(client.protocol).toBe("mock");
  });
});
