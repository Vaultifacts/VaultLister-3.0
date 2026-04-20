import { describe, test, expect, beforeEach } from 'bun:test';
import { isNighttime, acquirePlatformLock, releasePlatformLock, isPlatformCooldownActive, preBotSafetyCheck } from '../../worker/bots/bot-safety.js';
import { getProfileBehavior, validateProfileIsolation, initProfiles } from '../../worker/bots/browser-profiles.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function cleanLocks(platform) {
    try { fs.unlinkSync(path.join(DATA_DIR, `.${platform}-session.lock`)); } catch {}
    try { fs.unlinkSync(path.join(DATA_DIR, `.${platform}-session.lock.last`)); } catch {}
}

describe('isNighttime', () => {
    test('should return a boolean', () => {
        expect(typeof isNighttime()).toBe('boolean');
    });
});

describe('Platform Session Lock', () => {
    beforeEach(() => cleanLocks('test-platform'));

    test('should acquire lock when none exists', () => {
        expect(acquirePlatformLock('test-platform')).toBe(true);
        releasePlatformLock('test-platform');
    });

    test('should fail to acquire when lock exists', () => {
        expect(acquirePlatformLock('test-platform')).toBe(true);
        expect(acquirePlatformLock('test-platform')).toBe(false);
        releasePlatformLock('test-platform');
    });

    test('should release lock and create .last file', () => {
        acquirePlatformLock('test-platform');
        releasePlatformLock('test-platform');
        const lockPath = path.join(DATA_DIR, '.test-platform-session.lock');
        const lastPath = lockPath + '.last';
        expect(fs.existsSync(lockPath)).toBe(false);
        expect(fs.existsSync(lastPath)).toBe(true);
        const data = JSON.parse(fs.readFileSync(lastPath, 'utf8'));
        expect(data.endedAt).toBeDefined();
        fs.unlinkSync(lastPath);
    });

    test('should auto-release stale locks (>30 min)', () => {
        const lockPath = path.join(DATA_DIR, '.test-platform-session.lock');
        const staleTs = new Date(Date.now() - 31 * 60 * 1000).toISOString();
        fs.writeFileSync(lockPath, JSON.stringify({ ts: staleTs, pid: 99999 }), 'utf8');
        expect(acquirePlatformLock('test-platform')).toBe(true);
        releasePlatformLock('test-platform');
    });

    test('should isolate locks between platforms', () => {
        cleanLocks('platform-a');
        cleanLocks('platform-b');
        expect(acquirePlatformLock('platform-a')).toBe(true);
        expect(acquirePlatformLock('platform-b')).toBe(true);
        releasePlatformLock('platform-a');
        releasePlatformLock('platform-b');
    });
});

describe('Platform Cooldown', () => {
    beforeEach(() => cleanLocks('test-cooldown'));

    test('should not be active when no last session', () => {
        expect(isPlatformCooldownActive('test-cooldown', 60000)).toBe(false);
    });

    test('should be active immediately after session end', () => {
        acquirePlatformLock('test-cooldown');
        releasePlatformLock('test-cooldown');
        expect(isPlatformCooldownActive('test-cooldown', 60000)).toBe(true);
        cleanLocks('test-cooldown');
    });

    test('should not be active after cooldown expires', () => {
        const lastPath = path.join(DATA_DIR, '.test-cooldown-session.lock.last');
        fs.writeFileSync(lastPath, JSON.stringify({ endedAt: new Date(Date.now() - 120000).toISOString() }), 'utf8');
        expect(isPlatformCooldownActive('test-cooldown', 60000)).toBe(false);
        cleanLocks('test-cooldown');
    });
});

describe('preBotSafetyCheck', () => {
    beforeEach(() => cleanLocks('test-safety'));

    test('should pass when no blockers', () => {
        // Only fails if nighttime — can't control clock, but we can test the shape
        const result = preBotSafetyCheck('test-safety', { sessionCooldownMs: 0 });
        if (isNighttime()) {
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('Nighttime');
        } else {
            expect(result.safe).toBe(true);
            expect(result.reason).toBeNull();
        }
        releasePlatformLock('test-safety');
    });

    test('should fail when session lock held', () => {
        acquirePlatformLock('test-safety');
        const result = preBotSafetyCheck('test-safety', { sessionCooldownMs: 0 });
        if (!isNighttime()) {
            expect(result.safe).toBe(false);
            expect(result.reason).toContain('already running');
        }
        releasePlatformLock('test-safety');
    });
});

describe('Profile Behavioral Params', () => {
    test('should generate params with expected shape', () => {
        initProfiles();
        const behavior = getProfileBehavior('profile-1');
        expect(behavior.typingSpeed).toBeDefined();
        expect(behavior.typingSpeed.mean).toBeGreaterThan(0);
        expect(behavior.typingSpeed.stddev).toBeGreaterThan(0);
        expect(behavior.interFieldPause).toBeDefined();
        expect(behavior.mouseOvershoot).toBeGreaterThan(0);
        expect(behavior.typoFrequency).toBeGreaterThanOrEqual(0);
        expect(behavior.typoCorrectionDelay).toBeGreaterThan(0);
        expect(behavior.hoverDwell).toBeDefined();
        expect(behavior.scrollChunkSize).toBeDefined();
    });

    test('should return consistent params for same profile', () => {
        const b1 = getProfileBehavior('profile-1');
        const b2 = getProfileBehavior('profile-1');
        expect(b1.typingSpeed.mean).toBe(b2.typingSpeed.mean);
        expect(b1.mouseOvershoot).toBe(b2.mouseOvershoot);
    });

    test('should return different params for different profiles', () => {
        initProfiles(3);
        const b1 = getProfileBehavior('profile-1');
        const b2 = getProfileBehavior('profile-2');
        // At least one param should differ (probabilistically certain)
        const same = b1.typingSpeed.mean === b2.typingSpeed.mean
            && b1.mouseOvershoot === b2.mouseOvershoot
            && b1.typoFrequency === b2.typoFrequency;
        expect(same).toBe(false);
    });
});

describe('Profile Isolation Validation', () => {
    test('should return warnings array', () => {
        initProfiles();
        const result = validateProfileIsolation();
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    test('should warn about missing proxies', () => {
        initProfiles();
        const result = validateProfileIsolation();
        // In dev, no proxies are set — should warn
        const hasProxyWarning = result.warnings.some(w => w.includes('No proxy') || w.includes('share proxy'));
        expect(hasProxyWarning).toBe(true);
    });
});
