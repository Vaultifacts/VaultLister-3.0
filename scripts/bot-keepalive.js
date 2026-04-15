#!/usr/bin/env node
/**
 * Unified Bot Session Keep-Alive
 *
 * For each platform that has credentials configured, checks whether the
 * saved cookie file exists and is non-empty.  It does NOT launch a browser
 * or make live network requests — Railway cron containers do not have a
 * display, and a lightweight file-presence + staleness check is sufficient
 * to surface "session needs refresh" warnings without risking bot detection.
 *
 * Exit code is always 0 — this is informational only.  Re-login is manual.
 *
 * Usage:
 *   bun scripts/bot-keepalive.js
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const AUDIT_LOG = path.join(ROOT_DIR, 'data', 'automation-audit.log');

// Maximum cookie file age before we flag the session as stale (8 hours).
// The cron runs every 4 hours so two missed runs = stale.
const STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000;

// Platform definitions — env var that signals credentials exist, and the
// cookie file path that the corresponding bot writes after a successful login.
const PLATFORMS = [
    {
        id: 'poshmark',
        credentialVar: 'POSHMARK_USERNAME',
        cookieFile: path.join(ROOT_DIR, 'data', 'poshmark-cookies.json'),
    },
    {
        id: 'mercari',
        credentialVar: 'MERCARI_USERNAME',
        cookieFile: path.join(ROOT_DIR, 'data', 'mercari-cookies.json'),
    },
    {
        id: 'grailed',
        credentialVar: 'GRAILED_USERNAME',
        cookieFile: path.join(ROOT_DIR, 'data', 'grailed-cookies.json'),
    },
    {
        id: 'facebook',
        credentialVar: 'FACEBOOK_EMAIL',
        cookieFile: path.join(ROOT_DIR, 'data', 'facebook-cookies.json'),
    },
    {
        id: 'whatnot',
        credentialVar: 'WHATNOT_USERNAME',
        cookieFile: path.join(ROOT_DIR, 'data', 'whatnot-cookies.json'),
    },
    {
        id: 'depop',
        credentialVar: 'DEPOP_USERNAME',
        cookieFile: path.join(ROOT_DIR, 'data', 'depop-cookies.json'),
    },
];

function writeAuditLog(platform, event, metadata = {}) {
    try {
        fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
        const entry = JSON.stringify({
            ts: new Date().toISOString(),
            platform,
            event,
            ...metadata,
        });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch {}
}

function readEnvVar(name) {
    // Prefer process.env (populated by Railway at runtime or via dotenv).
    if (process.env[name]) return process.env[name];
    // Fallback: read .env file directly (local dev without dotenv).
    try {
        const envText = fs.readFileSync(path.join(ROOT_DIR, '.env'), 'utf8');
        const match = envText.match(new RegExp(`^${name}=(.+)$`, 'm')); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        return match ? match[1].trim() : '';
    } catch {
        return '';
    }
}

function checkPlatform(platform) {
    const hasCredential = Boolean(readEnvVar(platform.credentialVar));

    if (!hasCredential) {
        return { status: 'skipped', reason: 'no-credentials' };
    }

    if (!fs.existsSync(platform.cookieFile)) {
        return { status: 'warning', reason: 'no-cookie-file' };
    }

    let stat;
    try {
        stat = fs.statSync(platform.cookieFile);
    } catch {
        return { status: 'warning', reason: 'cookie-file-unreadable' };
    }

    if (stat.size === 0) {
        return { status: 'warning', reason: 'cookie-file-empty' };
    }

    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > STALE_THRESHOLD_MS) {
        const ageHours = (ageMs / 3600000).toFixed(1);
        return { status: 'warning', reason: 'session-stale', ageHours };
    }

    const ageHours = (ageMs / 3600000).toFixed(1);
    return { status: 'ok', ageHours };
}

const results = [];
const ts = new Date().toISOString();

console.log(`[bot-keepalive] Session health check — ${ts}`);
console.log('');

for (const platform of PLATFORMS) {
    const result = checkPlatform(platform);
    results.push({ platform: platform.id, ...result });

    const logEvent = result.status === 'ok'
        ? 'keepalive_session_ok'
        : result.status === 'skipped'
            ? 'keepalive_skipped'
            : 'keepalive_session_warning';

    writeAuditLog(platform.id, logEvent, result);

    if (result.status === 'ok') {
        console.log(`  [${platform.id}] OK — cookie file age ${result.ageHours}h`);
    } else if (result.status === 'skipped') {
        console.log(`  [${platform.id}] SKIPPED — ${result.reason}`);
    } else {
        const detail = result.ageHours ? `(${result.ageHours}h old)` : '';
        console.warn(`  [${platform.id}] WARNING — ${result.reason} ${detail}`.trim());
        console.warn(`    Action: run the ${platform.id} login script to refresh the session.`);
    }
}

console.log('');

const warnings = results.filter(r => r.status === 'warning');
const ok = results.filter(r => r.status === 'ok');
const skipped = results.filter(r => r.status === 'skipped');

console.log(`[bot-keepalive] Summary: ${ok.length} OK, ${warnings.length} warning(s), ${skipped.length} skipped`);

writeAuditLog('all', 'keepalive_run_complete', {
    ok: ok.length,
    warnings: warnings.length,
    skipped: skipped.length,
});

// Always exit 0 — this script is informational; Railway should not treat
// a stale session as a container crash.
process.exit(0);
