// Shared retry utility for Playwright bots
// Provides exponential backoff with CAPTCHA/auth fail-fast logic

import fs from 'fs';
import path from 'path';
import { logger } from '../../src/backend/shared/logger.js';

const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

function writeAuditLog(platform, event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform, event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch {}
}

// Delays in ms for each retry attempt (2s, 4s, 8s)
const RETRY_DELAYS = [2000, 4000, 8000];

/**
 * Retry an async action with exponential backoff.
 * Never retries CAPTCHA or auth failures — those fail fast.
 *
 * @param {Function} fn - Async function to retry (receives attempt number 0-indexed)
 * @param {object} opts
 * @param {number} opts.maxRetries - Maximum retry attempts (default 3)
 * @param {string} opts.platform - Bot name for audit log (default 'bot')
 * @param {string} opts.action - Action name for log context (default 'unknown')
 * @returns {Promise<*>} Result of fn on success
 * @throws Last error if all attempts exhausted
 */
export async function retryAction(fn, { maxRetries = 3, platform = 'bot', action = 'unknown' } = {}) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;
            const msg = err.message || '';

            // Fail fast — never retry CAPTCHA detection or auth failures
            if (msg.includes('CAPTCHA') || msg.toLowerCase().includes('captcha')) throw err;
            if (msg.toLowerCase().includes('auth failure') || msg.toLowerCase().includes('login failed')) throw err;

            if (attempt < maxRetries - 1) {
                const delay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
                logger.warn(`[${platform}] retryAction attempt ${attempt + 1}/${maxRetries} failed for "${action}" — retrying in ${delay}ms`, { error: msg });
                writeAuditLog(platform, 'retry_attempt', { attempt: attempt + 1, maxRetries, action, error: msg, delay });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}
