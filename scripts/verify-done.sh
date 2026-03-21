#!/usr/bin/env bash
# verify-done.sh — Automated completeness check before declaring work "done"
# Run after making changes, before telling the user it's finished.
# Exit code 0 = all checks pass. Non-zero = gaps found.

set -euo pipefail

FAIL=0
WARN=0

echo ""
echo "============================================================"
echo "  VERIFY-DONE: Automated completeness audit"
echo "============================================================"
echo ""

# --- 1. Silent failure scan: find || true, catch{}, 2>/dev/null in changed files ---
echo "  1. Silent failure scan (changed files)..."
CHANGED=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD 2>/dev/null || echo "")
if [ -n "$CHANGED" ]; then
    SILENT_FAILS=""
    for f in $CHANGED; do
        [ -f "$f" ] || continue
        # Check for || true that swallows real errors (not in comments)
        HITS=$(grep -n '|| true' "$f" 2>/dev/null | grep -v '^\s*#' | grep -v '^\s*//' || true)
        if [ -n "$HITS" ]; then
            SILENT_FAILS="${SILENT_FAILS}\n    $f: || true\n$(echo "$HITS" | head -3 | sed 's/^/      /')\n"
        fi
        # Check for empty catch blocks
        CATCH_HITS=$(grep -n 'catch.*{}' "$f" 2>/dev/null | grep -v '^\s*#' | grep -v '^\s*//' || true)
        if [ -n "$CATCH_HITS" ]; then
            SILENT_FAILS="${SILENT_FAILS}\n    $f: empty catch\n$(echo "$CATCH_HITS" | head -3 | sed 's/^/      /')\n"
        fi
    done
    if [ -n "$SILENT_FAILS" ]; then
        echo "    FOUND silent failure patterns:"
        printf "$SILENT_FAILS"
        echo "    Each one must be justified or replaced with error logging."
        WARN=$((WARN + 1))
    else
        echo "    OK — no silent failure patterns in changed files"
    fi
else
    echo "    SKIP — no changed files detected"
fi

# --- 2. Advisory vs blocking audit: check hooks for warning-only patterns ---
echo ""
echo "  2. Advisory vs blocking audit..."
ADVISORY=0
for hook in .husky/commit-msg .husky/pre-commit .husky/pre-push; do
    [ -f "$hook" ] || continue
    # Look for "warning" without a corresponding exit 1 in the same block
    WARNING_LINES=$(grep -n -i "warning\|warn:" "$hook" 2>/dev/null | grep -v '^\s*#' || true)
    if [ -n "$WARNING_LINES" ]; then
        # Check if there's a blocking exit within 5 lines
        while IFS= read -r line; do
            LINENUM=$(echo "$line" | cut -d: -f1)
            CONTEXT=$(sed -n "$((LINENUM)),$((LINENUM + 5))p" "$hook" 2>/dev/null || true)
            if ! echo "$CONTEXT" | grep -q "exit 1"; then
                echo "    ADVISORY-ONLY: $hook:$LINENUM"
                echo "      $(echo "$line" | cut -d: -f2-)"
                ADVISORY=$((ADVISORY + 1))
            fi
        done <<< "$WARNING_LINES"
    fi
done
if [ "$ADVISORY" -eq 0 ]; then
    echo "    OK — no advisory-only warnings found in hooks"
else
    echo "    $ADVISORY advisory-only warning(s) — should each be blocking or justified"
    WARN=$((WARN + 1))
fi

# --- 3. Test coverage check: were relevant tests run? ---
echo ""
echo "  3. Test coverage check..."
ROUTE_CHANGES=$(echo "$CHANGED" | grep "src/backend/routes/" || true)
HOOK_CHANGES=$(echo "$CHANGED" | grep ".husky/\|.claude/hooks/" || true)
FRONTEND_CHANGES=$(echo "$CHANGED" | grep "src/frontend/" || true)

if [ -n "$ROUTE_CHANGES" ]; then
    echo "    Route files changed — auth+security tests required"
    echo "    Run: bun test src/tests/auth.test.js src/tests/security.test.js"
fi
if [ -n "$HOOK_CHANGES" ]; then
    echo "    Hook files changed — test both success AND failure cases"
    echo "    Success: commit with valid trailer should succeed"
    echo "    Failure: commit WITHOUT trailer should be BLOCKED"
fi
if [ -n "$FRONTEND_CHANGES" ]; then
    echo "    Frontend files changed — browser verification required"
    echo "    Load http://localhost:3000 and check console for errors"
fi
if [ -z "$ROUTE_CHANGES" ] && [ -z "$HOOK_CHANGES" ] && [ -z "$FRONTEND_CHANGES" ]; then
    echo "    OK — no test-sensitive files changed"
fi

# --- 4. Notion error log check ---
echo ""
echo "  4. Notion health check..."
if [ -f .notion-errors.log ] && [ -s .notion-errors.log ]; then
    ERR_COUNT=$(wc -l < .notion-errors.log | tr -d '[:space:]')
    echo "    FAIL: .notion-errors.log has $ERR_COUNT error(s)"
    tail -3 .notion-errors.log | sed 's/^/      /'
    FAIL=$((FAIL + 1))
else
    echo "    OK — no Notion errors"
fi

# --- 5. Unpushed Notion trailer check ---
echo ""
echo "  5. Notion trailer check (unpushed commits)..."
REMOTE_HEAD=$(git rev-parse "@{u}" 2>/dev/null || echo "")
if [ -n "$REMOTE_HEAD" ]; then
    MISSING=0
    for hash in $(git log "$REMOTE_HEAD..HEAD" --pretty=%H -- 2>/dev/null); do
        MSG=$(git log -1 --pretty=%s "$hash")
        BODY=$(git log -1 --pretty=%B "$hash")
        if echo "$MSG" | grep -qE "^(\[AUTO\] )?(feat|fix|chore|refactor|perf|test|build|revert):"; then
            if ! echo "$BODY" | grep -qE "^Notion-Done:|^Notion-Skip:"; then
                SHORT=$(git log -1 --pretty=%h "$hash")
                echo "    MISSING: $SHORT $MSG"
                MISSING=$((MISSING + 1))
            fi
        fi
    done
    if [ "$MISSING" -eq 0 ]; then
        echo "    OK — all fix/feat commits have trailers"
    else
        FAIL=$((FAIL + 1))
    fi
else
    echo "    SKIP — no remote tracking branch"
fi

# --- Summary ---
echo ""
echo "============================================================"
if [ "$FAIL" -gt 0 ]; then
    echo "  RESULT: FAIL — $FAIL blocking issue(s) found"
    echo "  Do NOT declare this work done until all are resolved."
    echo "============================================================"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo "  RESULT: WARN — $WARN issue(s) need justification"
    echo "  Review each warning. If justified, proceed. If not, fix."
    echo "============================================================"
    exit 0
else
    echo "  RESULT: PASS — all checks clear"
    echo "============================================================"
    exit 0
fi
