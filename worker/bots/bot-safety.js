// Shared Bot Safety Module — Cross-platform anti-detection enforcement
// Provides nighttime enforcement, session locking, and cooldown checks
// that all platform bots should use, not just Facebook.

import fs from 'fs';
import path from 'path';
import { logger } from '../../src/backend/shared/logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Check if current time is outside operating hours (11pm-7am local).
 * Per spec Layer 6: no automation between 11pm and 7am.
 * @returns {boolean}
 */
export function isNighttime() {
    const hour = new Date().getHours();
    return hour >= 23 || hour < 7;
}

/**
 * Acquire a platform-specific session lock.
 * Per spec Layer 6: never run two automation sessions simultaneously for the same platform.
 * @param {string} platform - Platform name (poshmark, mercari, etc.)
 * @returns {boolean} true if lock acquired
 */
export function acquirePlatformLock(platform) {
    const lockPath = path.join(DATA_DIR, `.${platform}-session.lock`);
    if (fs.existsSync(lockPath)) {
        try {
            const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            // Stale lock: if older than 30 minutes, force release
            if (Date.now() - new Date(lock.ts).getTime() > 30 * 60 * 1000) {
                releasePlatformLock(platform);
            } else {
                return false;
            }
        } catch { releasePlatformLock(platform); }
    }
    fs.writeFileSync(lockPath, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid }), 'utf8');
    return true;
}

/**
 * Release a platform-specific session lock and record end time.
 * @param {string} platform
 */
export function releasePlatformLock(platform) {
    const lockPath = path.join(DATA_DIR, `.${platform}-session.lock`);
    const lastPath = lockPath + '.last';
    try { fs.writeFileSync(lastPath, JSON.stringify({ endedAt: new Date().toISOString() }), 'utf8'); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
}

/**
 * Check if the platform-specific session cooldown is active.
 * @param {string} platform
 * @param {number} cooldownMs - Cooldown duration in milliseconds
 * @returns {boolean}
 */
export function isPlatformCooldownActive(platform, cooldownMs) {
    const lastPath = path.join(DATA_DIR, `.${platform}-session.lock.last`);
    try {
        if (fs.existsSync(lastPath)) {
            const data = JSON.parse(fs.readFileSync(lastPath, 'utf8'));
            const elapsed = Date.now() - new Date(data.endedAt).getTime();
            if (elapsed < cooldownMs) {
                const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
                logger.warn(`[BotSafety] ${platform} session cooldown: ${remaining}s remaining`);
                return true;
            }
        }
    } catch {}
    return false;
}

/**
 * Pre-flight safety check for any platform bot.
 * Call before starting any automation session.
 * @param {string} platform
 * @param {Object} opts
 * @param {number} opts.sessionCooldownMs - Minimum gap between sessions (default 60s)
 * @returns {{ safe: boolean, reason: string|null }}
 */
export function preBotSafetyCheck(platform, { sessionCooldownMs = 60000 } = {}) {
    if (isNighttime()) {
        return { safe: false, reason: 'Nighttime enforcement: no automation between 11pm and 7am local time.' };
    }
    if (isPlatformCooldownActive(platform, sessionCooldownMs)) {
        return { safe: false, reason: `Session cooldown active for ${platform}. Try again later.` };
    }
    if (!acquirePlatformLock(platform)) {
        return { safe: false, reason: `Another ${platform} automation session is already running.` };
    }
    return { safe: true, reason: null };
}

export default { isNighttime, acquirePlatformLock, releasePlatformLock, isPlatformCooldownActive, preBotSafetyCheck };
