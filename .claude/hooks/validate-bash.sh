#!/bin/bash
# validate-bash.sh — Pre-command safety gate
# Rejects dangerous shell patterns before execution

COMMAND="${CLAUDE_TOOL_INPUT:-}"

BLOCKED_PATTERNS=(
  "git add -A"
  "git add \."
  "git push --force"
  "git reset --hard"
  "rm -rf /"
  "curl.*|.*bash"
  "wget.*|.*sh"
  "\-\-no-verify"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "⛔ BLOCKED by validate-bash.sh: dangerous pattern detected — $pattern"
    exit 1
  fi
done

exit 0
