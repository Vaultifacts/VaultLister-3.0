#!/usr/bin/env node
// Backup Manifest Tracker
// Tracks all local and cloud backups with checksums and verification status

import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');
const BACKUP_DIR = process.env.BACKUP_DIR || join(ROOT_DIR, 'backups');
const MANIFEST_PATH = join(BACKUP_DIR, 'manifest.json');

function readManifest() {
    if (!existsSync(MANIFEST_PATH)) {
        return { backups: [], lastSync: null, config: {} };
    }
    try {
        return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch {
        return { backups: [], lastSync: null, config: {} };
    }
}

function writeManifest(manifest) {
    const dir = dirname(MANIFEST_PATH);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function computeChecksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function addEntry(entry) {
    const manifest = readManifest();

    // Compute checksum if file exists and none provided
    if (entry.filePath && existsSync(entry.filePath) && !entry.checksum) {
        entry.checksum = await computeChecksum(entry.filePath);
    }

    // Get file size
    if (entry.filePath && existsSync(entry.filePath) && !entry.sizeBytes) {
        entry.sizeBytes = statSync(entry.filePath).size;
    }

    const record = {
        id: crypto.randomUUID(),
        filename: entry.filename,
        timestamp: new Date().toISOString(),
        sizeBytes: entry.sizeBytes || 0,
        checksum: entry.checksum || null,
        local: entry.local !== false,
        remote: entry.remote || null,
        remoteVerified: entry.remoteVerified || false,
        type: entry.type || 'daily'
    };

    manifest.backups.push(record);
    writeManifest(manifest);
    return record;
}

function getLatestEntry() {
    const manifest = readManifest();
    if (manifest.backups.length === 0) return null;
    return manifest.backups[manifest.backups.length - 1];
}

function updateLastSync(remote) {
    const manifest = readManifest();
    manifest.lastSync = new Date().toISOString();
    if (remote) {
        manifest.config.remote = remote;
    }
    writeManifest(manifest);
}

function markRemoteVerified(id) {
    const manifest = readManifest();
    const entry = manifest.backups.find(b => b.id === id);
    if (entry) {
        entry.remoteVerified = true;
        entry.remote = manifest.config.remote || entry.remote;
    }
    writeManifest(manifest);
}

function pruneEntries(maxAgeDays = 30) {
    const manifest = readManifest();
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const before = manifest.backups.length;
    manifest.backups = manifest.backups.filter(b => new Date(b.timestamp) > cutoff);
    writeManifest(manifest);
    return before - manifest.backups.length;
}

function getSummary() {
    const manifest = readManifest();
    const total = manifest.backups.length;
    const verified = manifest.backups.filter(b => b.remoteVerified).length;
    const totalSize = manifest.backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
    const latest = manifest.backups[manifest.backups.length - 1];

    return {
        totalBackups: total,
        remoteVerified: verified,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        lastBackup: latest?.timestamp || null,
        lastSync: manifest.lastSync,
        remote: manifest.config.remote || 'not configured'
    };
}

export {
    readManifest,
    writeManifest,
    addEntry,
    getLatestEntry,
    updateLastSync,
    markRemoteVerified,
    pruneEntries,
    getSummary,
    computeChecksum,
    MANIFEST_PATH
};
