#!/usr/bin/env bash
# smoke-test-staging.sh — Quick health check against vaultlister.com
# Usage: ./scripts/smoke-test-staging.sh [BASE_URL]
# Exit 0 if all tests pass, exit 1 if any fail.

BASE_URL="${1:-${SMOKE_TEST_URL:-http://localhost:3001}}"
PASS=0
FAIL=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC}  $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}FAIL${NC}  $1"; FAIL=$((FAIL + 1)); }

echo "Smoke test: ${BASE_URL}"
echo "----------------------------------------"

# ---- Test 1: Health endpoint returns 200 --------------------------------
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
if [ "$STATUS" = "200" ]; then
    pass "GET /health → 200"
else
    fail "GET /health → expected 200, got ${STATUS}"
fi

# ---- Test 2: Main page returns 200 and contains "VaultLister" -----------
BODY=$(curl -s -w "\n%{http_code}" "${BASE_URL}/")
STATUS=$(echo "$BODY" | tail -n1)
CONTENT=$(echo "$BODY" | head -n -1)
if [ "$STATUS" = "200" ] && echo "$CONTENT" | grep -q "VaultLister"; then
    pass "GET / → 200 + contains 'VaultLister'"
elif [ "$STATUS" != "200" ]; then
    fail "GET / → expected 200, got ${STATUS}"
else
    fail "GET / → 200 but 'VaultLister' not found in body"
fi

# ---- Test 3: /api/health returns JSON with "healthy" --------------------
BODY=$(curl -s "${BASE_URL}/api/health")
if echo "$BODY" | grep -q '"healthy"'; then
    pass "GET /api/health → JSON contains \"healthy\""
else
    fail "GET /api/health → expected JSON with \"healthy\", got: ${BODY:0:200}"
fi

# ---- Test 4: robots.txt returns 200 -------------------------------------
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/robots.txt")
if [ "$STATUS" = "200" ]; then
    pass "GET /robots.txt → 200"
else
    fail "GET /robots.txt → expected 200, got ${STATUS}"
fi

# ---- Test 5: sitemap.xml returns 200 ------------------------------------
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/sitemap.xml")
if [ "$STATUS" = "200" ]; then
    pass "GET /sitemap.xml → 200"
else
    fail "GET /sitemap.xml → expected 200, got ${STATUS}"
fi

# ---- Test 6: Non-existent API route returns 404 -------------------------
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/nonexistent")
if [ "$STATUS" = "404" ]; then
    pass "GET /api/nonexistent → 404"
else
    fail "GET /api/nonexistent → expected 404, got ${STATUS}"
fi

# ---- Test 7: Gzip encoding is served when accepted ----------------------
ENCODING=$(curl -s -o /dev/null -D - -H "Accept-Encoding: gzip, deflate" "${BASE_URL}/" \
    | grep -i "^content-encoding:" | tr -d '\r\n')
if echo "$ENCODING" | grep -qi "gzip"; then
    pass "Gzip encoding → content-encoding: gzip present"
else
    fail "Gzip encoding → expected content-encoding: gzip, got: '${ENCODING}'"
fi

# ---- Test 8: HSTS header present ----------------------------------------
HSTS=$(curl -s -o /dev/null -D - "${BASE_URL}/" \
    | grep -i "^strict-transport-security:" | tr -d '\r\n')
if [ -n "$HSTS" ]; then
    pass "HSTS → Strict-Transport-Security header present"
else
    fail "HSTS → Strict-Transport-Security header missing"
fi

# ---- Summary ------------------------------------------------------------
echo "----------------------------------------"
echo "Results: ${PASS} passed, ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
