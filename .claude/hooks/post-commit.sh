#!/bin/bash
# post-commit.sh — Run after every git commit
# Sends commit notification to OpenClaw + appends entry to audit-log.md

HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
MSG=$(git log -1 --format="%s" 2>/dev/null || echo "no message")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Notify OpenClaw
bash .claude/hooks/notify-openclaw.sh "commit" "[$HASH] $MSG" 2>/dev/null || true

# Append to audit log
echo "| $DATE | commit | $HASH | $MSG |" >> audit-log.md

exit 0
