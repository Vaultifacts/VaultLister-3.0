#!/usr/bin/env bash
# reconcile-notion.sh — Session-end consistency reconciliation
# Compares actual infrastructure counts against .claude/consistency-manifest.json
# and reminds about Notion documentation updates.
#
# Usage: bash scripts/reconcile-notion.sh
# Run at session end before committing or pushing.

set -euo pipefail

MANIFEST=".claude/consistency-manifest.json"

if [ ! -f "$MANIFEST" ]; then
    echo "ERROR: $MANIFEST not found. Cannot reconcile."
    exit 1
fi

# --- Read manifest values ---
MANIFEST_DENY=$(grep '"deny_patterns"' "$MANIFEST" | grep -o '[0-9]*' | head -1)
MANIFEST_BASH=$(grep '"validate_bash_patterns"' "$MANIFEST" | grep -o '[0-9]*' | head -1)
MANIFEST_FILES=$(grep '"protected_files"' "$MANIFEST" | grep -o '[0-9]*' | head -1)
MANIFEST_AGENTS=$(grep '"agent_files"' "$MANIFEST" | grep -o '[0-9]*' | head -1)
MANIFEST_MEMORY=$(grep '"memory_rules"' "$MANIFEST" | grep -o '[0-9]*' | head -1)

# --- Count actual values ---
ACTUAL_DENY=$(grep -c '"Bash(' .claude/settings.json 2>/dev/null || echo 0)
ACTUAL_BASH=$(grep -c '^  "' .claude/hooks/validate-bash.sh 2>/dev/null || echo 0)
ACTUAL_FILES=$(grep -c '^  "' .claude/hooks/protect-files.sh 2>/dev/null || echo 0)

ACTUAL_AGENTS=0
for f in .claude/agents/*.md; do
    [ -f "$f" ] && ACTUAL_AGENTS=$((ACTUAL_AGENTS + 1))
done

MEMORY_DIR="$HOME/.claude/projects/C--Users-Matt1-OneDrive-Desktop-Claude-Code-Project-Brainstormer-vaultlister-3/memory"
ACTUAL_MEMORY=0
if [ -d "$MEMORY_DIR" ]; then
    for f in "$MEMORY_DIR"/*.md; do
        fname=$(basename "$f")
        [ "$fname" = "MEMORY.md" ] && continue
        [ -f "$f" ] && ACTUAL_MEMORY=$((ACTUAL_MEMORY + 1))
    done
fi

# --- Print comparison table ---
echo ""
echo "============================================================"
echo "  VaultLister 3.0 — Consistency Manifest Reconciliation"
echo "============================================================"
printf "  %-28s  %8s  %8s  %s\n" "Item" "Manifest" "Actual" "Status"
echo "  ------------------------------------------------------------"

check_row() {
    local label="$1"
    local manifest_val="$2"
    local actual_val="$3"
    if [ "$actual_val" = "$manifest_val" ]; then
        printf "  %-28s  %8s  %8s  OK\n" "$label" "$manifest_val" "$actual_val"
    else
        printf "  %-28s  %8s  %8s  MISMATCH ***\n" "$label" "$manifest_val" "$actual_val"
    fi
}

check_row "deny_patterns"          "${MANIFEST_DENY:-?}"   "$ACTUAL_DENY"
check_row "validate_bash_patterns" "${MANIFEST_BASH:-?}"   "$ACTUAL_BASH"
check_row "protected_files"        "${MANIFEST_FILES:-?}"  "$ACTUAL_FILES"
check_row "agent_files"            "${MANIFEST_AGENTS:-?}" "$ACTUAL_AGENTS"
check_row "memory_rules"           "${MANIFEST_MEMORY:-?}" "$ACTUAL_MEMORY"

echo "  ============================================================"

# --- Determine if any mismatches ---
MISMATCH=0
[ "${MANIFEST_DENY:-0}" != "$ACTUAL_DENY" ]   && MISMATCH=1
[ "${MANIFEST_BASH:-0}" != "$ACTUAL_BASH" ]   && MISMATCH=1
[ "${MANIFEST_FILES:-0}" != "$ACTUAL_FILES" ] && MISMATCH=1
[ "${MANIFEST_AGENTS:-0}" != "$ACTUAL_AGENTS" ] && MISMATCH=1
[ "${MANIFEST_MEMORY:-0}" != "$ACTUAL_MEMORY" ] && MISMATCH=1

if [ "$MISMATCH" -eq 1 ]; then
    echo ""
    echo "  ACTION REQUIRED — counts diverged from manifest:"
    echo ""
    echo "  1. Edit .claude/consistency-manifest.json — update mismatched counts"
    echo "  2. Update the Notion Rules Architecture page to reflect the changes"
    echo "     (record the new counts and what changed)"
    echo "  3. Stage and commit: git add .claude/consistency-manifest.json"
    echo ""
else
    echo ""
    echo "  All counts match the manifest."
    echo ""
fi

# --- Notion-Done trailer audit ---
echo ""
echo "  ============================================================"
echo "  Notion-Done Trailer Audit (unpushed commits)"
echo "  ============================================================"

REMOTE_HEAD=$(git rev-parse "@{u}" 2>/dev/null || echo "")
if [ -n "$REMOTE_HEAD" ]; then
    MISSING=0
    for hash in $(git log "$REMOTE_HEAD..HEAD" --pretty=%H -- 2>/dev/null); do
        MSG=$(git log -1 --pretty=%s "$hash")
        BODY=$(git log -1 --pretty=%B "$hash")
        if echo "$MSG" | grep -qE "^(\[AUTO\] )?(fix|feat):"; then
            if ! echo "$BODY" | grep -qE "^Notion-Done:"; then
                SHORT=$(git log -1 --pretty=%h "$hash")
                printf "    MISSING: %s %s\n" "$SHORT" "$MSG"
                MISSING=$((MISSING + 1))
            fi
        fi
    done
    if [ "$MISSING" -eq 0 ]; then
        echo "    All fix/feat commits have Notion-Done trailers. OK"
    else
        echo ""
        echo "    $MISSING commit(s) may need Notion Sprint Board updates."
        echo "    Either amend with Notion-Done: trailers, or update Notion manually."
    fi
else
    echo "    (no remote tracking branch — skipping)"
fi

# --- Fix/feat commits in last 24h without trailers (already pushed) ---
echo ""
echo "  Recent pushed commits without Notion-Done (last 24h):"
RECENT_MISSING=0
for hash in $(git log --since="24 hours ago" --pretty=%H -- 2>/dev/null); do
    MSG=$(git log -1 --pretty=%s "$hash")
    BODY=$(git log -1 --pretty=%B "$hash")
    if echo "$MSG" | grep -qE "^(\[AUTO\] )?(fix|feat):"; then
        if ! echo "$BODY" | grep -qE "^Notion-Done:"; then
            SHORT=$(git log -1 --pretty=%h "$hash")
            printf "    %s %s\n" "$SHORT" "$MSG"
            RECENT_MISSING=$((RECENT_MISSING + 1))
        fi
    fi
done
if [ "$RECENT_MISSING" -eq 0 ]; then
    echo "    None — all recent fix/feat commits have trailers. OK"
else
    echo ""
    echo "    $RECENT_MISSING pushed commit(s) need manual Notion updates."
fi

echo ""
echo "  ============================================================"
echo ""

# --- Sprint Board reminder (always shown) ---
echo "  --- Notion API Access Verification ---"
NOTION_TK=""
if [ -f .env ]; then
    NOTION_TK=$(grep "^NOTION_INTEGRATION_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
fi
if [ -n "${NOTION_TK:-}" ] && command -v python >/dev/null 2>&1; then
    VERIFY_RESULT=$(PYTHONIOENCODING=utf-8 NOTION_TOKEN="$NOTION_TK" python scripts/notion-sprint-lookup.py verify 2>&1 || true)
    echo "  $VERIFY_RESULT"
else
    echo "  SKIP: NOTION_INTEGRATION_TOKEN not set or python not available"
fi
echo ""

# --- Sprint Board item count (prevents reporting filtered lists) ---
# --- Refresh Sprint Board cache before counting ---
NOTION_TK_REFRESH=""
if [ -f .env ]; then
    NOTION_TK_REFRESH=$(grep "^NOTION_INTEGRATION_TOKEN=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
fi
if [ -n "${NOTION_TK_REFRESH:-}" ] && command -v python >/dev/null 2>&1 && [ -f scripts/notion-sprint-lookup.py ]; then
    echo "  Refreshing Sprint Board cache..."
    PYTHONIOENCODING=utf-8 NOTION_TOKEN="$NOTION_TK_REFRESH" python scripts/notion-sprint-lookup.py sync >/dev/null 2>&1 || echo "  (cache refresh failed — using stale data)"
fi

echo "  --- Sprint Board Status Count ---"
if [ -f .notion-sprint-cache.json ]; then
    SPRINT_TOTAL=$(python -c "import json; d=json.load(open('.notion-sprint-cache.json')); print(len(d.get('items',[])))" 2>/dev/null || echo "?")
    echo "  Non-Done items in Sprint Board: $SPRINT_TOTAL"
    echo "  When reporting remaining items to the user, this number MUST match."
    echo "  If you report fewer items, you are filtering. Show ALL $SPRINT_TOTAL."
else
    echo "  SKIP: .notion-sprint-cache.json not found. Run: python scripts/notion-sprint-lookup.py sync"
fi
echo ""

# --- Drift detection: commits that may have fixed Sprint Board items without marking Done ---
echo "  --- Sprint Board Drift Detection ---"
if command -v python >/dev/null 2>&1 && [ -f scripts/notion-sprint-lookup.py ] && [ -f .notion-sprint-cache.json ]; then
    DRIFT_OUTPUT=$(PYTHONIOENCODING=utf-8 python scripts/notion-sprint-lookup.py drift 2>&1 || true)
    if echo "$DRIFT_OUTPUT" | grep -q "DRIFT DETECTED"; then
        echo "$DRIFT_OUTPUT" | sed 's/^/  /'
        echo ""
        echo "  ACTION REQUIRED: Mark these items Done in Notion or verify they are still open."
    else
        echo "  OK — no drift detected between commits and Sprint Board."
    fi
else
    echo "  SKIP: cache or python not available"
fi
echo ""

echo "  REMINDER: Verify Sprint Board statuses match reality."
echo "  Notion Sprint Board: https://www.notion.so/VaultLister-3-0-2799f0c81de682f49f9e81d8cb0f8aaf"
echo ""
