import type { Client, InArgs, Replicated, ResultSet, Row } from "@libsql/client";

import {
  generateId,
  getMockStore,
  type MockStore,
} from "@/lib/mock-data";

/**
 * OMNOM DAO — Mock database adapter.
 *
 * Implements the same `execute()` interface as the Turso / libsql client
 * (`@libsql/client` `Client`) so that every API route, service, and data-access
 * helper continues to work UNCHANGED when no Turso database is configured.
 *
 * Instead of speaking a real SQL engine, it runs a focused mini-SQL interpreter
 * over the in-memory mock store (`@/lib/mock-data`). The interpreter supports
 * exactly the query shapes emitted by the existing code paths (SELECT with
 * WHERE / ORDER BY / LIMIT / OFFSET, COUNT(*), SUM(...) GROUP BY, INSERT ...
 * RETURNING, UPDATE, DELETE) — see the route handlers and service modules in
 * `src/lib` + `src/app/api/v1`.
 *
 * Why an interpreter instead of hard-coded per-query mocks: it stays correct as
 * the codebase adds queries, handles dynamic WHERE/ORDER/LIMIT combinations
 * (pagination, filtering, sorting) generically, and keeps mutations consistent
 * with subsequent reads (the store is mutated in place).
 *
 * The mock client is intentionally permissive: unknown / unsupported statements
 * resolve to an empty result set (for SELECT) or a no-op success (for writes)
 * rather than throwing, so the dev server never hard-crashes on an edge case.
 */

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type Cell = Row[keyof Row];

/** A mutable table is an array of plain row objects keyed by column name. */
type Table = Record<string, Cell>[];

function tableFor(store: MockStore, name: string): Table | undefined {
  switch (name) {
    case "users":
      return store.users as unknown as Table;
    case "proposals":
      return store.proposals as unknown as Table;
    case "votes":
      return store.votes as unknown as Table;
    case "comments":
      return store.comments as unknown as Table;
    case "notifications":
      return store.notifications as unknown as Table;
    case "delegations":
      return store.delegations as unknown as Table;
    case "proposal_templates":
      return store.proposal_templates as unknown as Table;
    case "user_settings":
      return store.user_settings as unknown as Table;
    case "audit_log":
      return store.audit_log as unknown as Table;
    case "governance_votes":
      return store.governance_votes as unknown as Table;
    case "governance_election":
      return store.governance_election as unknown as Table;
    case "governance_election_ballots":
      return store.governance_election_ballots as unknown as Table;
    case "governance_election_ballot_events":
      return store.governance_election_ballot_events as unknown as Table;
    default:
      return undefined;
  }
}

/** Strip SQL comments + collapse whitespace for easier matching. */
function normalizeSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve a SQL literal (`'foo'`, `123`, `datetime('now')`, etc.) to a value. */
function resolveLiteral(token: string): Cell {
  const t = token.trim();
  if (t === "?") return PLACEHOLDER as unknown as Cell;
  if (t === "null" || t === "NULL") return null;
  // single-quoted string literal
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  // datetime('now') or datetime('now', '-N seconds')
  const dt = t.match(/^datetime\(\s*'now'(?:\s*,\s*'([^']*)')?\s*\)$/i);
  if (dt) {
    const offset = dt[1]; // Capture group 1 is the offset parameter
    if (!offset) {
      return new Date().toISOString();
    }
    return applySqliteModifier(new Date(), offset);
  }
  // number
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  // bareword identifier / enum (e.g. 'pending', 'revoked', 'active', 'now')
  return t;
}

/** Apply a SQLite `datetime()` modifier like '-2592000 seconds'. */
function applySqliteModifier(base: Date, modifier: string): string {
  const m = modifier.trim();
  // '-N seconds' / '+N seconds'
  const sec = m.match(/^([+-]?\d+)\s+seconds?$/i);
  if (sec) return new Date(base.getTime() + Number(sec[1]) * 1000).toISOString();
  const min = m.match(/^([+-]?\d+)\s+minutes?$/i);
  if (min) return new Date(base.getTime() + Number(min[1]) * 60 * 1000).toISOString();
  const hr = m.match(/^([+-]?\d+)\s+hours?$/i);
  if (hr) return new Date(base.getTime() + Number(hr[1]) * 60 * 60 * 1000).toISOString();
  const day = m.match(/^([+-]?\d+)\s+days?$/i);
  if (day) return new Date(base.getTime() + Number(day[1]) * 24 * 60 * 60 * 1000).toISOString();
  return base.toISOString();
}

/** Sentinel used while parsing a VALUES tuple / SET clause to mark a placeholder. */
const PLACEHOLDER: unique symbol = Symbol("placeholder");

interface PlaceholderCursor {
  args: unknown[];
  index: number;
}

/** Pull the next positional arg, substituting the placeholder sentinel. */
function nextValue(
  resolved: Cell,
  cursor: PlaceholderCursor,
): Cell {
  if ((resolved as unknown) === PLACEHOLDER) {
    const v = cursor.args[cursor.index++];
    return coerceInValue(v);
  }
  return resolved;
}

/** Coerce an incoming libsql InValue to a stored cell (booleans → 0/1, Date → ISO). */
function coerceInValue(v: unknown): Cell {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return null; // binary blobs not stored in mock
  return v as Cell;
}

// ─────────────────────────────────────────────────────────────
// WHERE evaluation
// ─────────────────────────────────────────────────────────────

interface Condition {
  col: string;
  op: "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" | "IN";
  value: Cell | Cell[]; // PLACEHOLDER → resolve via cursor; arrays for IN
}

/**
 * Split a SQL fragment on a keyword that sits at the top paren-depth level.
 * Returns [before, after] or null when the keyword is absent.
 */
function splitOnKeyword(clause: string, keyword: string): [string, string] | null {
  const re = new RegExp(`\\b${keyword}\\b`, "i");
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < clause.length; i++) {
    const ch = clause[i]!;
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0) {
      const tail = clause.slice(i);
      const m = tail.match(re);
      if (m && m.index !== undefined && (i === 0 || /\s/.test(clause[i - 1]!))) {
        const at = i + m.index;
        return [clause.slice(0, at).trim(), clause.slice(at + m[0].length).trim()];
      }
    }
  }
  return null;
}

/**
 * Parse a `WHERE <conditions>` fragment into structured conditions.
 *
 * Placeholders (`?`) are resolved against `cursor` ONCE, here, so the returned
 * conditions hold concrete values and `rowMatches` can evaluate every row
 * against the same bound value (mirrors real SQL parameter binding).
 */
function parseWhere(whereSql: string, cursor: PlaceholderCursor): Condition[] {
  if (!whereSql) return [];
  const conds: Condition[] = [];
  // Split top-level AND (OR is not used by the app).
  const parts = splitTopLevel(whereSql, "AND");
  for (const raw of parts) {
    const cond = parseSingleCondition(raw.trim(), cursor);
    if (cond) conds.push(cond);
  }
  return conds;
}

function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let buf = "";
  const upper = input.toUpperCase();
  const sepU = sep.toUpperCase();
  // Symbolic separators (e.g. ",") split unconditionally at top level; keyword
  // separators (e.g. AND/FROM) require word boundaries so we don't split on
  // substrings inside identifiers.
  const isSymbolic = !/[A-Za-z]/.test(sep);
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === "'") inStr = !inStr;
    if (inStr) {
      buf += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && upper.slice(i, i + sepU.length) === sepU) {
      const beforeOk =
        isSymbolic || i === 0 || /[\s)]/.test(input[i - 1]!);
      const afterOk =
        isSymbolic ||
        i + sepU.length >= input.length ||
        /\s/.test(input[i + sepU.length]!);
      if (beforeOk && afterOk) {
        out.push(buf);
        buf = "";
        i += sepU.length - 1;
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function parseSingleCondition(raw: string, cursor: PlaceholderCursor): Condition | null {
  if (!raw) return null;

  // col IN ( a, b, c )
  const inMatch = raw.match(/^[`\[]?([\w.]+)[`\]]?\s+IN\s*\((.+)\)$/i);
  if (inMatch) {
    const col = unquoteIdent(inMatch[1]!);
    const list = splitTopLevel(inMatch[2]!, ",").map((t) => {
      const lit = resolveLiteral(t.trim());
      return (lit as unknown) === PLACEHOLDER
        ? coerceInValue(cursor.args[cursor.index++])
        : lit;
    });
    return { col, op: "IN", value: list };
  }

  // comparison operators
  const cmp = raw.match(
    /^([`\[]?[\w.]+[`\]]?)\s*(<=|>=|<>|!=|=|<|>)\s*(.+)$/,
  );
  if (cmp) {
    const col = unquoteIdent(cmp[1]!);
    const op = cmp[2] as Condition["op"];
    const lit = resolveLiteral(cmp[3]!.trim());
    const val =
      (lit as unknown) === PLACEHOLDER
        ? coerceInValue(cursor.args[cursor.index++])
        : lit;
    return { col, op, value: val };
  }
  return null;
}

function unquoteIdent(s: string): string {
  return s.replace(/[`[\]]/g, "");
}

function rowMatches(row: Record<string, Cell>, conds: Condition[]): boolean {
  for (const c of conds) {
    const cellVal = row[c.col] ?? null;
    if (c.op === "IN") {
      const list = c.value as Cell[];
      if (!list.some((v) => cellsEqual(cellVal, v))) return false;
      continue;
    }
    const rhs = c.value as Cell;
    switch (c.op) {
      case "=":
        if (!cellsEqual(cellVal, rhs)) return false;
        break;
      case "!=":
      case "<>":
        if (cellsEqual(cellVal, rhs)) return false;
        break;
      case ">":
        if (!(compareCells(cellVal, rhs) > 0)) return false;
        break;
      case ">=":
        if (!(compareCells(cellVal, rhs) >= 0)) return false;
        break;
      case "<":
        if (!(compareCells(cellVal, rhs) < 0)) return false;
        break;
      case "<=":
        if (!(compareCells(cellVal, rhs) <= 0)) return false;
        break;
    }
  }
  return true;
}

function cellsEqual(a: Cell | undefined, b: Cell | undefined): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  // Normalize numbers vs numeric strings for parity (read=0 / read="0").
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

/** Lexicographic/numeric comparison returning -1 | 0 | 1. Works for ISO timestamps. */
function compareCells(a: Cell | undefined, b: Cell | undefined): number {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b > 0 ? 1 : a - b < 0 ? -1 : 0;
  const sa = String(a);
  const sb = String(b);
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Result construction
// ─────────────────────────────────────────────────────────────

function makeResultSet(rows: Record<string, Cell>[], columns?: string[]): ResultSet {
  const cols = columns ?? (rows.length > 0 ? Object.keys(rows[0]!) : []);
  return {
    columns: cols,
    columnTypes: cols.map(() => ""),
    rows: rows as unknown as Row[],
    rowsAffected: rows.length,
    lastInsertRowid: undefined,
    toJSON() {
      return { columns: cols, rows, rowsAffected: rows.length };
    },
  };
}

function emptyResultSet(): ResultSet {
  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 0,
    lastInsertRowid: undefined,
    toJSON: () => ({ columns: [], rows: [], rowsAffected: 0 }),
  };
}

// ─────────────────────────────────────────────────────────────
// Statement parsing & dispatch
// ─────────────────────────────────────────────────────────────

interface ParsedStatement {
  sql: string;
  args: InArgs;
}

function toParsed(stmt: string | { sql: string; args?: InArgs }): ParsedStatement {
  if (typeof stmt === "string") return { sql: stmt, args: [] };
  return { sql: stmt.sql, args: stmt.args ?? [] };
}

/** A column requested in a SELECT list (with optional alias). */
interface SelectColumn {
  /** source column name, or "*" for all */
  source: string;
  /** output column name (alias) */
  out: string;
  /** aggregate kind, if any */
  agg?: "COUNT" | "SUM";
}

export function executeMock(stmt: string | { sql: string; args?: InArgs }): Promise<ResultSet> {
  const parsed = toParsed(stmt);
  const sql = normalizeSql(parsed.sql);
  const upper = sql.toUpperCase();
  try {
    if (upper.startsWith("SELECT")) {
      return Promise.resolve(handleSelect(sql, upper, parsed.args));
    }
    if (upper.startsWith("INSERT")) {
      return Promise.resolve(handleInsert(sql, parsed.args));
    }
    if (upper.startsWith("UPDATE")) {
      return Promise.resolve(handleUpdate(sql, parsed.args));
    }
    if (upper.startsWith("DELETE")) {
      return Promise.resolve(handleDelete(sql, parsed.args));
    }
    // Unknown statement → empty success.
    return Promise.resolve(emptyResultSet());
  } catch (err) {
    console.error("[mock-db] failed to interpret statement:", sql, err);
    return Promise.resolve(emptyResultSet());
  }
}

// ── SELECT ───────────────────────────────────────────────────

interface TailClauses {
  where?: string;
  groupBy?: string;
  orderBy?: string;
  limit?: string;
  offset?: string;
}

/**
 * Slice a post-FROM tail into its clause bodies (WHERE / GROUP BY / ORDER BY /
 * LIMIT / OFFSET). Each clause body spans from its keyword to the next keyword,
 * respecting string literals + parens.
 */
function splitClauses(tail: string): TailClauses {
  const keywords = ["WHERE", "GROUP BY", "ORDER BY", "LIMIT", "OFFSET"];
  // Locate each keyword occurrence at top paren/quote depth.
  const positions: Array<{ kw: string; start: number; end: number }> = [];
  for (const kw of keywords) {
    const idx = findKeyword(tail, kw);
    if (idx >= 0) {
      positions.push({ kw, start: idx, end: idx + kw.length });
    }
  }
  positions.sort((a, b) => a.start - b.start);

  const out: TailClauses = {};
  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i]!;
    const next = positions[i + 1];
    const body = tail.slice(cur.end, next ? next.start : tail.length).trim();
    const key =
      cur.kw === "GROUP BY"
        ? "groupBy"
        : cur.kw === "ORDER BY"
          ? "orderBy"
          : (cur.kw.toLowerCase() as "where" | "limit" | "offset");
    out[key] = body;
  }
  return out;
}

/** Find the index of a SQL keyword at the top paren/quote depth, or -1. */
function findKeyword(s: string, kw: string): number {
  const upper = s.toUpperCase();
  const re = new RegExp(`\\b${kw.toUpperCase()}\\b`, "g");
  let depth = 0;
  let inStr = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper)) !== null) {
    const at = m.index;
    // Verify depth/quote state by scanning up to `at`.
    depth = 0;
    inStr = false;
    for (let i = 0; i < at; i++) {
      const ch = s[i]!;
      if (ch === "'") inStr = !inStr;
      if (inStr) continue;
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (depth === 0 && !inStr) return at;
  }
  return -1;
}

function handleSelect(sql: string, upper: string, rawArgs: InArgs): ResultSet {
  const store = getMockStore();
  const cursor: PlaceholderCursor = { args: rawArgs as unknown[], index: 0 };

  // Strip the leading SELECT keyword.
  const afterSelect = sql.slice(6).trim();

  // Split SELECT-list / rest on the top-level FROM.
  const fromSplit = splitOnKeyword(afterSelect, "FROM");
  if (!fromSplit) return emptyResultSet();
  const [selectListRaw, restRaw] = fromSplit;
  const selectList = selectListRaw.trim();

  // Identify the table (first token after FROM).
  const tableMatch = restRaw.match(/^([A-Za-z_][\w]*)/);
  if (!tableMatch) return emptyResultSet();
  const tableName = tableMatch[1]!;
  const table = tableFor(store, tableName);
  if (!table) return emptyResultSet();

  // Slice the tail into clauses by locating each keyword at top paren depth and
  // taking the text between it and the next keyword. (splitOnKeyword alone is
  // insufficient because the WHERE conditions run right up to GROUP BY / ORDER
  // BY / LIMIT, not to the end of the string.)
  const rest = restRaw.slice(tableMatch[0].length).trim();
  const clauses = splitClauses(rest);

  let groupByCol = "";
  let orderCol = "";
  let orderDir: "ASC" | "DESC" = "ASC";
  if (clauses.groupBy) groupByCol = unquoteIdent(clauses.groupBy.trim());
  if (clauses.orderBy) {
    const obParts = clauses.orderBy.trim().split(/\s+/);
    orderCol = unquoteIdent(obParts[0]!);
    if (obParts[1] && obParts[1].toUpperCase() === "DESC") orderDir = "DESC";
  }

  // Resolve WHERE first — its `?` placeholders precede LIMIT/OFFSET `?` in the
  // positional arg list (e.g. `... WHERE status = ? ... LIMIT ? OFFSET ?`).
  const conds = parseWhere(clauses.where ?? "", cursor);
  const filtered = table.filter((row) => rowMatches(row, conds));

  // Now resolve LIMIT / OFFSET (the trailing positional args).
  let limit = -1;
  let offset = 0;
  if (clauses.limit !== undefined) {
    const loParts = clauses.limit.split(/\s+OFFSET\s+/i);
    limit = resolveNumberOrArg(loParts[0]!.trim(), cursor);
    if (loParts[1]) {
      offset = resolveNumberOrArg(loParts[1]!.trim(), cursor);
    }
  }
  if (clauses.offset !== undefined) {
    offset = resolveNumberOrArg(clauses.offset.trim(), cursor);
  }

  const cols = parseSelectList(selectList);
  const isStar = cols.length === 1 && cols[0]!.source === "*";
  const hasAgg = cols.some((c) => c.agg);

  // Aggregate path: SUM(col) AS x ... GROUP BY col  OR  COUNT(*) AS cnt
  if (hasAgg) {
    const rs = aggregateSelect(filtered, cols, groupByCol);
    // ORDER BY / LIMIT / OFFSET apply to the aggregated rows too (e.g.
    // `GROUP BY x ORDER BY cnt DESC LIMIT ?` ranks the groups themselves).
    if (orderCol) {
      rs.rows.sort((a, b) => {
        const cmp = compareCells(a[orderCol] ?? null, b[orderCol] ?? null);
        return orderDir === "DESC" ? -cmp : cmp;
      });
    }
    let rows = rs.rows;
    if (offset > 0) rows = rows.slice(offset);
    if (limit >= 0) rows = rows.slice(0, limit);
    return makeResultSet(rows, rs.columns);
  }

  // ORDER BY
  if (orderCol) {
    filtered.sort((a, b) => {
      const cmp = compareCells(a[orderCol] ?? null, b[orderCol] ?? null);
      return orderDir === "DESC" ? -cmp : cmp;
    });
  }

  // LIMIT / OFFSET
  let paged = filtered;
  if (offset > 0) paged = paged.slice(offset);
  if (limit >= 0) paged = paged.slice(0, limit);

  // Project columns.
  const projected = isStar
    ? paged
    : paged.map((row) => {
        const out: Record<string, Cell> = {};
        for (const c of cols) {
          out[c.out] = row[c.source] ?? null;
        }
        return out;
      });

  const outCols = isStar
    ? paged.length > 0
      ? Object.keys(paged[0]!)
      : Object.keys(table[0] ?? {})
    : cols.map((c) => c.out);
  return makeResultSet(projected, outCols);
}

function resolveNumberOrArg(token: string, cursor: PlaceholderCursor): number {
  const t = token.trim();
  if (t === "?") return Number(coerceInValue(cursor.args[cursor.index++]));
  return Number(t);
}

function parseSelectList(raw: string): SelectColumn[] {
  const parts = splitTopLevel(raw, ",");
  return parts.map((part) => {
    const p = part.trim();
    // COUNT(*) AS alias
    const countM = p.match(/^COUNT\s*\(\s*\*\s*\)(?:\s+AS\s+([\w]+))?$/i);
    if (countM) {
      return { source: "*", out: countM[1] ?? "cnt", agg: "COUNT" as const };
    }
    // COUNT(col) AS alias
    const countColM = p.match(/^COUNT\s*\(\s*([\w]+)\s*\)(?:\s+AS\s+([\w]+))?$/i);
    if (countColM) {
      return { source: countColM[1]!, out: countColM[2] ?? countColM[1]!, agg: "COUNT" as const };
    }
    // SUM(col) AS alias
    const sumM = p.match(/^SUM\s*\(\s*([\w]+)\s*\)(?:\s+AS\s+([\w]+))?$/i);
    if (sumM) {
      return { source: sumM[1]!, out: sumM[2] ?? sumM[1]!, agg: "SUM" as const };
    }
    // col AS alias  |  col  |  *
    const simple = p.match(/^([\w*]+)(?:\s+AS\s+([\w]+))?$/i);
    if (simple) {
      return { source: simple[1]!, out: simple[2] ?? simple[1]! };
    }
    // Fallback: treat the whole token as a literal column name.
    return { source: p, out: p };
  });
}

function aggregateSelect(
  rows: Record<string, Cell>[],
  cols: SelectColumn[],
  groupByCol: string,
): ResultSet {
  const resultRows: Record<string, Cell>[] = [];

  if (groupByCol) {
    const groups = new Map<Cell, Record<string, Cell>[]>();
    for (const r of rows) {
      const key = r[groupByCol] ?? null;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    for (const [key, group] of groups) {
      const out: Record<string, Cell> = {};
      for (const c of cols) {
        if (c.agg === "SUM") {
          out[c.out] = group.reduce((sum, r) => sum + Number(r[c.source] ?? 0), 0);
        } else if (c.agg === "COUNT") {
          out[c.out] = group.length;
        } else if (c.source === groupByCol) {
          out[c.out] = key;
        }
      }
      resultRows.push(out);
    }
    return makeResultSet(resultRows, cols.map((c) => c.out));
  }

  // No GROUP BY: single aggregated row (COUNT(*) etc.).
  const out: Record<string, Cell> = {};
  for (const c of cols) {
    if (c.agg === "COUNT") {
      out[c.out] = rows.length;
    } else if (c.agg === "SUM") {
      out[c.out] = rows.reduce((sum, r) => sum + Number(r[c.source] ?? 0), 0);
    }
  }
  return makeResultSet([out], cols.map((c) => c.out));
}

// ── INSERT ───────────────────────────────────────────────────

function handleInsert(sql: string, rawArgs: InArgs): ResultSet {
  const store = getMockStore();
  const cursor: PlaceholderCursor = { args: rawArgs as unknown[], index: 0 };

  // INSERT INTO <table> (cols) VALUES (...) [RETURNING cols] [ON CONFLICT ...]
  // The VALUES group is greedy up to the last ')' whose remainder is empty or
  // starts with RETURNING/ON CONFLICT — a lazy `(.+?)` would truncate at the
  // first ')', corrupting parenthesized literals like datetime('now').
  const headMatch = sql.match(/^INSERT\s+INTO\s+([A-Za-z_][\w]*)\s*(?:\(([^)]*)\))?\s*VALUES\s*\((.+)\)\s*((?:RETURNING|ON\s+CONFLICT)\b.*)?$/i);
  if (!headMatch) return emptyResultSet();
  const tableName = headMatch[1]!;
  const colsPart = headMatch[2] ?? "";
  const valuesPart = headMatch[3]!;
  const tail = (headMatch[4] ?? "").trim();

  const table = tableFor(store, tableName);
  if (!table) return emptyResultSet();

  // Resolve the column list: explicit, or inferred from the table's existing shape.
  const knownCols =
    colsPart.trim().length > 0
      ? colsPart.split(",").map((c) => unquoteIdent(c.trim()))
      : table.length > 0
        ? Object.keys(table[0]!)
        : [];

  const valueTokens = splitTopLevel(valuesPart, ",");
  const newRow: Record<string, Cell> = {};

  valueTokens.forEach((tok, i) => {
    const col = knownCols[i];
    if (!col) return;
    const resolved = resolveLiteral(tok.trim());
    newRow[col] = nextValue(resolved, cursor);
  });

  // Apply schema defaults for auto-generated columns.
  // Check against the table's actual shape (not just the INSERT column list)
  // so columns like created_at are auto-populated even when omitted from the
  // INSERT statement (e.g. INSERT INTO comments (proposal_id, ...) ...).
  const tableCols = table.length > 0 ? Object.keys(table[0]!) : knownCols;
  if (!("id" in newRow)) {
    newRow.id = generateId();
  }
  const nowIso = new Date().toISOString();
  if (!("created_at" in newRow) && tableCols.includes("created_at")) {
    newRow.created_at = nowIso;
  }
  if (!("last_login_at" in newRow) && tableCols.includes("last_login_at")) {
    newRow.last_login_at = nowIso;
  }
  // Default status / counts for proposals.
  if (tableName === "proposals") {
    if (!("status" in newRow)) newRow.status = "DRAFT";
    if (!("votes_for" in newRow)) newRow.votes_for = 0;
    if (!("votes_against" in newRow)) newRow.votes_against = 0;
    if (!("votes_abstain" in newRow)) newRow.votes_abstain = 0;
    if (!("quorum_required" in newRow)) newRow.quorum_required = 10.0;
    if (!("metadata" in newRow)) newRow.metadata = "{}";
    if (!("updated_at" in newRow)) newRow.updated_at = null;
  }
  if (tableName === "notifications" && !("read" in newRow)) {
    newRow.read = 0;
  }

  // ON CONFLICT DO NOTHING → skip if a row with the same unique key exists.
  const onConflict = /ON\s+CONFLICT/i.test(tail);
  if (onConflict) {
    const conflictTarget = tail.match(/ON\s+CONFLICT\s*\(([^)]+)\)/i);
    const conflictCols = conflictTarget
      ? conflictTarget[1]!.split(",").map((c) => unquoteIdent(c.trim()))
      : ["id"];
    const exists = table.some((r) => conflictCols.every((c) => cellsEqual(r[c], newRow[c])));
    if (exists) {
      const returningCols = parseReturning(tail) ?? [];
      if (returningCols.length > 0) {
        const existing = table.find((r) => conflictCols.every((c) => cellsEqual(r[c], newRow[c])))!;
        return makeResultSet([projectRow(existing, returningCols)], returningCols);
      }
      return emptyResultSet();
    }
  }

  // Cast into the table's typed array (the store mutates in place).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table as any[]).push(newRow);

  // RETURNING
  const returningCols = parseReturning(tail);
  if (returningCols && returningCols.length > 0) {
    // created_at may have been defaulted above — surface it in RETURNING.
    return makeResultSet([projectRow(newRow, returningCols)], returningCols);
  }

  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: 1,
    lastInsertRowid: BigInt(table.length),
    toJSON: () => ({ columns: [], rows: [], rowsAffected: 1 }),
  };
}

function parseReturning(tail: string): string[] | null {
  const m = tail.match(/RETURNING\s+(.+?)(?:\s+ON\s+CONFLICT.*)?$/i);
  if (!m) return null;
  return splitTopLevel(m[1]!, ",").map((c) => unquoteIdent(c.trim()));
}

function projectRow(row: Record<string, Cell>, cols: string[]): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const c of cols) {
    out[c] = row[c] ?? (c === "created_at" ? new Date().toISOString() : null);
  }
  return out;
}

// ── UPDATE ───────────────────────────────────────────────────

function handleUpdate(sql: string, rawArgs: InArgs): ResultSet {
  const store = getMockStore();
  const cursor: PlaceholderCursor = { args: rawArgs as unknown[], index: 0 };

  // UPDATE <table> SET col = ?, col = 'lit', ... WHERE <conds>
  const m = sql.match(/^UPDATE\s+([A-Za-z_][\w]*)\s+SET\s+(.+)$/i);
  if (!m) return emptyResultSet();
  const tableName = m[1]!;
  const table = tableFor(store, tableName);
  if (!table) return emptyResultSet();

  // splitOnKeyword returns [before-WHERE, after-WHERE]; SET is the part before
  // WHERE and the conditions are the part after.
  let setSql = m[2]!;
  let whereSql = "";
  const whereSplit = splitOnKeyword(setSql, "WHERE");
  if (whereSplit) {
    setSql = whereSplit[0];
    whereSql = whereSplit[1];
  }

  // Resolve the WHERE placeholders first (they follow SET placeholders in the
  // arg list? No — in SQL `UPDATE t SET a=? WHERE b=?` the SET `?`s come BEFORE
  // the WHERE `?`s. So bind SET first, then WHERE.)
  const assigns: Array<{ col: string; value: Cell }> = [];
  for (const part of splitTopLevel(setSql, ",")) {
    const eq = part.trim().match(/^([\w]+)\s*=\s*(.+)$/);
    if (!eq) continue;
    const col = unquoteIdent(eq[1]!);
    const rawLit = eq[2]!.trim();
    const lit = resolveLiteral(rawLit);
    const value: Cell =
      (lit as unknown) === PLACEHOLDER
        ? coerceInValue(cursor.args[cursor.index++])
        : lit;
    assigns.push({ col, value });
  }

  const conds = parseWhere(whereSql, cursor);
  let affected = 0;
  for (const row of table) {
    if (!rowMatches(row, conds)) continue;
    for (const a of assigns) {
      row[a.col] = a.value;
    }
    affected++;
  }

  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: affected,
    lastInsertRowid: undefined,
    toJSON: () => ({ columns: [], rows: [], rowsAffected: affected }),
  };
}

// ── DELETE ───────────────────────────────────────────────────

function handleDelete(sql: string, rawArgs: InArgs): ResultSet {
  const store = getMockStore();
  const cursor: PlaceholderCursor = { args: rawArgs as unknown[], index: 0 };

  const m = sql.match(/^DELETE\s+FROM\s+([A-Za-z_][\w]*)\s*(.*)$/i);
  if (!m) return emptyResultSet();
  const tableName = m[1]!;
  const table = tableFor(store, tableName);
  if (!table) return emptyResultSet();

  const rest = m[2] ?? "";
  let whereSql = "";
  const whereSplit = splitOnKeyword(rest, "WHERE");
  if (whereSplit) {
    // splitOnKeyword returns [before-WHERE, after-WHERE] — the conditions are
    // the part *after* the keyword (mirrors the UPDATE handler above).
    whereSql = whereSplit[1];
  }
  const conds = parseWhere(whereSql, cursor);
  const before = table.length;
  for (let i = table.length - 1; i >= 0; i--) {
    if (rowMatches(table[i]!, conds)) {
      table.splice(i, 1);
    }
  }
  const affected = before - table.length;

  return {
    columns: [],
    columnTypes: [],
    rows: [],
    rowsAffected: affected,
    lastInsertRowid: undefined,
    toJSON: () => ({ columns: [], rows: [], rowsAffected: affected }),
  };
}

// ─────────────────────────────────────────────────────────────
// Public mock client (implements @libsql/client `Client`)
// ─────────────────────────────────────────────────────────────

/**
 * The singleton mock database client. Returned by `db.ts` when Turso is not
 * configured. Mutations write through to the live in-memory store.
 */
/**
 * Get the shared mock database client.
 *
 * Uses globalThis to ensure all Next.js route modules share the same client
 * instance, even under Turbopack's separate module compilation.
 */
export function getMockDbClient(): Client {
  const g = globalThis as typeof globalThis & {
    __omnomMockDbClient?: Client;
  };

  if (g.__omnomMockDbClient) {
    return g.__omnomMockDbClient;
  }

  const client: Client = {
    execute: executeMock,
    async batch() {
      return [];
    },
    async transaction() {
      throw new Error("mock-db: transactions are not supported");
    },
    async executeMultiple() {
      // no-op
    },
    async migrate(stmts: Array<{ sql: string; args?: InArgs } | string>) {
      // Run each migration statement sequentially against the mock store and
      // return an empty result set per statement (the libsql `migrate` contract).
      const results: ResultSet[] = [];
      for (const stmt of stmts) {
        results.push(await executeMock(stmt));
      }
      return results;
    },
    async sync(): Promise<Replicated> {
      // no-op — the mock store is local and needs no replication sync.
      // Returns `undefined` to signal "nothing was replicated".
      return undefined;
    },
    reconnect() {
      // no-op — the mock store is always connected
    },
    close() {
      // no-op
    },
    closed: false,
    protocol: "mock",
    // The libsql Client interface also exposes `intMode` in some versions; the
    // exported type only mandates the methods above, so this object is assignable.
  };

  g.__omnomMockDbClient = client;
  return client;
}

/**
 * Legacy export for backward compatibility.
 * Delegates to the globalThis-cached singleton.
 * IMPORTANT: Do NOT export as a const. Module-level consts create separate instances
 * under Turbopack's separate module compilation. Always call getMockDbClient() as a function.
 */
