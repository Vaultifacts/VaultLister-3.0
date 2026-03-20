#!/bin/bash
# validate-bash.sh -- Pre-command safety gate
# Rejects dangerous shell patterns before execution

COMMAND="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$COMMAND" ]; then
    exit 0
fi

BLOCKED_PATTERNS=(
  "git add -A"
  "git add \."
  "git push --force"
  "git push -f"
  "git reset --hard"
  "rm -rf /"
  "rm -rf data/"
  "rm -rf src/"
  "rm -rf e2e/"
  "rm -rf .github/"
  "DROP TABLE"
  "DROP DATABASE"
  "curl.*|.*bash"
  "wget.*|.*sh"
  "\-\-no-verify"
  "bun run db:drop"
  "bun run db:reset"
  "docker compose down -v"
  "npm publish"
  "bun publish"
  "git branch -D"
  "git tag -d "
  "git rebase -i"
  "git checkout \."
  "git clean -f"
  "git restore \."
  "git restore --staged"
  "rm -rf .husky"
  "rm -rf .claude"
  "rm -rf .git"
  "HUSKY=0"
  "git config core.hookspath"
  "git config core.hooksPath"
  "git push.*--delete"
  "git push --force-with-lease"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED by validate-bash.sh: dangerous pattern -- $pattern"
    exit 1
  fi
done

exit 0
