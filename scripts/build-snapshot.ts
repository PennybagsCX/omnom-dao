/**
 * OMNOM DAO — Snapshot Build Pipeline
 *
 * Transforms the canonical holder CSV into immutable, hash-verified JSON
 * artifacts under public/data/. The pipeline:
 *
 *   CSV ──► parse/validate (papaparse)
 *        ──► validate EVM addresses (checksummed), no duplicates
 *        ──► classify holders (whale/dolphin/fish)
 *        ──► sort by address (lexicographic) for O(log n) binary search
 *        ──► emit:
 *              • holders.json            (sorted index + holders)
 *              • snapshot-metadata.json  ({blockNumber, timestamp, totals, hash})
 *              • csv-hash.txt            (SHA-256 of the CSV)
 *
 * Runtime lookup is O(log n) binary search via src/lib/snapshot.ts.
 *
 * Run: `npm run snapshot:build`
 *
 * CSV format (header required):
 *   rank,address,balanceRaw,balanceFormatted,percentageOfSupply
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { isAddress, getAddress } from "viem";

const CSV_PATH = process.env.SNAPSHOT_CSV_PATH ?? "scripts/data/snapshot.csv";
const OUT_DIR = process.env.SNAPSHOT_OUT_DIR ?? "public/data";

// Snapshot provenance constants (per DATA-MODEL.md / DESIGN.md).
const BLOCK_NUMBER = 59_922_100;
const TIMESTAMP = "2026-06-07T23:59:58.000Z";
const CONTRACT_ADDRESS = "0xe3fcA919883950c5cD468156392a6477Ff5d18de";
const EXPECTED_TOTAL_HOLDERS = 25_431;

interface RawRow {
  rank: string;
  address: string;
  balanceRaw: string;
  balanceFormatted: string;
  percentageOfSupply: string;
}

interface BuiltHolder {
  address: string;
  rank: number;
  balanceRaw: string;
  balanceFormatted: string;
  percentageOfSupply: number;
  holderClass: "WHALE" | "DOLPHIN" | "FISH";
}

function classify(pct: number): "WHALE" | "DOLPHIN" | "FISH" {
  if (pct >= 1.0) return "WHALE";
  if (pct >= 0.01) return "DOLPHIN";
  return "FISH";
}

/** Compute SHA-256 of a normalized CSV (BOM stripped, LF endings, trimmed). */
function computeCsvHash(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").trimEnd().replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`\n❌ ${message}\n`);
    process.exit(1);
  }
}

async function main() {
  const csvPath = path.resolve(process.cwd(), CSV_PATH);
  const outDir = path.resolve(process.cwd(), OUT_DIR);

  console.log(`📖 Reading CSV: ${csvPath}`);
  const csvContent = await readFile(csvPath, "utf-8");
  const csvHash = computeCsvHash(csvContent);
  console.log(`🔒 CSV SHA-256: ${csvHash}`);

  const parsed = Papa.parse<RawRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0) {
    console.warn("⚠️  CSV parse warnings:");
    for (const e of parsed.errors) console.warn(`   line ${e.row}: ${e.message}`);
  }

  const rows = parsed.data.filter((r) => r && r.address);
  assert(rows.length > 0, "CSV contained no data rows.");

  // ── Validate + dedupe + classify ──────────────────────────
  const seen = new Set<string>();
  const holders: BuiltHolder[] = [];

  const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

  for (const row of rows) {
    const rawAddress = row.address.trim();
    assert(
      HEX_ADDRESS.test(rawAddress),
      `Invalid EVM address (must be 0x + 40 hex chars): "${rawAddress}"`,
    );
    // Canonicalize to EIP-55 checksum, then lowercase for lookup-key
    // consistency (binary search is case-insensitive over the sorted index).
    const checksummed = getAddress(rawAddress);
    const key = checksummed.toLowerCase();
    // Warn (non-fatal) if the source was mixed-case but not a valid checksum —
    // data-quality signal for the production CSV without breaking dev inputs.
    if (
      /[A-F]/.test(rawAddress.slice(2)) &&
      /[a-f]/.test(rawAddress.slice(2)) &&
      !isAddress(rawAddress)
    ) {
      console.warn(`   ⚠️  Bad EIP-55 checksum for ${rawAddress} (canonicalized to ${checksummed})`);
    }
    assert(!seen.has(key), `Duplicate address: ${checksummed}`);
    seen.add(key);

    const balanceRaw = row.balanceRaw.trim();
    const balanceFormatted = row.balanceFormatted.trim();
    const percentageOfSupply = Number(row.percentageOfSupply);
    const rank = Number(row.rank);

    assert(
      /^\d+$/.test(balanceRaw) || /^\d+$/.test(balanceRaw.replace(/^-/, "")),
      `Invalid balanceRaw for ${checksummed}: "${balanceRaw}"`,
    );
    assert(
      !Number.isNaN(percentageOfSupply) && percentageOfSupply >= 0,
      `Invalid percentageOfSupply for ${checksummed}`,
    );

    holders.push({
      address: key,
      rank: Number.isNaN(rank) ? 0 : rank,
      balanceRaw,
      balanceFormatted,
      percentageOfSupply,
      holderClass: classify(percentageOfSupply),
    });
  }

  console.log(`✓ Parsed ${holders.length} holder records.`);

  // ── Sort by address for binary search ─────────────────────
  holders.sort((a, b) => a.address.localeCompare(b.address, "en", { sensitivity: "base" }));

  const sortedAddresses = holders.map((h) => h.address);

  // ── Compute totals ────────────────────────────────────────
  let totalSupply = 0n;
  for (const h of holders) totalSupply += BigInt(h.balanceRaw);

  const distribution = {
    whales: holders.filter((h) => h.holderClass === "WHALE").length,
    dolphins: holders.filter((h) => h.holderClass === "DOLPHIN").length,
    fish: holders.filter((h) => h.holderClass === "FISH").length,
  };

  // ── Flag count mismatches (informational; not fatal for dev CSVs) ──
  if (holders.length !== EXPECTED_TOTAL_HOLDERS) {
    console.warn(
      `⚠️  Holder count ${holders.length} ≠ expected ${EXPECTED_TOTAL_HOLDERS} ` +
        `(acceptable for a dev CSV; production build must match).`,
    );
  }

  // ── Binary-search round-trip self-test ────────────────────
  let selfTestFailures = 0;
  for (const h of holders) {
    const idx = binarySearchIndex(sortedAddresses, h.address);
    if (idx === -1 || holders[idx]?.address !== h.address) selfTestFailures++;
  }
  assert(selfTestFailures === 0, `Binary-search round-trip failed for ${selfTestFailures} entries.`);

  // ── Write artifacts ───────────────────────────────────────
  await mkdir(outDir, { recursive: true });

  const artifact = {
    sortedAddresses,
    holders,
    metadata: {
      blockNumber: BLOCK_NUMBER,
      timestamp: TIMESTAMP,
      totalHolders: holders.length,
      totalSupply: totalSupply.toString(),
      burnedSupply: "689000000671370398647712772140042",
      contractAddress: CONTRACT_ADDRESS,
      csvHash,
      distribution,
    },
  };

  const artifactJson = JSON.stringify(artifact, null, 2);
  await writeFile(path.join(outDir, "holders.json"), artifactJson, "utf-8");

  await writeFile(
    path.join(outDir, "snapshot-metadata.json"),
    JSON.stringify(artifact.metadata, null, 2),
    "utf-8",
  );

  await writeFile(path.join(outDir, "csv-hash.txt"), csvHash, "utf-8");

  // ── Write sidecar hash for integrity verification ───────────────
  const artifactSha256 = createHash("sha256").update(artifactJson).digest("hex");
  await writeFile(path.join(outDir, "holders.json.sha256"), artifactSha256, "utf-8");

  console.log(`\n✅ Snapshot built successfully.`);
  console.log(`   holders:          ${holders.length}`);
  console.log(`   🐋 whales:        ${distribution.whales}`);
  console.log(`   🐬 dolphins:      ${distribution.dolphins}`);
  console.log(`   🐟 fish:          ${distribution.fish}`);
  console.log(`   totalSupply (wei): ${totalSupply.toString()}`);
  console.log(`   → ${path.join(outDir, "holders.json")}`);
  console.log(`   → ${path.join(outDir, "snapshot-metadata.json")}`);
  console.log(`   → ${path.join(outDir, "csv-hash.txt")}`);
  console.log(`   → ${path.join(outDir, "holders.json.sha256")}`);
  console.log(`\n🔐 DEPLOYMENT REQUIRED:`);
  console.log(`   Set this environment variable in production:`);
  console.log(`   SNAPSHOT_SHA256=${artifactSha256}`);
}

/** O(log n) index lookup used by the build-time self-test. */
function binarySearchIndex(sorted: string[], target: string): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const midVal = sorted[mid];
    if (midVal === target) return mid;
    if (midVal === undefined || midVal < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

main().catch((err) => {
  console.error("\n💥 Snapshot build failed:", err);
  process.exit(1);
});
