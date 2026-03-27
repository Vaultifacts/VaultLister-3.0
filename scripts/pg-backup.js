#!/usr/bin/env bun
// VaultLister PostgreSQL Backup Script
// Usage: bun scripts/pg-backup.js [--output <path>] [--compress]
//
// Requires pg_dump in PATH (available on Railway via postgres client tools).
// Writes a pg_dump custom-format archive (.dump) — use pg-restore.js to restore.

import { mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DEFAULT_BACKUP_DIR = join(ROOT_DIR, 'backups');

const args = process.argv.slice(2);
const compress = args.includes('--compress');
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.');
    process.exit(1);
}

async function backup() {
    console.log('VaultLister PostgreSQL Backup');
    console.log('=============================\n');

    const backupDir = outputPath ? dirname(outputPath) : DEFAULT_BACKUP_DIR;
    mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = compress ? '.dump.gz' : '.dump';
    const backupFile = outputPath || join(backupDir, `vaultlister-${timestamp}${ext}`);

    console.log('Creating backup...');
    console.log('  Source:      ', DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));
    console.log('  Destination: ', backupFile);

    try {
        const pgDumpArgs = [
            '--format=custom',
            '--no-password',
            '--verbose',
            '--file', compress ? backupFile.replace(/\.gz$/, '') : backupFile,
            DATABASE_URL,
        ];

        await execFileAsync('pg_dump', pgDumpArgs);

        if (compress) {
            const uncompressed = backupFile.replace(/\.gz$/, '');
            await execFileAsync('gzip', ['-f', uncompressed]);
        }

        const size = statSync(backupFile).size;
        console.log('\nBackup created successfully!');
        console.log('  Size:', formatBytes(size));
        console.log('  File:', backupFile);

        cleanupOldBackups(backupDir, 7);

        if (process.env.CLOUD_BACKUP_ENABLED === 'true') {
            await uploadToB2(backupFile);
        }

        console.log('\nBackup complete!');

    } catch (error) {
        console.error('Backup failed:', error.message);
        if (error.stderr) console.error(error.stderr);
        process.exit(1);
    }
}

function cleanupOldBackups(dir, keepCount) {
    try {
        const files = readdirSync(dir)
            .filter(f => f.startsWith('vaultlister-') && (f.endsWith('.dump') || f.endsWith('.dump.gz')))
            .map(f => ({ name: f, path: join(dir, f), mtime: statSync(join(dir, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length > keepCount) {
            console.log(`\nCleaning up old backups (keeping ${keepCount} most recent)...`);
            for (const file of files.slice(keepCount)) {
                unlinkSync(file.path);
                console.log('  Deleted:', file.name);
            }
        }
    } catch (error) {
        console.warn('Warning: Failed to cleanup old backups:', error.message);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadToB2(filePath) {
    const keyId = process.env.B2_APPLICATION_KEY_ID;
    const appKey = process.env.B2_APPLICATION_KEY;
    const bucket = process.env.B2_BUCKET_NAME;
    if (!keyId || !appKey || !bucket) {
        console.warn('Warning: B2 credentials not set — skipping cloud upload.');
        return;
    }

    console.log('\nUploading to B2...');

    // Auto-discover S3-compatible endpoint via B2 authorize
    const authResp = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${keyId}:${appKey}`).toString('base64')
        }
    });
    if (!authResp.ok) {
        throw new Error(`B2 auth failed: ${authResp.status} ${await authResp.text()}`);
    }
    const auth = await authResp.json();
    const endpoint = auth.s3ApiUrl;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { createReadStream } = await import('fs');

    const client = new S3Client({
        endpoint,
        region: 'auto',
        credentials: { accessKeyId: keyId, secretAccessKey: appKey }
    });

    const key = `backups/${basename(filePath)}`;
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filePath)
    }));
    console.log(`  Uploaded: ${endpoint}/${bucket}/${key}`);
}

backup();
