import { describe, test, expect } from 'bun:test';
import { initProfiles, getProfileDir, getProfileBehavior, getProfileProxy, setProfileProxy, cleanProfileServiceWorkers, validateProfileIsolation } from '../../worker/bots/browser-profiles.js';
import fs from 'fs';
import path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'data', '.browser-profiles');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');

describe('Per-Profile Proxy', () => {
    test('setProfileProxy persists and getProfileProxy retrieves', () => {
        initProfiles(3);
        setProfileProxy('profile-2', 'socks5://test:pass@proxy.example.com:1080');
        const proxy = getProfileProxy('profile-2');
        expect(proxy).toBe('socks5://test:pass@proxy.example.com:1080');
        setProfileProxy('profile-2', null); // cleanup
    });

    test('getProfileProxy falls back when no proxy set', () => {
        initProfiles(3);
        setProfileProxy('profile-1', null);
        const proxy = getProfileProxy('profile-1');
        // Falls back to env var or null
        expect(proxy === null || typeof proxy === 'string').toBe(true);
    });
});

describe('Service Worker Cleanup', () => {
    test('does not throw on clean profile', () => {
        initProfiles(3);
        expect(() => cleanProfileServiceWorkers('profile-1')).not.toThrow();
    });

    test('removes service_worker directory', () => {
        initProfiles(3);
        const swDir = path.join(getProfileDir('profile-1'), 'service_worker');
        fs.mkdirSync(swDir, { recursive: true });
        fs.writeFileSync(path.join(swDir, 'test.txt'), 'data');
        expect(fs.existsSync(swDir)).toBe(true);
        cleanProfileServiceWorkers('profile-1');
        expect(fs.existsSync(swDir)).toBe(false);
    });

    test('removes Favicons directory', () => {
        initProfiles(3);
        const favDir = path.join(getProfileDir('profile-1'), 'Favicons');
        fs.mkdirSync(favDir, { recursive: true });
        fs.writeFileSync(path.join(favDir, 'db'), 'data');
        cleanProfileServiceWorkers('profile-1');
        expect(fs.existsSync(favDir)).toBe(false);
    });
});

describe('Profile Isolation Validation', () => {
    test('warns when profiles share proxy', () => {
        initProfiles(3);
        setProfileProxy('profile-1', 'http://shared:8080');
        setProfileProxy('profile-2', 'http://shared:8080');
        const result = validateProfileIsolation();
        expect(result.warnings.some(w => w.includes('CRITICAL'))).toBe(true);
        setProfileProxy('profile-1', null);
        setProfileProxy('profile-2', null);
    });

    test('no warning with unique proxies', () => {
        initProfiles(3);
        setProfileProxy('profile-1', 'http://a:8080');
        setProfileProxy('profile-2', 'http://b:8080');
        setProfileProxy('profile-3', 'http://c:8080');
        const result = validateProfileIsolation();
        expect(result.warnings.some(w => w.includes('share proxy'))).toBe(false);
        setProfileProxy('profile-1', null);
        setProfileProxy('profile-2', null);
        setProfileProxy('profile-3', null);
    });
});

describe('Behavioral Params Uniqueness', () => {
    test('different profiles get different params', () => {
        initProfiles(3);
        const b1 = getProfileBehavior('profile-1');
        const b2 = getProfileBehavior('profile-2');
        const b3 = getProfileBehavior('profile-3');
        // At least 2 of 3 should have different typing means
        const means = [b1.typingSpeed.mean, b2.typingSpeed.mean, b3.typingSpeed.mean];
        const uniqueMeans = new Set(means);
        expect(uniqueMeans.size).toBeGreaterThanOrEqual(2);
    });

    test('same profile returns consistent params', () => {
        initProfiles(3);
        const a = getProfileBehavior('profile-1');
        const b = getProfileBehavior('profile-1');
        expect(a.typingSpeed.mean).toBe(b.typingSpeed.mean);
        expect(a.typoFrequency).toBe(b.typoFrequency);
        expect(a.mouseOvershoot).toBe(b.mouseOvershoot);
    });
});
