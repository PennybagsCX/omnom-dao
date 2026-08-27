#!/bin/bash
#
# Fetch the OMNOM snapshot data from DBOT-DC/omnom-snapshot (pinned commit)
# and generate holders.json for the governance platform.
#
# Run this after `npm install` or before `npm run build`.
# The fetch:snapshot script and SNAPSHOT_SHA256 env change MUST ship together.

set -e

# Pinned commit for reproducibility — do NOT change without governance approval.
PINNED_COMMIT="2c38af77ba37e67328347cc44bcabbd07551ec42"
REPO="https://raw.githubusercontent.com/DBOT-DC/omnom-snapshot/${PINNED_COMMIT}"
SOURCE_FILE="omnom-snapshot-ever-held.csv"
LATEST_FILE="omnom-snapshot-latest.csv"

# Expected SHA-256 of the CSV — hard guard against upstream changes.
EXPECTED_CSV_SHA256="1f64a663549ca717c6b612dc71a5cf673ab58badee58f876474c0fc6e551c128"
# Expected SHA-256 of the latest-balance CSV (weekly-2026-08-08) — hard guard.
EXPECTED_LATEST_SHA256="4df99e05d4def915da299b2cbece345519e2cc8afab9a63564e20cc1b883bc87"

# Heavy holders index → server-only dir (never shipped to the client).
SERVER_DIR="data"
# Small verification files → public dir (fetched by the client UI).
PUBLIC_DIR="public/data"

echo "📡 Fetching OMNOM snapshot data from DBOT-DC/omnom-snapshot @ ${PINNED_COMMIT}..."

# Ensure output directories exist
mkdir -p "$SERVER_DIR" "$PUBLIC_DIR"

# Download the ever-held CSV
curl -sL "${REPO}/${SOURCE_FILE}" -o /tmp/omnom-ever-held.csv

# Verify the CSV hash
CSV_HASH=$(shasum -a 256 /tmp/omnom-ever-held.csv | cut -d' ' -f1)

if [ "$CSV_HASH" != "$EXPECTED_CSV_SHA256" ]; then
  echo "❌ CSV hash mismatch! Expected: $EXPECTED_CSV_SHA256, Got: $CSV_HASH"
  echo "The upstream file has changed. Update EXPECTED_CSV_SHA256 in scripts/fetch-snapshot.sh."
  exit 1
fi
echo "✅ CSV SHA-256 verified: $CSV_HASH"

# Download the latest-balance CSV (current weekly snapshot)
curl -sL "${REPO}/${LATEST_FILE}" -o /tmp/omnom-latest.csv

# Verify the latest CSV hash
LATEST_HASH=$(shasum -a 256 /tmp/omnom-latest.csv | cut -d' ' -f1)

if [ "$LATEST_HASH" != "$EXPECTED_LATEST_SHA256" ]; then
  echo "❌ Latest CSV hash mismatch! Expected: $EXPECTED_LATEST_SHA256, Got: $LATEST_HASH"
  exit 1
fi
echo "✅ Latest CSV SHA-256 verified: $LATEST_HASH"

# Generate holders.json from the CSV
python3 << 'PYEOF'
import json, csv, hashlib, sys

# Expected 7-tier distribution — HARD GUARD
EXPECTED_DIST = {
    "krakens": 1,
    "whales": 3,
    "dolphins": 30,
    "sharks": 326,
    "octopuses": 1078,
    "crabs": 1701,
    "seahorses": 22547,
}
EXPECTED_TOTAL = 25686

with open('/tmp/omnom-ever-held.csv') as f:
    reader = csv.DictReader(f)
    holders = {}
    sorted_addresses = []

    # 7-tier classification cascade (descending order, >= thresholds)
    krakens = whales = dolphins = sharks = octopuses = crabs = seahorses = 0

    for row in reader:
        addr = row['address'].lower()
        balance_raw = int(row['max_balance_raw'])
        pct = float(row['max_percentage'])
        rank = int(row['rank'])

        # 7-tier classification
        if pct >= 10.0:
            holder_class = "KRAKEN"
            krakens += 1
        elif pct >= 1.0:
            holder_class = "WHALE"
            whales += 1
        elif pct >= 0.1:
            holder_class = "DOLPHIN"
            dolphins += 1
        elif pct >= 0.01:
            holder_class = "SHARK"
            sharks += 1
        elif pct >= 0.001:
            holder_class = "OCTOPUS"
            octopuses += 1
        elif pct >= 0.0001:
            holder_class = "CRAB"
            crabs += 1
        else:
            holder_class = "SEAHORSE"
            seahorses += 1

        holders[addr] = {
            "address": addr,
            "balanceRaw": str(balance_raw),
            "balanceFormatted": row['max_balance_formatted'],
            "percentageOfSupply": pct,
            "rank": rank,
            "holderClass": holder_class,
            "bestRank": int(row['best_rank']),
            "snapshotCount": int(row['snapshot_count']),
            "snapshots": [s.strip() for s in row['snapshots'].split(',') if s.strip()],
            "firstSeen": row['first_seen'],
        }
        sorted_addresses.append(addr)

    # HARD GUARD: verify distribution
    total = krakens + whales + dolphins + sharks + octopuses + crabs + seahorses
    distribution = {
        "krakens": krakens,
        "whales": whales,
        "dolphins": dolphins,
        "sharks": sharks,
        "octopuses": octopuses,
        "crabs": crabs,
        "seahorses": seahorses,
    }

    if total != EXPECTED_TOTAL:
        print(f"❌ Total holders mismatch! Expected: {EXPECTED_TOTAL}, Got: {total}", file=sys.stderr)
        print(f"Distribution: {distribution}", file=sys.stderr)
        sys.exit(1)

    for tier, expected in EXPECTED_DIST.items():
        if distribution[tier] != expected:
            print(f"❌ {tier} count mismatch! Expected: {expected}, Got: {distribution[tier]}", file=sys.stderr)
            print(f"Distribution: {distribution}", file=sys.stderr)
            sys.exit(1)

    # ── Latest-snapshot enrichment ─────────────────────────────────────
    # Join omnom-snapshot-latest.csv by address to attach each wallet's
    # current balance/rank. Wallets absent from the latest CSV no longer
    # hold: currentlyHolds=False with an explicit zero latest balance.
    LATEST_SNAPSHOT_ID = "weekly-2026-08-08"
    EXPECTED_LATEST_HOLDERS = 25542

    latest = {}
    with open('/tmp/omnom-latest.csv') as f:
        for row in csv.DictReader(f):
            latest[row['address'].lower()] = row

    if len(latest) != EXPECTED_LATEST_HOLDERS:
        print(f"❌ Latest snapshot holder count mismatch! Expected: {EXPECTED_LATEST_HOLDERS}, Got: {len(latest)}", file=sys.stderr)
        sys.exit(1)

    orphans = [a for a in latest if a not in holders]
    if orphans:
        print(f"❌ {len(orphans)} latest-snapshot addresses missing from the ever-held master list, e.g. {orphans[:3]}", file=sys.stderr)
        sys.exit(1)

    holds_count = 0
    for addr, h in holders.items():
        lt = latest.get(addr)
        if lt is not None:
            if int(lt['balance_raw']) > int(h['balanceRaw']):
                print(f"❌ {addr}: latest balance exceeds max balance — corpus inconsistent", file=sys.stderr)
                sys.exit(1)
            h["latestBalanceRaw"] = lt["balance_raw"]
            h["latestBalanceFormatted"] = lt["balance_formatted"]
            h["latestPercentageOfSupply"] = float(lt["percentage_of_supply"])
            h["latestRank"] = int(lt["rank"])
            h["currentlyHolds"] = True
            holds_count += 1
        else:
            h["latestBalanceRaw"] = "0"
            h["latestBalanceFormatted"] = "0"
            h["latestPercentageOfSupply"] = 0.0
            h["latestRank"] = None
            h["currentlyHolds"] = False
        # Cross-check: latest-CSV membership must agree with the snapshots tag.
        if (LATEST_SNAPSHOT_ID in h["snapshots"]) != h["currentlyHolds"]:
            print(f"❌ {addr}: latest-CSV membership disagrees with snapshots tag '{LATEST_SNAPSHOT_ID}'", file=sys.stderr)
            sys.exit(1)

    if holds_count != EXPECTED_LATEST_HOLDERS:
        print(f"❌ currentlyHolds count mismatch! Expected: {EXPECTED_LATEST_HOLDERS}, Got: {holds_count}", file=sys.stderr)
        sys.exit(1)

    # Full metadata per ground truth
    metadata = {
        "blockNumber": 59922100,
        "timestamp": "2026-06-07T23:59:58.000Z",
        "snapshotType": "ever-held",
        "totalHolders": total,
        "totalSupply": "1000000000000000000000000000000000",
        "burnedSupply": "689000001688160097721124495552325",
        "contractAddress": "0xe3fcA919883950c5cD468156392a6477Ff5d18de",
        "distribution": distribution,
        "source": "DBOT-DC/omnom-snapshot (ever-held master list)",
        "sourceRepository": "DBOT-DC/omnom-snapshot",
        "sourceCommit": "2c38af77ba37e67328347cc44bcabbd07551ec42",
        "sourceFile": "omnom-snapshot-ever-held.csv",
        "sourceFileSha256": hashlib.sha256(open('/tmp/omnom-ever-held.csv', 'rb').read()).hexdigest(),
        "csvHash": hashlib.sha256(open('/tmp/omnom-ever-held.csv', 'rb').read()).hexdigest(),
        "electionEligibility": "ever-held-master-list",
        "latestSnapshotDate": "2026-08-08",
        "latestSnapshotHolders": 25542,
        "latestSnapshotId": "weekly-2026-08-08",
        "latestSourceFile": "omnom-snapshot-latest.csv",
        "latestSourceFileSha256": hashlib.sha256(open('/tmp/omnom-latest.csv', 'rb').read()).hexdigest(),
        "enriched": True,
    }

    output = {
        "sortedAddresses": sorted_addresses,
        "holders": holders,
        "metadata": metadata,
    }

    with open('data/holders.json', 'w') as f:
        json.dump(output, f)

    holders_json_hash = hashlib.sha256(json.dumps(output).encode()).hexdigest()
    print(f"✅ Generated holders.json: {total} holders", file=sys.stderr)
    print(f"   Distribution: {krakens}K / {whales}W / {dolphins}D / {sharks}S / {octopuses}O / {crabs}C / {seahorses}H", file=sys.stderr)
    print(f"   Currently holding: {holds_count} / {total}", file=sys.stderr)
    print(f"🔐 holders.json SHA-256: {holders_json_hash}", file=sys.stderr)
PYEOF

# Write hash files
echo "$CSV_HASH" > "$PUBLIC_DIR/csv-hash.txt"

# Write snapshot metadata for client verification
python3 -c "
import json
with open('$SERVER_DIR/holders.json') as f:
    data = json.load(f)
meta = data['metadata']
meta['csvHash'] = open('$PUBLIC_DIR/csv-hash.txt').read().strip()
with open('$PUBLIC_DIR/snapshot-metadata.json', 'w') as f:
    json.dump(meta, f, indent=2)
print('✅ Updated snapshot-metadata.json')
"

echo ""
echo "🎉 Snapshot data ready!"
echo ""
echo "⚠️  IMPORTANT: Add the following to your .env.local:"
echo "   SNAPSHOT_SHA256=<hash above>"
echo ""
echo "The fetch:snapshot script and SNAPSHOT_SHA256 env change MUST ship in the same release."
