#!/bin/bash
# VaultLister 3.0 — Claude Code Status Line
# Shows: git branch, server status, pending task count

BRANCH=$(git branch --show-current 2>/dev/null || echo "no-git")
SERVER=$(lsof -ti:3000 >/dev/null 2>&1 && echo "🟢 :3000" || echo "🔴 off")

PENDING=0
if [ -f "memory/STATUS.md" ]; then
  PENDING=$(grep -c "^\- \[ \]" memory/STATUS.md 2>/dev/null || echo "0")
fi

echo "[$BRANCH] $SERVER | pending:$PENDING"
