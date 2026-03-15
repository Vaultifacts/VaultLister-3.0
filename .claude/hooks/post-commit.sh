#!/bin/bash
# post-commit.sh — Run after every git commit
# Appends entry to audit-log.md

HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
MSG=$(git log -1 --format="%s" 2>/dev/null || echo "no message")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append to audit log
echo "| $DATE | commit | $HASH | $MSG |" >> audit-log.md

exit 0
