#!/bin/bash
# VaultLister staging pre-deploy database backup.
# Called by .github/workflows/deploy-staging.yml before each deploy.
#
# Runs on the staging host (bash only — no bun required). Uses docker exec
# to run pg_dump inside the running postgres container, producing a custom-
# format archive that can be restored with scripts/pg-restore.js.
#
# Exit codes:
#   0  — backup written, OR postgres container not running (first deploy)
#   1  — pg_dump failed against a running container (real error)
#
# Env overrides:
#   BACKUP_DIR           default /opt/vaultlister-staging/backups
#   POSTGRES_CONTAINER   default vaultlister-staging-postgres
#   POSTGRES_USER        default vaultlister
#   POSTGRES_DB          default vaultlister
#   BACKUP_RETAIN_COUNT  default 7

set -o pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/vaultlister-staging/backups}"
CONTAINER="${POSTGRES_CONTAINER:-vaultlister-staging-postgres}"
DB_USER="${POSTGRES_USER:-vaultlister}"
DB_NAME="${POSTGRES_DB:-vaultlister}"
RETAIN="${BACKUP_RETAIN_COUNT:-7}"

echo "=== VaultLister Pre-deploy Backup ==="

# Skip cleanly on first deploy (no running postgres yet).
if ! docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q '^true$'; then
    echo "Postgres container '$CONTAINER' not running — skipping backup (first deploy?)"
    exit 0
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")
BACKUP_FILE="$BACKUP_DIR/vaultlister-$TIMESTAMP.dump"

echo "Container:   $CONTAINER"
echo "Database:    $DB_NAME"
echo "User:        $DB_USER"
echo "Destination: $BACKUP_FILE"

if ! docker exec "$CONTAINER" pg_dump \
        --format=custom \
        --no-password \
        --username="$DB_USER" \
        "$DB_NAME" > "$BACKUP_FILE"; then
    echo "ERROR: pg_dump failed" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
echo "Backup created: $BACKUP_FILE ($SIZE)"

# Retain only the N most recent dumps.
echo "Pruning old backups (keeping $RETAIN most recent)..."
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/vaultlister-*.dump 2>/dev/null \
    | tail -n +$((RETAIN + 1)) \
    | while read -r stale; do
        rm -f "$stale"
        echo "  Removed: $stale"
    done

echo "=== Backup complete ==="
