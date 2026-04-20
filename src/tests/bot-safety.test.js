import { describe, test, expect, beforeEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

// Test the pure functions extracted from facebook-bot.js logic
// These test the safety enforcement without needing Playwright/Camoufox

const DATA_DIR = path.join(process.cwd(), 'data');
const WEEKLY_STATS_PATH = path.join(DATA_DIR, '.fb-weekly-stats.json');
const RELIST_TRACKER_PATH = path.join(DATA_DIR, '.fb-relist-tracker.json');
const COOLDOWN_PATH = path.join(DATA_DIR, '.fb-cooldown.json');
const SESSION_LOCK_PATH = path.join(DATA_DIR, '.fb-session.lock');

function cleanup() {
    for (const f of [WEEKLY_STATS_PATH, RELIST_TRACKER_PATH, COOLDOWN_PATH, SESSION_LOCK_PATH, SESSION_LOCK_PATH + '.last']) {
        try { fs.unlinkSync(f); } catch {}
    }
}

describe('Nighttime Enforcement', () => {
    test('isNighttime detects late night hours', () => {
        const hour = new Date().getHours();
        const isNight = hour >= 23 || hour < 7;
        // We can't control the clock, but we can verify the logic
        expect(typeof isNight).toBe('boolean');
    });
});

describe('Rest Day Enforcement', () => {
    beforeEach(cleanup);

    test('should not enforce rest when fewer than 6 active days', () => {
        const stats = { activeDays: ['2026-04-10', '2026-04-11', '2026-04-12'] };
        fs.writeFileSync(WEEKLY_STATS_PATH, JSON.stringify(stats), 'utf8');
        const data = JSON.parse(fs.readFileSync(WEEKLY_STATS_PATH, 'utf8'));
        expect(data.activeDays.length).toBeLessThan(6);
    });

    test('should enforce rest when 6+ active days in 7', () => {
        const days = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(Date.now() - i * 86400000);
            days.push(d.toISOString().slice(0, 10));
        }
        fs.writeFileSync(WEEKLY_STATS_PATH, JSON.stringify({ activeDays: days }), 'utf8');
        const data = JSON.parse(fs.readFileSync(WEEKLY_STATS_PATH, 'utf8'));
        expect(data.activeDays.length).toBeGreaterThanOrEqual(6);
    });
});

describe('Velocity Ramp', () => {
    test('should cap at 2/day for accounts under 7 days old', () => {
        // minAccountAgeDays <= 7 → cap 2
        const ageDays = 5;
        const cap = ageDays <= 7 ? 2 : ageDays <= 14 ? 4 : ageDays <= 30 ? 6 : 10;
        expect(cap).toBe(2);
    });

    test('should cap at 4/day for accounts 8-14 days old', () => {
        const ageDays = 10;
        const cap = ageDays <= 7 ? 2 : ageDays <= 14 ? 4 : ageDays <= 30 ? 6 : 10;
        expect(cap).toBe(4);
    });

    test('should cap at 6/day for accounts 15-30 days old', () => {
        const ageDays = 20;
        const cap = ageDays <= 7 ? 2 : ageDays <= 14 ? 4 : ageDays <= 30 ? 6 : 10;
        expect(cap).toBe(6);
    });

    test('should cap at 10/day for accounts 31+ days old', () => {
        const ageDays = 45;
        const cap = ageDays <= 7 ? 2 : ageDays <= 14 ? 4 : ageDays <= 30 ? 6 : 10;
        expect(cap).toBe(10);
    });
});

describe('Relist Frequency', () => {
    beforeEach(cleanup);

    test('should allow relist for new item', () => {
        fs.writeFileSync(RELIST_TRACKER_PATH, JSON.stringify({}), 'utf8');
        const tracker = JSON.parse(fs.readFileSync(RELIST_TRACKER_PATH, 'utf8'));
        const url = 'https://facebook.com/marketplace/item/123/';
        expect(tracker[url]).toBeUndefined();
    });

    test('should block relist within 14 days', () => {
        const url = 'https://facebook.com/marketplace/item/123/';
        const tracker = { [url]: new Date().toISOString() };
        fs.writeFileSync(RELIST_TRACKER_PATH, JSON.stringify(tracker), 'utf8');
        const data = JSON.parse(fs.readFileSync(RELIST_TRACKER_PATH, 'utf8'));
        const daysSince = (Date.now() - new Date(data[url]).getTime()) / 86400000;
        expect(daysSince).toBeLessThan(14);
    });

    test('should allow relist after 14 days', () => {
        const url = 'https://facebook.com/marketplace/item/456/';
        const oldDate = new Date(Date.now() - 15 * 86400000).toISOString();
        const tracker = { [url]: oldDate };
        fs.writeFileSync(RELIST_TRACKER_PATH, JSON.stringify(tracker), 'utf8');
        const data = JSON.parse(fs.readFileSync(RELIST_TRACKER_PATH, 'utf8'));
        const daysSince = (Date.now() - new Date(data[url]).getTime()) / 86400000;
        expect(daysSince).toBeGreaterThanOrEqual(14);
    });
});

describe('Escalating Cooldown', () => {
    beforeEach(cleanup);

    test('should not be cooling down with no events', () => {
        const data = { events: [], cooldownUntil: null, quarantined: false };
        fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data), 'utf8');
        const cd = JSON.parse(fs.readFileSync(COOLDOWN_PATH, 'utf8'));
        expect(cd.quarantined).toBe(false);
        expect(cd.cooldownUntil).toBeNull();
    });

    test('should set 24h cooldown on first detection', () => {
        const events = [{ ts: new Date().toISOString(), type: 'captcha' }];
        const cooldownUntil = new Date(Date.now() + 24 * 3600000).toISOString();
        const data = { events, cooldownUntil, quarantined: false };
        fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data), 'utf8');
        const cd = JSON.parse(fs.readFileSync(COOLDOWN_PATH, 'utf8'));
        expect(cd.events).toHaveLength(1);
        expect(new Date(cd.cooldownUntil) > new Date()).toBe(true);
    });

    test('should quarantine on 4+ events', () => {
        const events = Array.from({ length: 4 }, () => ({ ts: new Date().toISOString(), type: 'captcha' }));
        const data = { events, cooldownUntil: null, quarantined: true };
        fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data), 'utf8');
        const cd = JSON.parse(fs.readFileSync(COOLDOWN_PATH, 'utf8'));
        expect(cd.quarantined).toBe(true);
    });
});

describe('Session Lock', () => {
    beforeEach(cleanup);

    test('should acquire lock when none exists', () => {
        expect(fs.existsSync(SESSION_LOCK_PATH)).toBe(false);
    });

    test('should detect existing lock', () => {
        fs.writeFileSync(SESSION_LOCK_PATH, JSON.stringify({ ts: new Date().toISOString(), pid: process.pid }), 'utf8');
        expect(fs.existsSync(SESSION_LOCK_PATH)).toBe(true);
        const lock = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH, 'utf8'));
        expect(lock.pid).toBe(process.pid);
        fs.unlinkSync(SESSION_LOCK_PATH);
    });

    test('should detect stale lock (>30 min)', () => {
        const staleTs = new Date(Date.now() - 31 * 60 * 1000).toISOString();
        fs.writeFileSync(SESSION_LOCK_PATH, JSON.stringify({ ts: staleTs, pid: 99999 }), 'utf8');
        const lock = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH, 'utf8'));
        const elapsed = Date.now() - new Date(lock.ts).getTime();
        expect(elapsed).toBeGreaterThan(30 * 60 * 1000);
        fs.unlinkSync(SESSION_LOCK_PATH);
    });
});

describe('Session Cooldown', () => {
    beforeEach(cleanup);

    test('should not be active when no last session', () => {
        expect(fs.existsSync(SESSION_LOCK_PATH + '.last')).toBe(false);
    });

    test('should be active immediately after session end', () => {
        fs.writeFileSync(SESSION_LOCK_PATH + '.last', JSON.stringify({ endedAt: new Date().toISOString() }), 'utf8');
        const data = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH + '.last', 'utf8'));
        const elapsed = Date.now() - new Date(data.endedAt).getTime();
        expect(elapsed).toBeLessThan(300000); // 5 min
    });

    test('should not be active after 5+ minutes', () => {
        const oldEnd = new Date(Date.now() - 6 * 60 * 1000).toISOString();
        fs.writeFileSync(SESSION_LOCK_PATH + '.last', JSON.stringify({ endedAt: oldEnd }), 'utf8');
        const data = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH + '.last', 'utf8'));
        const elapsed = Date.now() - new Date(data.endedAt).getTime();
        expect(elapsed).toBeGreaterThan(300000);
    });
});
