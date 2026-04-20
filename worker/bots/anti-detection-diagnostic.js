#!/usr/bin/env node
// Anti-Detection Diagnostic Tool
// Runs self-checks against the current bot configuration to identify
// detection risks before running automation against live platforms.
//
// Usage: bun worker/bots/anti-detection-diagnostic.js
//        node worker/bots/anti-detection-diagnostic.js

import { initProfiles, getProfileDir, getProfileBehavior, getProfileProxy, validateProfileIsolation, cleanProfileServiceWorkers } from './browser-profiles.js';
import { RATE_LIMITS } from './rate-limits.js';
import fs from 'fs';
import path from 'path';

const PASS = '\x1b[32mPASS\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

let passes = 0, warnings = 0, failures = 0;

function check(label, status, detail = '') {
    const icon = status === 'pass' ? PASS : status === 'warn' ? WARN : FAIL;
    if (status === 'pass') passes++;
    else if (status === 'warn') warnings++;
    else failures++;
    console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n=== Anti-Detection Diagnostic ===\n');

// 1. Profile System
console.log('Profile System:');
try {
    initProfiles();
    const profileDir = path.join(process.cwd(), 'data', '.browser-profiles');
    const profilesJson = path.join(profileDir, 'profiles.json');
    if (fs.existsSync(profilesJson)) {
        const profiles = JSON.parse(fs.readFileSync(profilesJson, 'utf8'));
        check('Profiles initialized', 'pass', `${profiles.length} profiles`);

        // Check behavioral params
        let withBehavior = 0;
        for (const p of profiles) {
            getProfileBehavior(p.id); // generates if missing
            if (p.behavior) withBehavior++;
        }
        // Re-read after generation
        const updated = JSON.parse(fs.readFileSync(profilesJson, 'utf8'));
        const allHaveBehavior = updated.every(p => p.behavior);
        check('Behavioral params', allHaveBehavior ? 'pass' : 'warn',
            allHaveBehavior ? 'All profiles have unique params' : `${withBehavior}/${profiles.length} have params`);

        // Check fingerprint configs
        let withFP = 0;
        for (const p of profiles) {
            const fpPath = path.join(getProfileDir(p.id), '.fingerprint-config.json');
            if (fs.existsSync(fpPath)) withFP++;
        }
        check('Fingerprint persistence', withFP > 0 ? 'pass' : 'warn',
            withFP > 0 ? `${withFP}/${profiles.length} profiles have saved configs` : 'No saved configs — run a session first');
    } else {
        check('Profiles initialized', 'fail', 'profiles.json not found');
    }
} catch (err) {
    check('Profile system', 'fail', err.message);
}

// 2. Profile Isolation
console.log('\nMulti-Account Isolation:');
const isolation = validateProfileIsolation();
if (isolation.warnings.length === 0) {
    check('Proxy isolation', 'pass', 'All profiles have unique proxies');
} else {
    for (const w of isolation.warnings) {
        const isCritical = w.includes('CRITICAL') || w.includes('No proxy');
        check('Isolation', isCritical ? 'fail' : 'warn', w);
    }
}

// 3. Rate Limits
console.log('\nRate Limits:');
const fb = RATE_LIMITS.facebook;
check('Max listings/day', fb.maxListingsPerDay <= 10 ? 'pass' : 'warn', `${fb.maxListingsPerDay}/day`);
check('Max logins/day', fb.maxLoginsPerDay <= 3 ? 'pass' : 'warn', `${fb.maxLoginsPerDay}/day`);
check('Action delay', fb.actionDelay >= 5000 ? 'pass' : 'warn', `${fb.actionDelay}ms`);
check('Listing delay', fb.listingDelay >= 8000 ? 'pass' : 'warn', `${fb.listingDelay}ms`);
check('Min account age', fb.minAccountAgeDays >= 3 ? 'pass' : 'warn', `${fb.minAccountAgeDays} days`);
check('Profile cooldown', fb.profileCooldown >= 3600000 ? 'pass' : 'warn', `${fb.profileCooldown / 60000}min`);

// 4. Environment
console.log('\nEnvironment:');
check('FACEBOOK_EMAIL', process.env.FACEBOOK_EMAIL ? 'pass' : 'warn', process.env.FACEBOOK_EMAIL ? 'set' : 'not set');
check('FACEBOOK_PASSWORD', process.env.FACEBOOK_PASSWORD ? 'pass' : 'warn', process.env.FACEBOOK_PASSWORD ? 'set (hidden)' : 'not set');

const proxyUrl = process.env.FACEBOOK_PROXY_URL;
check('FACEBOOK_PROXY_URL', proxyUrl ? 'pass' : 'warn', proxyUrl ? `${proxyUrl.slice(0, 20)}...` : 'not set — will use datacenter IP');

// Check per-profile proxy env vars
for (let i = 1; i <= 3; i++) {
    const envKey = `FACEBOOK_PROXY_URL_${i}`;
    const val = process.env[envKey];
    if (val) check(envKey, 'pass', `${val.slice(0, 20)}...`);
}

// 5. Cooldown Status
console.log('\nCooldown Status:');
const cooldownPath = path.join(process.cwd(), 'data', '.fb-cooldown.json');
if (fs.existsSync(cooldownPath)) {
    try {
        const cd = JSON.parse(fs.readFileSync(cooldownPath, 'utf8'));
        if (cd.quarantined) {
            check('Cooldown', 'fail', 'QUARANTINED — manual review required');
        } else if (cd.cooldownUntil && new Date(cd.cooldownUntil) > new Date()) {
            const hrs = Math.round((new Date(cd.cooldownUntil) - new Date()) / 3600000);
            check('Cooldown', 'warn', `Active — ${hrs}h remaining`);
        } else {
            check('Cooldown', 'pass', `Clear (${cd.events?.length || 0} events in last 7 days)`);
        }
    } catch {
        check('Cooldown', 'pass', 'No cooldown file');
    }
} else {
    check('Cooldown', 'pass', 'No cooldown file — clean');
}

// 6. Camoufox Check
console.log('\nCamoufox:');
try {
    const workerPkg = path.join(process.cwd(), 'worker', 'package.json');
    if (fs.existsSync(workerPkg)) {
        const pkg = JSON.parse(fs.readFileSync(workerPkg, 'utf8'));
        const version = pkg.dependencies?.['camoufox-js'] || pkg.devDependencies?.['camoufox-js'];
        check('camoufox-js', version ? 'pass' : 'warn', version || 'not in worker/package.json');
    }
} catch {}

// Summary
console.log(`\n=== Summary: ${passes} pass, ${warnings} warn, ${failures} fail ===\n`);
if (failures > 0) {
    console.log('Fix FAIL items before running automation against live platforms.');
} else if (warnings > 0) {
    console.log('Review WARN items — they may increase detection risk.');
} else {
    console.log('All checks passed. Configuration looks good.');
}

process.exit(failures > 0 ? 1 : 0);
