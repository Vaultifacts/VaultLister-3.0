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

# --- Sprint Board reminder (always shown) ---
echo "  REMINDER: Run Sprint Board reconciliation before ending session."
echo "  Notion Sprint Board: https://www.notion.so/VaultLister-3-0-2799f0c81de682f49f9e81d8cb0f8aaf"
echo ""
