#!/bin/bash
# Fires PostToolUse on Bash — purges Cloudflare cache after git push
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only fire on git push commands
if ! echo "$COMMAND" | grep -qE "git push"; then
  exit 0
fi

ENV_FILE="/c/Users/Matt1/OneDrive/Desktop/vaultlister-3/.env"
CF_TOKEN=$(grep "^CLOUDFLARE_API_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2-)

if [ -z "$CF_TOKEN" ]; then
  echo '{"systemMessage":"⚠ Cloudflare purge skipped: CLOUDFLARE_API_TOKEN not in .env"}'
  exit 0
fi

ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=vaultlister.com" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id // empty')

if [ -z "$ZONE_ID" ]; then
  echo '{"systemMessage":"⚠ Cloudflare purge failed: could not get zone ID"}'
  exit 0
fi

RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}')

SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo '{"systemMessage":"✓ Cloudflare cache purged for vaultlister.com"}'
else
  echo "{\"systemMessage\":\"⚠ Cloudflare purge failed: $(echo "$RESULT" | jq -r '.errors[0].message // "unknown error"')\"}"
fi
