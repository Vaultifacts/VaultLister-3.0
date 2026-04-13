// Shared bot utilities for Playwright bots
// Provides browser close with timeout, screenshot capture, and error-screenshot purge

import fs from 'fs';
import path from 'path';
import { logger } from '../../src/backend/shared/logger.js';

const BOT_ERROR_DIR = path.join(process.cwd(), 'data', 'bot-errors');
const SCREENSHOT_MAX_AGE_DAYS = 7;

/**
 * Close a Playwright browser with a 10-second timeout.
 * Prevents hangs when the browser is unresponsive.
 *
 * @param {import('playwright').Browser|null} browser
 * @param {number} [timeoutMs=10000]
 */
export async function closeBrowserWithTimeout(browser, timeoutMs = 10000) {
    if (!browser) return;
    try {
        await Promise.race([
            browser.close(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Browser close timed out after 10s')), timeoutMs)
            )
        ]);
    } catch (err) {
        logger.warn('[BotUtils] Browser close error (forcing detach)', { error: err.message });
    }
}

/**
 * Capture a failure screenshot for debugging.
 * Saves to data/bot-errors/<timestamp>-<tag>.png.
 *
 * @param {import('playwright').Page|null} page
 * @param {string} [tag='error'] - Short label used in the filename
 * @returns {Promise<string|null>} Saved file path, or null on failure
 */
export async function captureErrorScreenshot(page, tag = 'error') {
    if (!page) return null;
    try {
        fs.mkdirSync(BOT_ERROR_DIR, { recursive: true });
        const safeTag = tag.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
        const filename = `${Date.now()}-${safeTag}.png`;
        const filePath = path.join(BOT_ERROR_DIR, filename);
        await page.screenshot({ path: filePath, fullPage: false });
        logger.info('[BotUtils] Error screenshot saved', { path: filePath });
        return filePath;
    } catch (err) {
        logger.warn('[BotUtils] Could not capture error screenshot', { error: err.message });
        return null;
    }
}

/**
 * Purge error screenshots older than SCREENSHOT_MAX_AGE_DAYS.
 * Called once per bot session to keep data/bot-errors/ lean.
 */
export function purgeOldErrorScreenshots() {
    try {
        if (!fs.existsSync(BOT_ERROR_DIR)) return;
        const cutoff = Date.now() - SCREENSHOT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        for (const file of fs.readdirSync(BOT_ERROR_DIR)) {
            if (!file.endsWith('.png')) continue;
            const filePath = path.join(BOT_ERROR_DIR, file);
            try {
                const { mtimeMs } = fs.statSync(filePath);
                if (mtimeMs < cutoff) fs.unlinkSync(filePath);
            } catch {}
        }
    } catch {}
}
