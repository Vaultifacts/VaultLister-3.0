#!/bin/bash
# session-init.sh — Run at session start (PostSessionStart) and session end (Stop)

MODE="${1:-start}"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$MODE" = "start" ]; then
  echo "VaultLister 3.0 session started"
  echo "   Read memory/STATUS.md for pending tasks."

elif [ "$MODE" = "stop" ]; then
  # Auto-stash uncommitted changes
  if git diff --quiet HEAD 2>/dev/null; then
    echo "No uncommitted changes to stash."
  else
    git stash push -m "auto-stash:$DATE" 2>/dev/null
    echo "Auto-stashed uncommitted changes."
  fi
fi

exit 0
