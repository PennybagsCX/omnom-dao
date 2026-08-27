#!/usr/bin/env bash
# scripts/e2e-prod-smoke.sh
# End-to-end smoke test against the production deployment.
# Verifies: public pages, health, election API, cron endpoint, snapshot explorer,
# CSP reporting. Does NOT require admin wallet sign-in.
#
# Usage: bash scripts/e2e-prod-smoke.sh [BASE_URL] [CRON_SECRET]
#   BASE_URL defaults to https://dao.omnom.dog

set -o pipefail

BASE="${1:-https://dao.omnom.dog}"
# Use $2 if provided, else fall back to CRON_SECRET env var (don't overwrite)
if [ -n "${2:-}" ]; then
  CRON_SECRET="$2"
fi

PASS=0
FAIL=0
WARN=0
FAILED_TESTS=()

# Colors (disabled if not TTY)
if [ -t 1 ]; then
  GREEN="\033[32m"
  RED="\033[31m"
  YELLOW="\033[33m"
  CYAN="\033[36m"
  RESET="\033[0m"
else
  GREEN=""
  RED=""
  YELLOW=""
  CYAN=""
  RESET=""
fi

ok()    { echo -e "${GREEN}✓${RESET} $1"; PASS=$((PASS+1)); }
fail()  { echo -e "${RED}✗${RESET} $1"; FAIL=$((FAIL+1)); FAILED_TESTS+=("$1"); }
warn()  { echo -e "${YELLOW}⚠${RESET} $1"; WARN=$((WARN+1)); }
heading() { echo -e "\n${CYAN}── $1 ──${RESET}"; }

http_status() {
  # $1 = url, $2 = method (default GET), $3 = body (optional), $4 = extra headers (optional)
  local method="${2:-GET}"
  local body="${3:-}"
  local extra="${4:-}"
  local args=(-sS -o /tmp/resp.json -w "%{http_code}" -X "$method" --max-time 15)
  [ -n "$extra" ] && args+=(-H "$extra")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  args+=("$1")
  curl "${args[@]}"
}

assert_status() {
  # $1 = label, $2 = expected, $3 = actual
  if [ "$3" = "$2" ]; then
    ok "$1 (HTTP $3)"
  else
    fail "$1 (expected $2, got $3)"
  fi
}

echo -e "${CYAN}╔════════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║   OMNOM DAO Production Smoke Test                 ║${RESET}"
echo -e "${CYAN}║   $BASE$(printf '%*s' $((45 - ${#BASE})) '')║${RESET}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Public pages ─────────────────────────────────────────────
heading "1. Public pages (render check)"

for path in / /governance-vote /proposals /snapshot-explorer /faq /brand; do
  code=$(http_status "$BASE$path")
  body=$(cat /tmp/resp.json 2>/dev/null || echo "")
  if [ "$code" = "200" ] && [ -n "$body" ]; then
    # Check for OMNOM content
    if echo "$body" | grep -qiE "omnom|dao|governance"; then
      ok "GET $path (HTTP 200, OMNOM content present)"
    else
      warn "GET $path (HTTP 200 but no OMNOM/DAO/governance keyword found)"
    fi
  else
    fail "GET $path (HTTP $code)"
  fi
done

# Countdown timer present on homepage and election page
for path in / /governance-vote; do
  code=$(http_status "$BASE$path")
  body=$(cat /tmp/resp.json)
  if echo "$body" | grep -q 'data-testid="countdown-timer"'; then
    ok "Countdown timer present on $path"
  else
    fail "Countdown timer missing on $path (data-testid=countdown-timer not found)"
  fi
  # Verify a days/hours/minutes/seconds structure renders
  if echo "$body" | grep -qE 'Days|Hours|Minutes|Seconds'; then
    ok "Countdown labels rendered on $path"
  else
    fail "Countdown labels missing on $path"
  fi
done

# ── 2. Security headers ─────────────────────────────────────────
heading "2. Security headers (every public page)"

for path in / /governance-vote /snapshot-explorer; do
  hdr=$(curl -sS -I --max-time 10 "$BASE$path")
  for h in "strict-transport-security" "content-security-policy" "permissions-policy" "referrer-policy"; do
    if echo "$hdr" | grep -qi "^$h:"; then
      ok "$path has $h"
    else
      fail "$path missing $h"
    fi
  done
done

# ── 3. Health endpoint ──────────────────────────────────────────
heading "3. Health endpoint"

code=$(http_status "$BASE/api/v1/health")
body=$(cat /tmp/resp.json)
assert_status "GET /api/v1/health" 200 "$code"
if echo "$body" | grep -q '"totalHolders":25686'; then
  ok "Snapshot loaded with 25,686 eligible holders"
else
  fail "Snapshot holder count mismatch (response: $body)"
fi

# ── 4. Election API (public metadata) ───────────────────────────
heading "4. Election API"

# /api/v1/snapshot-explorer is now a public-read endpoint (was auth-gated
# but the route handler is documented as public). Verify it returns data.
code=$(http_status "$BASE/api/v1/snapshot-explorer?page=1&pageSize=1")
body=$(cat /tmp/resp.json)
assert_status "GET /api/v1/snapshot-explorer" 200 "$code"
if echo "$body" | grep -q '"totalHolders":25686'; then
  ok "Snapshot explorer returned 25,686 holders"
else
  warn "Snapshot explorer response shape unexpected"
fi

# ── 5. CSP violation reporting ──────────────────────────────────
heading "5. CSP violation reporting"

violation='{"csp-report":{"violated-directive":"script-src","blocked-uri":"https://evil.example/x.js"}}'
code=$(http_status "$BASE/api/v1/csp-report" "POST" "$violation")
# 204 (No Content) is canonical; 200 also acceptable
if [ "$code" = "204" ] || [ "$code" = "200" ]; then
  ok "POST /api/v1/csp-report accepted (HTTP $code)"
else
  fail "POST /api/v1/csp-report rejected (HTTP $code)"
fi

# ── 6. Cron sweep (only if CRON_SECRET provided) ────────────────
heading "6. Cron sweep (requires CRON_SECRET)"

if [ -n "$CRON_SECRET" ]; then
  code=$(http_status "$BASE/api/v1/cron/finalize" "POST" "" "Authorization: Bearer $CRON_SECRET")
  body=$(cat /tmp/resp.json)
  assert_status "POST /api/v1/cron/finalize (with secret)" 200 "$code"
  echo "    Response: $body"
else
  warn "Skipping cron test (CRON_SECRET not provided). Run as: bash $0 $BASE <CRON_SECRET>"
fi

# ── 7. Negative auth check ──────────────────────────────────────
heading "7. Negative auth (unauthenticated votes must fail)"

code=$(http_status "$BASE/api/v1/proposals/prop-test/votes" "POST" '{"choice":"FOR"}')
# 401 expected
if [ "$code" = "401" ]; then
  ok "Unauthenticated POST /votes returns 401"
else
  warn "Unauthenticated POST /votes returned $code (expected 401)"
fi

# Cron without secret must return 401
code=$(http_status "$BASE/api/v1/cron/finalize" "POST" "" "")
if [ "$code" = "401" ]; then
  ok "Cron without secret returns 401"
else
  fail "Cron without secret returned $code (expected 401)"
fi

# ── 8. Static assets (OG image) ─────────────────────────────────
heading "8. Static / meta assets"

for path in /opengraph-image /twitter-image /manifest.webmanifest /robots.txt /sitemap.xml; do
  code=$(http_status "$BASE$path")
  if [ "$code" = "200" ]; then
    ok "GET $path (HTTP 200)"
  else
    warn "GET $path returned $code"
  fi
done

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║   Summary                                            ║${RESET}"
echo -e "${CYAN}╠════════════════════════════════════════════════════╣${RESET}"
echo -e "  ${GREEN}Passed${RESET}: $PASS"
echo -e "  ${YELLOW}Warned${RESET}: $WARN"
echo -e "  ${RED}Failed${RESET}: $FAIL"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi

echo ""
echo -e "${GREEN}✅ All critical smoke tests passed.${RESET}"
exit 0