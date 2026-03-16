# Backup and Restore Guide — VaultLister 3.0

## How Backups Work

A daily cron job runs at **3:00 AM UTC** on the host machine. It executes `/opt/vaultlister-staging/backup.sh`, which:

1. Puts the SQLite database into WAL checkpoint mode to flush any pending writes
2. Copies the database file (`data/vaultlister.db`) to the backup directory using SQLite's `.backup` command (safe for live databases)
3. Compresses the copy with gzip
4. Names the file with a UTC timestamp: `vaultlister-YYYY-MM-DD_HHMMSS.db.gz`
5. Deletes backups older than **7 days**, keeping at most 7 daily snapshots

The application continues serving traffic during the backup — WAL mode ensures no downtime.

## Where Backups Are Stored

```
/opt/vaultlister-staging/backups/
  vaultlister-2026-03-16_030001.db.gz
  vaultlister-2026-03-15_030001.db.gz
  ...
```

Only the 7 most recent daily backups are retained. Older files are pruned automatically by `backup.sh`.

## Manual Backup

To create an immediate out-of-cycle backup:

```bash
/opt/vaultlister-staging/backup.sh
```

The resulting file will appear in `/opt/vaultlister-staging/backups/` with the current timestamp. This is safe to run while the application is live.

## Restore Procedure

To restore from a backup file:

```bash
/opt/vaultlister-staging/restore.sh <filename>
```

**Example:**

```bash
/opt/vaultlister-staging/restore.sh vaultlister-2026-03-15_030001.db.gz
```

The `<filename>` argument must be the filename only (not a full path). The script resolves the path to `/opt/vaultlister-staging/backups/<filename>`.

### What restore.sh Does

1. **Validates** the provided filename exists in the backups directory
2. **Creates a pre-restore snapshot** of the current database before overwriting anything — saved as `vaultlister-pre-restore-YYYY-MM-DD_HHMMSS.db.gz` in the backups directory
3. **Stops the application** (`systemctl stop vaultlister` or equivalent process manager)
4. **Decompresses** the backup file to a temporary path
5. **Copies** the decompressed database to `data/vaultlister.db`, replacing the live file
6. **Sets correct file permissions** (owner: vaultlister service user, mode: 640)
7. **Restarts the application** (`systemctl start vaultlister`)
8. **Runs a health check** — polls `http://localhost:3000/api/health` up to 10 times with 3-second intervals; if the health check fails after all retries, the script logs an error and exits with a non-zero status (it does NOT automatically roll back — see Disaster Recovery below)

Total downtime during a restore is typically under 60 seconds.

## Safety: Pre-Restore Snapshot

Before any restore, `restore.sh` automatically snapshots the current database. This protects against accidental restores of the wrong file.

Pre-restore snapshots are saved alongside regular backups:

```
/opt/vaultlister-staging/backups/
  vaultlister-pre-restore-2026-03-16_142233.db.gz   ← automatic snapshot
  vaultlister-2026-03-16_030001.db.gz
  vaultlister-2026-03-15_030001.db.gz
```

Pre-restore snapshots are **not** pruned by the daily 7-day retention policy. Remove them manually once you are confident the restore was successful.

## Testing a Restore

To verify a backup is readable without touching the live database:

```bash
# Decompress to a temp file and inspect
gunzip -c /opt/vaultlister-staging/backups/vaultlister-2026-03-15_030001.db.gz > /tmp/test-restore.db
sqlite3 /tmp/test-restore.db "SELECT COUNT(*) FROM inventory_items;"
sqlite3 /tmp/test-restore.db ".tables"
rm /tmp/test-restore.db
```

To do a full restore drill on a non-production instance, copy the backup file to the staging host and run `restore.sh` there. The health check at the end of `restore.sh` confirms the restored database is functional.

## Disaster Recovery Scenarios

### Scenario 1: Accidental data deletion

**Symptom:** A user or automation deleted rows that should not have been deleted.

**Recovery:**
1. Identify the last backup before the deletion occurred
2. Run `restore.sh <that-backup-file>`
3. If only partial data needs to be recovered (not a full rollback), decompress the backup to `/tmp/`, query the rows you need from the backup using `sqlite3`, and INSERT them back into the live database manually

### Scenario 2: Database corruption

**Symptom:** SQLite reports `database disk image is malformed` or the application fails to start with a database error.

**Recovery:**
1. Stop the application immediately to prevent further writes
2. Run `restore.sh` with the most recent healthy backup
3. If the most recent backup is also corrupted, try the next oldest

To check whether a backup file is healthy before restoring:

```bash
gunzip -c /opt/vaultlister-staging/backups/<filename> > /tmp/check.db
sqlite3 /tmp/check.db "PRAGMA integrity_check;"
rm /tmp/check.db
```

A healthy database returns `ok`. Any other output indicates corruption.

### Scenario 3: Health check fails after restore

**Symptom:** `restore.sh` completes but the health check loop exits with failure.

**Recovery:**
1. Check the application logs: `journalctl -u vaultlister -n 100`
2. If the restored database is causing the failure, restore from the pre-restore snapshot that `restore.sh` created automatically
3. If the application itself is the problem (not the database), fix the application issue and restart — the restored database remains in place

### Scenario 4: Host machine lost (full disaster)

**Symptom:** The server is unrecoverable.

**Recovery:**
1. Provision a new host and deploy the application per `docs/DEPLOYMENT_RUNBOOK.md`
2. Copy backup files from off-host storage (S3, rclone target, or manual copy) to `/opt/vaultlister-staging/backups/` on the new host
3. Run `restore.sh <most-recent-backup>`
4. Verify with a health check and smoke test

Note: off-host backup replication (e.g., rclone to S3) must be configured separately from the local backup cron. See `docs/DEPLOYMENT_RUNBOOK.md` for off-host storage setup.
