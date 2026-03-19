#!/bin/bash
# VaultLister backup script — wraps backup.js for use in deploy pipelines
# Called by deploy-staging.yml before each deploy
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Use bun if available, fall back to node
if command -v bun &> /dev/null; then
    bun "$SCRIPT_DIR/backup.js" "$@"
elif command -v node &> /dev/null; then
    node "$SCRIPT_DIR/backup.js" "$@"
else
    echo "ERROR: Neither bun nor node found in PATH"
    exit 1
fi
