# Backup and Restore Guide

## Overview

VaultLister uses PostgreSQL logical backups created by `scripts/pg-backup.js` and restored by `scripts/pg-restore.js`.

- Backup format: `pg_dump` custom archive (`.dump` or `.dump.gz`)
- Default local backup directory: `backups/`
- Retention: `scripts/pg-backup.js` keeps the 7 most recent local backups
- Optional cloud upload: Backblaze B2 via `CLOUD_BACKUP_ENABLED=true`

## Requirements

- `DATABASE_URL` must point at the target PostgreSQL database
- `pg_dump` must be available in `PATH` for backups
- `pg_restore` must be available in `PATH` for restores
- `gzip` is required for `--compress`

Optional cloud-backup variables:

- `B2_APPLICATION_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_NAME`
- `CLOUD_BACKUP_ENABLED=true`

## Manual Backups

Create an uncompressed local backup:

```bash
DATABASE_URL=postgres://... bun run db:backup
```

Create a compressed local backup:

```bash
DATABASE_URL=postgres://... bun run db:backup:compress
```

Write to a custom path:

```bash
bun scripts/pg-backup.js --output backups/manual-pre-maintenance.dump.gz --compress
```

## Restore Procedure

Restore a backup archive:

```bash
DATABASE_URL=postgres://... bun run db:restore backups/vaultlister-2026-04-11T19-30-00.dump.gz
```

Skip the confirmation prompt:

```bash
DATABASE_URL=postgres://... bun scripts/pg-restore.js backups/vaultlister-2026-04-11T19-30-00.dump.gz --force
```

Important restore behavior:

- `pg_restore` runs with `--clean --if-exists`
- The public schema is dropped and recreated
- Existing application data is replaced
- The server must be restarted after a successful restore

## Verification After Restore

After restore and server restart, verify the application before returning traffic:

```bash
curl -sf http://localhost:3000/api/health
curl -sf http://localhost:3000/api/workers/health
bun run ops:health
```

If Redis and worker services are available, run the full local smoke:

```bash
bun scripts/launch-ops-check.mjs http://localhost:3000 --all
```

For restore drills in isolated environments, also run:

```bash
bun run build
PORT=3000 NODE_ENV=test bun run test:e2e:smoke
```

## GitHub Automation

The repo already automates backup and restore-readiness checks:

- `.github/workflows/backup.yml`
  - daily compressed backup
  - uploads to Backblaze B2
  - uses `DATABASE_PUBLIC_URL`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`
- `.github/workflows/backup-verify.yml`
  - downloads the latest backup from B2
  - restores into an isolated PostgreSQL service
  - runs integrity checks against core tables and row relationships

## Failure Checkpoints

Do not run a restore against production unless:

- the backup file exists and matches the intended timestamp
- `DATABASE_URL` points at the correct target database
- you have a current out-of-band backup of the target environment

Treat restore as failed if any of these happen:

- `pg_restore` exits non-zero
- the server does not restart cleanly
- `/api/health` or `/api/workers/health` fails after restore
- `bun run ops:health` reports degraded readiness
