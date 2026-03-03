#!/bin/bash
# protect-files.sh — Block writes to safety-critical files
# Invoked by: PreToolUse (Write, Edit) hook

PROTECTED_FILES=(
  "src/frontend/app.js"
  "src/backend/middleware/securityHeaders.js"
  ".env"
  ".husky/pre-commit"
  ".husky/pre-push"
  ".husky/commit-msg"
)

FILE_ARG="${1:-}"

for protected in "${PROTECTED_FILES[@]}"; do
  if [[ "$FILE_ARG" == *"$protected"* ]]; then
    echo "⛔ BLOCKED: $protected is a safety-critical file."
    echo "Run the required tests first. If intentional, proceed manually."
    exit 1
  fi
done

exit 0
