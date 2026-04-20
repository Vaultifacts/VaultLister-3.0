// Generalized per-platform adaptive rate control.
// Extracted from facebook-bot.js (file-based state). New platforms opt in by importing.
//
// State files per platform (`data/`):
//   .{platform}-cooldown.json          — detection events + quarantine + cooldownUntil
//   .{platform}-daily-stats.json       — daily action counters
//   .{platform}-weekly-stats.json      — 7-day activity for rest-day enforcement
//   .{platform}-relist-tracker.json    — per-item last-action timestamps
//
// Facebook legacy paths (.fb-*.json) are preserved via a platform-specific alias map.

import fs from 'fs';
import path from 'path';
import {
    computeAnomalyScore,
    scoreToCooldownState,
    shouldForcePause,
    computeWarmupFactor,
    computeEffectiveRate
} from './anomaly-scorer.js';
import { isValidSignalType, SIGNAL_TYPES } from './signal-contracts.js';
import { PLATFORM_PROFILES } from './platform-profiles.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_LOG = path.join(DATA_DIR, 'automation-audit.log');

// Preserve existing Facebook file-path convention to avoid state loss on upgrade.
const LEGACY_PATH_ALIASES = {
    facebook: {
        cooldown: '.fb-cooldown.json',
        daily: '.fb-daily-stats.json',
        weekly: '.fb-weekly-stats.json',
        relist: '.fb-relist-tracker.json'
    }
};

function statePath(platform, kind) {
    const alias = LEGACY_PATH_ALIASES[platform]?.[kind];
    const name = alias || `.${platform}-${kind}.json`;
    return path.join(DATA_DIR, name);
}

function writeAuditLog(platform, event, metadata = {}) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const entry = JSON.stringify({ ts: new Date().toISOString(), platform, event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch {}
}

function readJsonSafe(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch {}
    return fallback;
}

function writeJsonSafe(filePath, data) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch {
        return false;
    }
}

// --- Cooldown state ---------------------------------------------------------

// Normalize legacy ISO-string timestamps (Facebook's original format) to numeric ms.
function normalizeCooldown(data) {
    if (!data) return { events: [], cooldownUntil: null, quarantined: false };
    if (Array.isArray(data.events)) {
        data.events = data.events.map(e => {
            if (e && typeof e.ts === 'string') {
                const parsed = Date.parse(e.ts);
                return Number.isFinite(parsed) ? { ...e, ts: parsed } : e;
            }
            return e;
        }).filter(e => e && Number.isFinite(e.ts));
    } else {
        data.events = [];
    }
    return data;
}

export function readCooldown(platform) {
    const raw = readJsonSafe(statePath(platform, 'cooldown'), {
        events: [],
        cooldownUntil: null,
        quarantined: false
    });
    return normalizeCooldown(raw);
}

export function writeCooldown(platform, data) {
    return writeJsonSafe(statePath(platform, 'cooldown'), data);
}

// Record a detection event and advance the policy state machine.
// Uses score-driven model as source of truth; hard overrides force immediate quarantine/pause.
export function recordDetectionEvent(platform, type, details = {}) {
    if (!isValidSignalType(type)) {
        throw new Error(`[adaptive-rate-control] Unknown signal type: ${type}`);
    }
    const data = readCooldown(platform);
    const now = Date.now();

    data.events.push({ ts: now, type, ...details });

    // Retain 7 days of history
    const cutoff = now - 7 * 86400000;
    data.events = data.events.filter(e => e.ts >= cutoff);

    const inCooldown =
        data.cooldownUntil !== null &&
        data.cooldownUntil !== undefined &&
        new Date(data.cooldownUntil).getTime() > now;

    const force = shouldForcePause(data.events, now, { inCooldown });
    if (force.pause) {
        data.quarantined = true;
        data.cooldownUntil = null;
        data.forceReason = force.reason;
        writeCooldown(platform, data);
        writeAuditLog(platform, 'quarantine_forced', { type, reason: force.reason });
        return data;
    }

    const score = computeAnomalyScore(data.events, now);
    const decision = scoreToCooldownState(score);
    data.lastScore = score;
    data.state = decision.state;

    if (decision.state === 'quarantine') {
        data.quarantined = true;
        data.cooldownUntil = null;
    } else if (decision.cooldownHours > 0) {
        data.cooldownUntil = new Date(now + decision.cooldownHours * 3600000).toISOString();
    } else {
        // 'normal' or 'reduced' — no cooldown imposed by score alone
        data.cooldownUntil = null;
    }

    writeCooldown(platform, data);
    writeAuditLog(platform, 'detection_cooldown', {
        type,
        score,
        state: decision.state,
        cooldownUntil: data.cooldownUntil,
        quarantined: data.quarantined
    });
    return data;
}

export function isCoolingDown(platform) {
    const data = readCooldown(platform);
    if (data.quarantined) return { cooling: true, reason: 'quarantined' };
    if (data.cooldownUntil && new Date(data.cooldownUntil).getTime() > Date.now()) {
        const remainingMs = new Date(data.cooldownUntil).getTime() - Date.now();
        return { cooling: true, reason: 'cooldown', remainingMs };
    }
    return { cooling: false, reason: null };
}

export function checkQuarantine(platform) {
    return readCooldown(platform).quarantined === true;
}

// Manual reset — used by admin tooling after review
export function clearCooldown(platform) {
    const cleared = { events: [], cooldownUntil: null, quarantined: false };
    writeCooldown(platform, cleared);
    writeAuditLog(platform, 'cooldown_cleared', {});
    return cleared;
}

// --- Warmup + effective rate -----------------------------------------------

export function getAccountAgeDayLimit(platform, accountAgeDays) {
    const factor = computeWarmupFactor(accountAgeDays);
    // Pull normal rate from platform-profiles via computeEffectiveRate indirection;
    // callers that just want the raw cap can call computeEffectiveRate directly.
    return { factor };
}

export function effectiveRate(platform, accountAgeDays) {
    const events = readCooldown(platform).events || [];
    return computeEffectiveRate(platform, accountAgeDays, events);
}

// --- Relist / bump tracker (per-item timestamps) ---------------------------

export function readRelistTracker(platform) {
    return readJsonSafe(statePath(platform, 'relist'), {});
}

export function writeRelistTracker(platform, tracker) {
    return writeJsonSafe(statePath(platform, 'relist'), tracker);
}

// Returns true if `itemKey` can be acted on again (minimum `windowDays` since last action).
export function canActOnItem(platform, itemKey, windowDays) {
    const tracker = readRelistTracker(platform);
    const last = tracker[itemKey];
    if (!last) return true;
    const daysSince = (Date.now() - new Date(last).getTime()) / 86400000;
    return daysSince >= windowDays;
}

export function recordItemAction(platform, itemKey, opts = {}) {
    const pruneAfterDays = opts.pruneAfterDays ?? 30;
    const tracker = readRelistTracker(platform);
    tracker[itemKey] = new Date().toISOString();

    const cutoff = Date.now() - pruneAfterDays * 86400000;
    for (const key of Object.keys(tracker)) {
        if (new Date(tracker[key]).getTime() < cutoff) delete tracker[key];
    }
    writeRelistTracker(platform, tracker);
    return tracker[itemKey];
}

// --- Daily / weekly stats --------------------------------------------------

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

export function readDailyStats(platform) {
    const stats = readJsonSafe(statePath(platform, 'daily'), null);
    if (stats && stats.date === getTodayKey()) return stats;
    return { date: getTodayKey(), logins: 0, listings: 0, relists: 0, actions: 0 };
}

export function writeDailyStats(platform, stats) {
    return writeJsonSafe(statePath(platform, 'daily'), stats);
}

export function readWeeklyStats(platform) {
    const stats = readJsonSafe(statePath(platform, 'weekly'), { activeDays: [] });
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    stats.activeDays = (stats.activeDays || []).filter(d => d >= cutoff);
    return stats;
}

export function writeWeeklyStats(platform, stats) {
    return writeJsonSafe(statePath(platform, 'weekly'), stats);
}

export function recordActiveDay(platform) {
    const stats = readWeeklyStats(platform);
    const today = getTodayKey();
    if (!stats.activeDays.includes(today)) stats.activeDays.push(today);
    writeWeeklyStats(platform, stats);
    return stats;
}

// 6-of-7 active days triggers a forced rest day
export function isRestDayNeeded(platform) {
    const stats = readWeeklyStats(platform);
    return (stats.activeDays || []).length >= 6;
}

// --- Diagnostics -----------------------------------------------------------

export function getStateSnapshot(platform) {
    return {
        cooldown: readCooldown(platform),
        daily: readDailyStats(platform),
        weekly: readWeeklyStats(platform),
        inCooldown: isCoolingDown(platform)
    };
}

// Per-platform soak-phase view.
// Returns { platform, score, state, cooldownUntil, quarantined, events_24h_by_type, events_7d_total }.
export function getPlatformMetrics(platform) {
    const data = readCooldown(platform);
    const now = Date.now();
    const events = data.events || [];

    const dayAgo = now - 24 * 3600 * 1000;
    const eventsLast24h = events.filter(e => e.ts >= dayAgo);
    const events_24h_by_type = {};
    for (const t of Object.values(SIGNAL_TYPES)) events_24h_by_type[t] = 0;
    for (const e of eventsLast24h) {
        if (events_24h_by_type[e.type] !== undefined) events_24h_by_type[e.type]++;
    }

    const score = computeAnomalyScore(events, now);
    const decision = scoreToCooldownState(score);

    return {
        platform,
        score: Number(score.toFixed(3)),
        state: data.quarantined ? 'quarantine' : decision.state,
        cooldownUntil: data.cooldownUntil || null,
        quarantined: !!data.quarantined,
        forceReason: data.forceReason || null,
        events_24h_by_type,
        events_7d_total: events.length
    };
}

// Aggregate across all platforms defined in platform-profiles.
// Returns { platforms: [...], totals: { quarantine_count, events_24h_total, events_7d_total } }.
export function getAllPlatformsMetrics() {
    const platforms = Object.keys(PLATFORM_PROFILES).map(getPlatformMetrics);
    const totals = {
        quarantine_count: platforms.filter(p => p.quarantined).length,
        events_24h_total: platforms.reduce(
            (sum, p) => sum + Object.values(p.events_24h_by_type).reduce((a, b) => a + b, 0),
            0
        ),
        events_7d_total: platforms.reduce((sum, p) => sum + p.events_7d_total, 0)
    };
    return { platforms, totals };
}

export { writeAuditLog };
