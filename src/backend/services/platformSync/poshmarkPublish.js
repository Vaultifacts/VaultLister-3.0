// Poshmark Publish Service
// Creates a new Poshmark listing via Playwright browser automation.
// The browser is launched in a subprocess (scripts/poshmark-publish-bot.js) to avoid
// Windows detached-process + Playwright pipe timeout issues.
//
// Note: Poshmark has no public API. This service automates the web UI.
// Requires POSHMARK_USERNAME and POSHMARK_PASSWORD in .env.

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../shared/logger.js';
import { auditLog } from './platformAuditLog.js';
import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../../../../');
const BOT_SCRIPT = join(ROOT_DIR, 'scripts', 'poshmark-publish-bot.js');
const BOT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Publish a VaultLister listing to Poshmark via browser automation.
 * @param {Object} shop      - Shop row (platform = 'poshmark', unused — creds from .env)
 * @param {Object} listing   - Listing row
 * @param {Object} inventory - InventoryItem row
 * @returns {{ listingId, listingUrl }}
 */
export async function publishListingToPoshmark(shop, listing, inventory) {
    const username = process.env.POSHMARK_USERNAME;
    const password = process.env.POSHMARK_PASSWORD;

    if (!username || !password) {
        throw new Error('POSHMARK_USERNAME and POSHMARK_PASSWORD must be set in .env to publish to Poshmark');
    }

    const price = parseFloat(listing.price || inventory.list_price || 0);
    if (!price || price <= 0) throw new Error('Listing price must be greater than zero');

    const title       = (listing.title || inventory.title || 'Item from VaultLister').slice(0, 80);
    const description = (listing.description || inventory.description || title).slice(0, 500);
    const brand       = inventory.brand || 'Other';
    const originalPrice = String(Math.max(price, parseFloat(inventory.cost_price || 0) || price * 1.5).toFixed(2));

    // Resolve photos — Poshmark requires real item photos; placeholder/thumbnail images get moderated
    const { files: photoFiles, tempFiles } = await resolveImageFiles(inventory.images, 4);
    if (photoFiles.length === 0) {
        throw new Error('Cannot publish to Poshmark: no real item photos attached. Upload photos to this inventory item first.');
    }

    // Category — use inventory/listing category; bot defaults to Men>Tops if not set
    const category = listing.category || inventory.category || null;

    logger.info('[Poshmark Publish] Spawning bot subprocess', { photoCount: photoFiles.length, category });

    const payload = JSON.stringify({
        username, password, title, description, brand,
        price: price.toFixed(2),
        originalPrice,
        listingId: listing.id,
        photoPath: photoFiles[0],   // primary photo; bot handles single-photo upload
        category: category || undefined,
        size: inventory.size || undefined
    });

    return new Promise((resolve, reject) => {
        const child = spawn('node', [BOT_SCRIPT], {  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env
        });

        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Poshmark publish bot timed out after 5 minutes'));
        }, BOT_TIMEOUT_MS);

        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => {
            stderr += d.toString();
            // Stream bot progress to server log
            d.toString().split('\n').filter(Boolean).forEach(line => logger.info('[Poshmark Bot] ' + line));
        });

        child.stdin.write(payload);
        child.stdin.end();

        child.on('close', (code) => {
            clearTimeout(timer);
            cleanupTempImages(tempFiles);
            if (stderr) {
                stderr.split('\n').filter(l => l.includes('ERROR')).forEach(l => logger.error(l));
            }
            let result;
            try {
                result = JSON.parse(stdout.trim());
            } catch {
                return reject(new Error('Bot produced invalid output: ' + stdout.slice(0, 200)));
            }
            if (result.success) {
                if (result.warning) logger.warn('[Poshmark Publish] ' + result.warning);
                const urlMatch = result.listingUrl?.match(/\/listing\/[^/]*[-_]([a-f0-9]{24})(?:[/?]|$)/)
                              || result.listingUrl?.match(/\/listing\/([^/?]+)/);
                resolve({
                    listingId: urlMatch ? urlMatch[1] : `pm-${Date.now()}`,
                    listingUrl: result.listingUrl,
                    warning: result.warning
                });
            } else {
                reject(new Error(result.error || 'Poshmark publish failed'));
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error('Failed to spawn bot: ' + err.message));
        });
    });
}

export default { publishListingToPoshmark };
