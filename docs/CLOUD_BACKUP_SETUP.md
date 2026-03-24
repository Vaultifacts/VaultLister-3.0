# Cloud Backup Setup — VaultLister 3.0

Automated offsite backups use **rclone**, which supports 40+ providers including S3, Google Cloud Storage, Backblaze B2, OneDrive, Google Drive, and Dropbox.

## Quick Start

### 1. Install rclone on the server

```bash
curl https://rclone.org/install.sh | sudo bash
```

### 2. Configure a remote

```bash
rclone config
```

Follow the interactive prompts to create a remote named `vaultlister-backup` for your chosen provider. Examples:

**Backblaze B2 (recommended — free 10GB, cheap after):**
```
Type: b2
Account: your-account-id
Key: your-application-key
```

**AWS S3:**
```
Type: s3
Provider: AWS
Access Key ID: your-access-key
Secret Access Key: your-secret-key
Region: us-east-1
```

**Google Cloud Storage:**
```
Type: google cloud storage
Project Number: your-project-id
(authenticate via browser)
```

### 3. Test the remote

```bash
rclone ls vaultlister-backup:VaultLister/Backups
# Should return empty or existing files — no error
```

### 4. Configure .env

```env
CLOUD_BACKUP_ENABLED=true
VAULTLISTER_RCLONE_REMOTE=vaultlister-backup
VAULTLISTER_REMOTE_PATH=VaultLister/Backups
VAULTLISTER_RETENTION_DAYS=30
RCLONE_PATH=/usr/bin/rclone
```

### 5. Test a manual sync

```bash
bash scripts/backup-cloud-sync.sh --dry-run
```

---

## Docker Deployment

The `backup-scheduler` service in `docker-compose.yml` handles automated daily backups. It needs the rclone config mounted:

```yaml
# docker-compose.yml (already configured)
volumes:
  - ${RCLONE_CONFIG_DIR:-/root/.config/rclone}:/root/.config/rclone:ro
```

Set `RCLONE_CONFIG_DIR` in `.env` to the path of your rclone config directory on the host:

```env
RCLONE_CONFIG_DIR=/home/youruser/.config/rclone
```

Then restart the backup scheduler:

```bash
docker compose --profile production up -d backup-scheduler
```

---

## Commands

| Command | Description |
|---------|-------------|
| `bash scripts/backup-cloud-sync.sh` | Full backup + sync + verify |
| `bash scripts/backup-cloud-sync.sh --dry-run` | Preview without uploading |
| `bash scripts/backup-cloud-sync.sh --status` | Show local + remote status |
| `bash scripts/backup-cloud-sync.sh --list-remote` | List remote files |
| `bash scripts/backup-cloud-sync.sh --restore FILE` | Download from remote |
| `bun scripts/backup-automation.js status` | Local backup stats |

---

## Retention

- **Remote**: 30 days (configurable via `VAULTLISTER_RETENTION_DAYS`)
- **Local daily**: 7 days
- **Local weekly**: 4 weeks
- **Local monthly**: 12 months

---

## Verification

After the first sync, verify:

```bash
bash scripts/backup-cloud-sync.sh --list-remote
bash scripts/backup-cloud-sync.sh --status
```

The status command shows remote backup count, total size, and last sync time.
