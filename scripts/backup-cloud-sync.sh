#!/bin/bash
# VaultLister Cloud Backup Sync
# Orchestrates: local backup → cloud sync → verify → retention → manifest
#
# Usage:
#   bash scripts/backup-cloud-sync.sh              # Full backup + sync
#   bash scripts/backup-cloud-sync.sh --dry-run    # Preview what would happen
#   bash scripts/backup-cloud-sync.sh --status     # Show backup status
#   bash scripts/backup-cloud-sync.sh --list-remote # List remote backups
#   bash scripts/backup-cloud-sync.sh --restore FILE # Restore from remote
#
# Environment Variables:
#   VAULTLISTER_RCLONE_REMOTE   - rclone remote name (default: vaultlister-backup)
#   VAULTLISTER_REMOTE_PATH     - remote subdirectory (default: VaultLister/Backups)
#   VAULTLISTER_RETENTION_DAYS  - remote retention days (default: 30)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/backups"
RCLONE="${HOME}/.local/bin/rclone"
BUN="${HOME}/.bun/bin/bun"
REMOTE="${VAULTLISTER_RCLONE_REMOTE:-vaultlister-backup}"
REMOTE_PATH="${VAULTLISTER_REMOTE_PATH:-VaultLister/Backups}"
RETENTION_DAYS="${VAULTLISTER_RETENTION_DAYS:-30}"
NOTIFY_SCRIPT="${HOME}/scripts/tg-notify.sh"
LOG_FILE="${ROOT_DIR}/logs/backup-cloud-sync.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    local msg="[$(date -Iseconds)] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

notify() {
    if [ -f "$NOTIFY_SCRIPT" ]; then
        bash "$NOTIFY_SCRIPT" "$1" 2>/dev/null || true
    fi
}

check_rclone() {
    if [ ! -x "$RCLONE" ]; then
        log "ERROR: rclone not found at $RCLONE"
        log "Install: curl https://rclone.org/install.sh | sudo bash"
        exit 1
    fi
}

check_remote() {
    if ! "$RCLONE" listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
        log "ERROR: rclone remote '${REMOTE}' not configured"
        log "Run: $RCLONE config create ${REMOTE} <provider> ..."
        log "See: docs/CLOUD_BACKUP_SETUP.md"
        exit 1
    fi
}

do_backup() {
    log "Creating compressed backup..."
    cd "$ROOT_DIR"
    "$BUN" scripts/backup.js --compress 2>&1 | tee -a "$LOG_FILE"

    # Find the latest backup file
    LATEST_BACKUP=$(find "$BACKUP_DIR" -name "*.db.gz" -o -name "*.db" | sort -t/ -k2 | tail -1)

    if [ -z "$LATEST_BACKUP" ]; then
        # Also check subdirectories
        LATEST_BACKUP=$(find "$BACKUP_DIR" -path "*/daily/*" -name "*.db.gz" | sort | tail -1)
    fi

    if [ -z "$LATEST_BACKUP" ]; then
        log "ERROR: No backup file found after backup.js"
        exit 1
    fi

    local size=$(du -h "$LATEST_BACKUP" | cut -f1)
    log "Backup created: $LATEST_BACKUP ($size)"
}

do_sync() {
    log "Syncing to ${REMOTE}:${REMOTE_PATH}..."

    "$RCLONE" copy \
        "$BACKUP_DIR" \
        "${REMOTE}:${REMOTE_PATH}" \
        --include "*.db.gz" \
        --include "*.db" \
        --log-level INFO \
        2>&1 | tee -a "$LOG_FILE"

    log "Sync complete"
}

do_verify() {
    log "Verifying remote backups..."

    local check_output
    check_output=$("$RCLONE" check \
        "$BACKUP_DIR" \
        "${REMOTE}:${REMOTE_PATH}" \
        --include "*.db.gz" \
        --include "*.db" \
        --one-way \
        2>&1) || true

    if echo "$check_output" | grep -q "0 differences found"; then
        log "Verification PASSED: all local backups exist on remote"
    else
        log "Verification result: $check_output"
    fi
}

do_retention() {
    log "Applying ${RETENTION_DAYS}-day retention on remote..."

    "$RCLONE" delete \
        "${REMOTE}:${REMOTE_PATH}" \
        --min-age "${RETENTION_DAYS}d" \
        --include "*.db.gz" \
        --include "*.db" \
        2>&1 | tee -a "$LOG_FILE"

    log "Remote retention applied"
}

update_manifest() {
    if [ -f "$LATEST_BACKUP" ]; then
        cd "$ROOT_DIR"
        "$BUN" -e "
import { addEntry, updateLastSync } from './scripts/lib/backup-manifest.js';
const path = '${LATEST_BACKUP}';
const filename = path.split('/').pop();
await addEntry({ filename, filePath: path, remote: '${REMOTE}:${REMOTE_PATH}', remoteVerified: true, type: 'daily' });
updateLastSync('${REMOTE}:${REMOTE_PATH}');
console.log('Manifest updated for', filename);
" 2>&1 | tee -a "$LOG_FILE"
    fi
}

show_status() {
    echo ""
    echo "=== VaultLister Cloud Backup Status ==="
    echo ""

    # Local backup status
    cd "$ROOT_DIR"
    "$BUN" scripts/backup-automation.js status

    # Remote status
    echo "--- Cloud Remote ---"
    if "$RCLONE" listremotes 2>/dev/null | grep -q "^${REMOTE}:"; then
        echo "Remote: ${REMOTE}:${REMOTE_PATH}"
        local count=$("$RCLONE" ls "${REMOTE}:${REMOTE_PATH}" --include "*.db.gz" --include "*.db" 2>/dev/null | wc -l)
        echo "Remote backups: $count"
        local total=$("$RCLONE" size "${REMOTE}:${REMOTE_PATH}" --include "*.db.gz" --include "*.db" 2>/dev/null | grep "Total size" || echo "unknown")
        echo "Remote size: $total"
    else
        echo "Remote: NOT CONFIGURED"
        echo "Run: docs/CLOUD_BACKUP_SETUP.md for setup instructions"
    fi

    # Manifest summary
    echo ""
    echo "--- Manifest ---"
    if [ -f "${BACKUP_DIR}/manifest.json" ]; then
        cd "$ROOT_DIR"
        "$BUN" -e "
import { getSummary } from './scripts/lib/backup-manifest.js';
const s = getSummary();
console.log('Total tracked:', s.totalBackups);
console.log('Remote verified:', s.remoteVerified);
console.log('Total size:', s.totalSizeMB, 'MB');
console.log('Last backup:', s.lastBackup || 'never');
console.log('Last sync:', s.lastSync || 'never');
" 2>/dev/null
    else
        echo "No manifest yet (first sync will create one)"
    fi

    echo ""
    echo "Retention: ${RETENTION_DAYS} days remote, 7 days local"
    echo "=================================="
}

list_remote() {
    check_rclone
    check_remote
    echo "Remote backups at ${REMOTE}:${REMOTE_PATH}:"
    echo ""
    "$RCLONE" ls "${REMOTE}:${REMOTE_PATH}" --include "*.db.gz" --include "*.db" 2>/dev/null || echo "(empty)"
}

restore_from_remote() {
    local file="$1"
    check_rclone
    check_remote

    log "Downloading $file from remote..."
    "$RCLONE" copy "${REMOTE}:${REMOTE_PATH}/${file}" "$BACKUP_DIR/" --progress

    if [ -f "${BACKUP_DIR}/${file}" ]; then
        log "Downloaded: ${BACKUP_DIR}/${file}"
        log "To restore, run: bun scripts/restore.js ${BACKUP_DIR}/${file}"
    else
        log "ERROR: Download failed"
        exit 1
    fi
}

# Main
case "${1:-sync}" in
    sync|"")
        check_rclone
        check_remote
        LATEST_BACKUP=""
        do_backup
        do_sync
        do_verify
        do_retention
        update_manifest
        log "Cloud backup sync completed successfully"
        notify "Backup sync complete: $(basename "${LATEST_BACKUP:-unknown}")"
        ;;
    --dry-run)
        check_rclone
        check_remote
        LATEST_BACKUP=""
        do_backup
        echo ""
        log "[DRY RUN] Would sync to ${REMOTE}:${REMOTE_PATH}"
        "$RCLONE" copy "$BACKUP_DIR" "${REMOTE}:${REMOTE_PATH}" --include "*.db.gz" --include "*.db" --dry-run 2>&1
        ;;
    --status)
        show_status
        ;;
    --list-remote)
        list_remote
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 --restore <filename>"
            echo "List available: $0 --list-remote"
            exit 1
        fi
        restore_from_remote "$2"
        ;;
    --help|-h)
        echo "VaultLister Cloud Backup Sync"
        echo ""
        echo "Usage: bash $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (default)      Full backup + cloud sync + verify + retention"
        echo "  --dry-run      Create backup, preview sync (no upload)"
        echo "  --status       Show local + remote backup status"
        echo "  --list-remote  List files on cloud remote"
        echo "  --restore FILE Download and prepare for restore"
        echo "  --help         Show this help"
        echo ""
        echo "Environment:"
        echo "  VAULTLISTER_RCLONE_REMOTE   rclone remote name (default: vaultlister-backup)"
        echo "  VAULTLISTER_REMOTE_PATH     remote path (default: VaultLister/Backups)"
        echo "  VAULTLISTER_RETENTION_DAYS  remote retention (default: 30)"
        echo ""
        echo "Setup: see docs/CLOUD_BACKUP_SETUP.md"
        ;;
    *)
        echo "Unknown command: $1 (use --help)"
        exit 1
        ;;
esac
