#!/bin/bash
# notify-openclaw.sh — Send event notification to OpenClaw
# Usage: bash .claude/hooks/notify-openclaw.sh <event_type> <message>

EVENT_TYPE="${1:-milestone}"
MESSAGE="${2:-No message provided}"
WEBHOOK="${OPENCLAW_WEBHOOK_OUTBOUND:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -z "$WEBHOOK" ]; then
  # OpenClaw not configured — no-op silently
  exit 0
fi

PAYLOAD=$(printf '{"event":"%s","message":"%s","session_id":"%s","project":"vaultlister-3","timestamp":"%s"}' \
  "$EVENT_TYPE" "$MESSAGE" "$SESSION_ID" "$TIMESTAMP")

curl -s -X POST "$WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --max-time 5 \
  --fail \
  2>/dev/null || true

exit 0
