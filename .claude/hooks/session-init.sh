#!/bin/bash
# session-init.sh — Run at session start (PostSessionStart) and session end (Stop)
# Reads current_task from OpenClaw memory; sends session events to OpenClaw

MODE="${1:-start}"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$MODE" = "start" ]; then
  # Read current task from OpenClaw memory
  CURRENT_TASK="none"
  if [ -f ".openclaw/memory/context.json" ]; then
    CURRENT_TASK=$(python -c "import json; d=json.load(open('.openclaw/memory/context.json')); print(d.get('current_task', 'none'))" 2>/dev/null || echo "none")
  fi

  echo "📋 VaultLister 3.0 session started"
  echo "   current_task: $CURRENT_TASK"
  echo "   Read memory/STATUS.md for pending tasks."

  bash .claude/hooks/notify-openclaw.sh "session_start" "Session started. current_task=$CURRENT_TASK" 2>/dev/null || true

elif [ "$MODE" = "stop" ]; then
  # Auto-stash uncommitted changes
  if git diff --quiet HEAD 2>/dev/null; then
    echo "✅ No uncommitted changes to stash."
  else
    git stash push -m "auto-stash:$DATE" 2>/dev/null
    echo "📦 Auto-stashed uncommitted changes."
  fi

  bash .claude/hooks/notify-openclaw.sh "session_end" "Session ended." 2>/dev/null || true
fi

exit 0
