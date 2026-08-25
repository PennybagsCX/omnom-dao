#!/bin/bash
#
# Fetch the latest OMNOM snapshot data from DBOT-DC/omnom-token
# and generate holders.json for the governance platform.
#
# Run this after `npm install` or before `npm run build`.

set -e

REPO="https://raw.githubusercontent.com/DBOT-DC/omnom-token/main"
OUT_DIR="public/data"

echo "📡 Fetching OMNOM snapshot data..."

# Ensure output directory exists
mkdir -p "$OUT_DIR"

# Download the ever-held CSV
curl -sL "$REPO/omnom-snapshot-ever-held.csv" -o /tmp/omnom-ever-held.csv

# Download the HASHES.json for verification
curl -sL "$REPO/HASHES.json" -o /tmp/omnom-hashes.json

# Verify the CSV hash
CSV_HASH=$(shasum -a 256 /tmp/omnom-ever-held.csv | cut -d' ' -f1)
EXPECTED_HASH=$(python3 -c "import json; print(json.load(open('/tmp/omnom-hashes.json'))['omnom-snapshot-ever-held.csv'])")

if [ "$CSV_HASH" != "$EXPECTED_HASH" ]; then
  echo "❌ Hash mismatch! Expected: $EXPECTED_HASH, Got: $CSV_HASH"
  exit 1
fi
echo "✅ SHA-256 verified: $CSV_HASH"

# Generate holders.json from the CSV
python3 << 'PYEOF'
import json, csv, hashlib

with open('/tmp/omnom-ever-held.csv') as f:
    reader = csv.DictReader(f)
    holders = {}
    sorted_addresses = []
    whales = dolphins = fish = 0

    for row in reader:
        addr = row['address'].lower()
        balance_raw = int(row['max_balance_raw'])
        pct = float(row['max_percentage'])
        rank = int(row['rank'])

        if pct >= 1.0:
            holder_class = "WHALE"
            whales += 1
        elif pct >= 0.01:
            holder_class = "DOLPHIN"
            dolphins += 1
        else:
            holder_class = "FISH"
            fish += 1

        holders[addr] = {
            "address": addr,
            "balanceRaw": str(balance_raw),
            "balanceFormatted": row['max_balance_formatted'],
            "percentageOfSupply": pct,
            "rank": rank,
            "holderClass": holder_class,
        }
        sorted_addresses.append(addr)

    total = whales + dolphins + fish
    output = {
        "sortedAddresses": sorted_addresses,
        "holders": holders,
        "metadata": {
            "blockNumber": 59922100,
            "timestamp": "2026-06-07T23:59:58.000Z",
            "snapshotType": "ever-held",
            "totalHolders": total,
            "totalSupply": "1000000000000000000000000000000000",
            "contractAddress": "0xe3fcA919883950c5cD468156392a6477Ff5d18de",
            "distribution": {"whales": whales, "dolphins": dolphins, "fish": fish},
            "source": "DBOT-DC/omnom-token (ever-held master list)",
        },
    }

    with open('public/data/holders.json', 'w') as f:
        json.dump(output, f)

    print(f"✅ Generated holders.json: {total} holders ({whales}W / {dolphins}D / {fish}F)")
PYEOF

# Write hash file
echo "$CSV_HASH" > "$OUT_DIR/csv-hash.txt"

# Write snapshot metadata
python3 -c "
import json
with open('$OUT_DIR/holders.json') as f:
    data = json.load(f)
meta = data['metadata']
meta['csvHash'] = open('$OUT_DIR/csv-hash.txt').read().strip()
with open('$OUT_DIR/snapshot-metadata.json', 'w') as f:
    json.dump(meta, f, indent=2)
print('✅ Updated snapshot-metadata.json')
"

echo "🎉 Snapshot data ready!"
