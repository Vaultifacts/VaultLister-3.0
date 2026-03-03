#!/bin/bash
# on-message.sh — Process inbound OpenClaw message
# Input: $OPENCLAW_MESSAGE (JSON string from OpenClaw webhook)

MESSAGE="${OPENCLAW_MESSAGE:-}"

if [ -z "$MESSAGE" ]; then
  echo "No message received."
  exit 0
fi

CMD=$(echo "$MESSAGE" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('text','').strip().lower())" 2>/dev/null || echo "")

case "$CMD" in
  "status"|"/status")
    bash -c "claude -p '/status' --allowedTools 'Bash,Read'"
    ;;
  "build"|"/build")
    bash -c "claude -p '/build' --allowedTools 'Bash,Read'"
    ;;
  "test"|"/test")
    bash -c "claude -p '/test' --allowedTools 'Bash,Read'"
    ;;
  *)
    bash .claude/hooks/notify-openclaw.sh "needs_input" "Unknown command: $CMD"
    ;;
esac

exit 0
