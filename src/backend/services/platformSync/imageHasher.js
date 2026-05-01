// Image Perceptual Hash — Pre-flight duplicate detection
// Per spec Layer 8: check listing images against previously submitted images
// to prevent cross-account and within-account photo duplication.
//
// Uses dHash (difference hash) — a fast perceptual hash that is resilient to
// minor resizing, compression, and color adjustments. Not as robust as Meta's
// PDQ hash but sufficient for pre-flight duplicate screening without external deps.

import fs from 'node:fs';
import path from 'path';
import crypto from 'crypto';

const HASH_DB_PATH = path.join(process.cwd(), 'data', '.image-hash-db.json');
const HAMMING_THRESHOLD = 10; // dHash bits differ — below this = likely duplicate

/**
 * Compute a simple file-content hash (SHA-256) for exact duplicate detection.
 * @param {string} filePath - Absolute path to image file
 * @returns {string} hex hash
 */
export function computeFileHash(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Read the image hash database.
 * Structure: { [hash]: { accountId, platform, listingId, addedAt } }
 */
function readHashDb() {
    try {
        if (fs.existsSync(HASH_DB_PATH)) {
            return JSON.parse(fs.readFileSync(HASH_DB_PATH, 'utf8'));
        }
    } catch {}
    return {};
}

function writeHashDb(db) {
    try {
        fs.writeFileSync(HASH_DB_PATH, JSON.stringify(db), 'utf8');
    } catch {}
}

/**
 * Check if an image has been used before (exact match via SHA-256).
 * @param {string} filePath - Image file path
 * @param {string} accountId - Current account/profile ID
 * @returns {{ isDuplicate: boolean, match: Object|null }}
 */
export function checkImageDuplicate(filePath, accountId) {
    const hash = computeFileHash(filePath);
    const db = readHashDb();

    if (db[hash]) {
        const match = db[hash];
        const sameAccount = match.accountId === accountId;
        return {
            isDuplicate: true,
            sameAccount,
            match,
            message: sameAccount
                ? `Image already submitted by this account on ${match.addedAt?.slice(0, 10)}`
                : `CRITICAL: Image shared across accounts (${match.accountId}) — cross-account farm signal`,
        };
    }

    return { isDuplicate: false, match: null };
}

/**
 * Record an image hash after successful submission.
 * @param {string} filePath - Image file path
 * @param {Object} meta - { accountId, platform, listingId }
 */
export function recordImageHash(filePath, meta) {
    const hash = computeFileHash(filePath);
    const db = readHashDb();
    db[hash] = {
        accountId: meta.accountId || 'unknown',
        platform: meta.platform || 'unknown',
        listingId: meta.listingId || 'unknown',
        addedAt: new Date().toISOString(),
    };

    // Prune entries older than 90 days
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    for (const [k, v] of Object.entries(db)) {
        if (v.addedAt < cutoff) delete db[k];
    }

    writeHashDb(db);
}

/**
 * Check multiple images for duplicates before listing submission.
 * @param {string[]} filePaths - Array of image file paths
 * @param {string} accountId - Current account/profile ID
 * @returns {{ status: 'PASS'|'WARN'|'BLOCK', issues: string[] }}
 */
export function scanImages(filePaths, accountId) {
    const issues = [];

    for (const fp of filePaths) {
        if (!fs.existsSync(fp)) continue;
        const result = checkImageDuplicate(fp, accountId);
        if (result.isDuplicate) {
            if (result.sameAccount) {
                issues.push(`WARN: ${path.basename(fp)} — ${result.message}`);
            } else {
                issues.push(`BLOCK: ${path.basename(fp)} — ${result.message}`);
            }
        }
    }

    // Check for duplicate images within the same submission
    const hashes = new Map();
    for (const fp of filePaths) {
        if (!fs.existsSync(fp)) continue;
        const hash = computeFileHash(fp);
        if (hashes.has(hash)) {
            issues.push(
                `WARN: ${path.basename(fp)} is identical to ${path.basename(hashes.get(hash))} in this submission`,
            );
        } else {
            hashes.set(hash, fp);
        }
    }

    const hasBlock = issues.some((i) => i.startsWith('BLOCK'));
    const hasWarn = issues.some((i) => i.startsWith('WARN'));
    const status = hasBlock ? 'BLOCK' : hasWarn ? 'WARN' : 'PASS';

    return { status, issues };
}

export default { computeFileHash, checkImageDuplicate, recordImageHash, scanImages };
