// Platform Audit Log — shared helper for all publish services
// Appends JSON-line records to data/automation-audit.log
// Required by RULES.md: "All automation actions must be logged to data/automation-audit.log"

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH  = join(__dirname, '../../../../data/automation-audit.log');
const LOG_DIR   = dirname(LOG_PATH);

/**
 * Append a JSON-line record to the automation audit log.
 * @param {string} platform - 'poshmark' | 'mercari' | 'depop' | 'grailed' | 'facebook' | 'whatnot' | 'shopify'
 * @param {string} event    - 'publish_attempt' | 'publish_success' | 'publish_failure'
 * @param {Object} data     - Additional fields (listingId, listingUrl, error, etc.)
 */
export function auditLog(platform, event, data = {}) {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const record = JSON.stringify({ ts: new Date().toISOString(), platform, event, ...data });
    appendFileSync(LOG_PATH, record + '\n');
}
