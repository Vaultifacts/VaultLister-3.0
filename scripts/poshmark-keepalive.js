#!/usr/bin/env node
/**
 * Poshmark Session Keep-Alive
 *
 * Visits Poshmark with the saved browser profile to refresh session cookies.
 * Run periodically (every 6-12 hours) to prevent session expiry.
 *
 * Usage:
 *   node scripts/poshmark-keepalive.js          # one-shot
 *   node scripts/poshmark-keepalive.js --loop    # run every 6 hours
 */

import { stealthChromium as chromium, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS } from '../src/shared/automations/stealth.js';
import { join, dirname } from 'path';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PROFILE_DIR = join(ROOT_DIR, 'data', 'poshmark-profile');
const COOKIE_FILE = join(ROOT_DIR, 'data', 'poshmark-cookies.json');
const KEEPALIVE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

function readEnvVar(name) {
    try {
        const env = readFileSync(join(ROOT_DIR, '.env'), 'utf8');
        const match = env.match(new RegExp(`^${name}=(.+)$`, 'm'));
        return match ? match[1].trim() : '';
    } catch { return ''; }
}

const COUNTRY = (process.env.POSHMARK_COUNTRY || readEnvVar('POSHMARK_COUNTRY') || 'us').toLowerCase();
const DOMAIN_MAP = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au' };
const POSHMARK_URL = DOMAIN_MAP[COUNTRY] || DOMAIN_MAP.us;

export async function refreshPoshmarkSession() {
    if (!existsSync(join(PROFILE_DIR, 'Default', 'Network', 'Cookies'))) {
        console.log('[poshmark-keepalive] No saved profile found — run node scripts/poshmark-login.js first');
        return { success: false, reason: 'no-profile' };
    }

    let context;
    try {
        context = await chromium.launchPersistentContext(PROFILE_DIR, {
            headless: true,
            args: STEALTH_ARGS,
            ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS
        });

        const page = context.pages()[0] || await context.newPage();
        await page.goto(`${POSHMARK_URL}/feed`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        if (page.url().includes('/login')) {
            console.log('[poshmark-keepalive] Session expired — need manual re-login via: node scripts/poshmark-login.js');
            await context.close();
            return { success: false, reason: 'session-expired' };
        }

        // Session is alive — save fresh cookies
        const cookies = await context.cookies();
        const poshmarkCookies = cookies.filter(c => c.domain.includes('poshmark'));
        writeFileSync(COOKIE_FILE, JSON.stringify(poshmarkCookies, null, 2));

        console.log(`[poshmark-keepalive] Session alive — refreshed ${poshmarkCookies.length} cookies at ${new Date().toISOString()}`);
        await context.close();
        return { success: true, cookies: poshmarkCookies.length };

    } catch (error) {
        console.error(`[poshmark-keepalive] Error: ${error.message}`);
        if (context) await context.close().catch(() => {});
        return { success: false, reason: error.message };
    }
}

// CLI mode
if (process.argv[1]?.includes('poshmark-keepalive')) {
    const loop = process.argv.includes('--loop');

    await refreshPoshmarkSession();

    if (loop) {
        console.log(`[poshmark-keepalive] Running in loop mode — refreshing every ${KEEPALIVE_INTERVAL_MS / 3600000}h`);
        setInterval(refreshPoshmarkSession, KEEPALIVE_INTERVAL_MS);
    }
}
