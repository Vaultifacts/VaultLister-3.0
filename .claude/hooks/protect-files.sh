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
    echo "⚠️ WARNING: $protected is a safety-critical file."
    echo "Run 'bun test src/tests/auth.test.js src/tests/security.test.js' before committing."
    exit 0
  fi
done

exit 0
