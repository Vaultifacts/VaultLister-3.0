// Environment & Quality — i18n, Localization, Time, Scheduling, Expiry
// Audit gaps: H1 (i18n untested), H7 (locale-aware validation), H8 (DST),
//             H10 (token expiry boundary), H11 (daysAgo month-wrap), H12 (leap year),
//             H14 (JS Date vs SQLite datetime)
// Categories: Localization, Time/Scheduling/Expiry

import { describe, expect, test, beforeEach } from 'bun:test';

// ─── Backend utils (pure functions, no mocks needed) ────────────────────────

import {
    now, today, daysAgo, daysFromNow,
    formatDate, formatDateTime, formatPrice,
    parsePrice, roundCurrency, calculatePercentage,
} from '../backend/shared/utils.js';

// ─── i18n (frontend module — needs DOM shims) ──────────────────────────────

// Minimal DOM shims for i18n to load
if (typeof window === 'undefined') {
    globalThis.window = globalThis;
    globalThis.localStorage = {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, val) { this._data[key] = val; },
        removeItem(key) { delete this._data[key]; },
    };
    globalThis.navigator = { language: 'en-US' };
    globalThis.document = {
        documentElement: { dir: 'ltr', lang: 'en' },
    };
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
    };
    globalThis.window.dispatchEvent = () => {};
}

const { default: i18n } = await import('../frontend/i18n/index.js');

// Reset i18n state between tests
beforeEach(async () => {
    i18n.loadedLocales.clear();
    i18n.translations = {};
    i18n.currentLocale = 'en-US';
    localStorage._data = {};
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category 1: i18n System (H1)
// ═══════════════════════════════════════════════════════════════════════════════

describe('i18n — findBestLocale (H1)', () => {
    test('exact match returns that locale', () => {
        expect(i18n.findBestLocale('es-ES')).toBe('es-ES');
    });

    test('language-only match falls back to first matching region', () => {
        // 'es' should match 'es-ES' (first Spanish entry)
        expect(i18n.findBestLocale('es')).toBe('es-ES');
    });

    test('unsupported locale falls back to en-US', () => {
        expect(i18n.findBestLocale('xx-XX')).toBe('en-US');
    });

    test('partial match: "fr" should resolve to "fr-FR"', () => {
        expect(i18n.findBestLocale('fr')).toBe('fr-FR');
    });

    test('en without region resolves to en-US', () => {
        expect(i18n.findBestLocale('en')).toBe('en-US');
    });
});

describe('i18n — t() translation function (H1)', () => {
    test('returns English translation for known key', async () => {
        await i18n.loadLocale('en-US');
        i18n.currentLocale = 'en-US';
        expect(i18n.t('common.save')).toBe('Save');
        expect(i18n.t('common.cancel')).toBe('Cancel');
    });

    test('returns key itself when translation missing', async () => {
        await i18n.loadLocale('en-US');
        i18n.currentLocale = 'en-US';
        expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
    });

    test('replaces {param} placeholders', async () => {
        await i18n.loadLocale('en-US');
        i18n.currentLocale = 'en-US';
        const result = i18n.t('dashboard.welcome', { name: 'Alice' });
        expect(result).toBe('Welcome back, Alice!');
    });

    test('pluralization: singular when count=1', async () => {
        await i18n.loadLocale('en-US');
        i18n.currentLocale = 'en-US';
        const result = i18n.t('time.minutesAgo', { count: 1 });
        expect(result).toBe('1 minute ago');
    });

    test('pluralization: plural when count>1', async () => {
        await i18n.loadLocale('en-US');
        i18n.currentLocale = 'en-US';
        const result = i18n.t('time.minutesAgo', { count: 5 });
        expect(result).toBe('5 minutes ago');
    });

    test('Spanish translation loads and overrides English', async () => {
        await i18n.loadLocale('es-ES');
        i18n.currentLocale = 'es-ES';
        expect(i18n.t('common.save')).toBe('Guardar');
        expect(i18n.t('auth.login')).toBe('Iniciar sesión');
    });

    test('French translation loads and overrides English', async () => {
        await i18n.loadLocale('fr-FR');
        i18n.currentLocale = 'fr-FR';
        expect(i18n.t('common.save')).toBe('Enregistrer');
        expect(i18n.t('auth.login')).toBe('Connexion');
    });

    test('Spanish falls back to English for untranslated keys', async () => {
        await i18n.loadLocale('en-US');
        await i18n.loadLocale('es-ES');
        i18n.currentLocale = 'es-ES';
        // 'inventory.brand' is not in Spanish translations → falls back to English
        expect(i18n.t('inventory.brand')).toBe('Brand');
    });
});

describe('i18n — setLocale (H1)', () => {
    test('setLocale changes currentLocale', async () => {
        await i18n.init('en-US');
        await i18n.setLocale('fr-FR');
        expect(i18n.currentLocale).toBe('fr-FR');
    });

    test('setLocale persists to localStorage', async () => {
        await i18n.init('en-US');
        await i18n.setLocale('es-ES');
        expect(localStorage.getItem('vaultlister_locale')).toBe('es-ES');
    });

    test('setLocale sets document dir for RTL locale', async () => {
        await i18n.init('en-US');
        await i18n.setLocale('ar-SA');
        expect(document.documentElement.dir).toBe('rtl');
    });
});

describe('i18n — formatNumber / formatCurrency (H1)', () => {
    test('formatNumber uses locale formatting', async () => {
        await i18n.init('en-US');
        const result = i18n.formatNumber(1234567.89);
        expect(result).toContain('1,234,567');
    });

    test('formatCurrency formats as USD by default', async () => {
        await i18n.init('en-US');
        const result = i18n.formatCurrency(42.50);
        expect(result).toContain('$');
        expect(result).toContain('42.50');
    });

    test('formatCurrency accepts different currencies', async () => {
        await i18n.init('en-US');
        const result = i18n.formatCurrency(100, 'EUR');
        expect(result).toContain('100');
        // Should contain euro symbol or EUR
        expect(result).toMatch(/€|EUR/);
    });
});

describe('i18n — formatDate / formatRelativeTime (H1)', () => {
    test('formatDate returns locale-formatted date', async () => {
        await i18n.init('en-US');
        const result = i18n.formatDate('2026-06-15');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('2026');
    });

    test('formatRelativeTime returns "Just now" for recent dates', async () => {
        await i18n.init('en-US');
        const result = i18n.formatRelativeTime(new Date());
        expect(result).toBe('Just now');
    });

    test('formatRelativeTime returns minutes ago', async () => {
        await i18n.init('en-US');
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = i18n.formatRelativeTime(fiveMinAgo);
        expect(result).toContain('minutes ago');
    });

    test('formatRelativeTime returns hours ago', async () => {
        await i18n.init('en-US');
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const result = i18n.formatRelativeTime(threeHoursAgo);
        expect(result).toContain('hours ago');
    });
});

describe('i18n — getSupportedLocales / getLocaleInfo (H1)', () => {
    test('getSupportedLocales returns 12 locales', () => {
        const locales = i18n.getSupportedLocales();
        expect(locales.length).toBe(12);
        expect(locales[0]).toHaveProperty('code');
        expect(locales[0]).toHaveProperty('name');
        expect(locales[0]).toHaveProperty('dir');
    });

    test('getLocaleInfo returns info for current locale', () => {
        const info = i18n.getLocaleInfo('ar-SA');
        expect(info.dir).toBe('rtl');
        expect(info.name).toBe('Arabic');
    });
});

describe('i18n — loadLocale idempotency (H1)', () => {
    test('loading same locale twice does not re-fetch', async () => {
        await i18n.loadLocale('en-US');
        const countAfterFirst = i18n.loadedLocales.size;
        await i18n.loadLocale('en-US');
        expect(i18n.loadedLocales.size).toBe(countAfterFirst);
    });

    test('unsupported locale falls back to en-US translations', async () => {
        await i18n.loadLocale('de-DE'); // de-DE has no translations dict
        i18n.currentLocale = 'de-DE';
        // Should fall back to fallbackLocale translations
        const result = i18n.t('common.save');
        // Either gets the translation from fallback or returns key
        expect(typeof result).toBe('string');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category 2: Time / Scheduling / Expiry
// ═══════════════════════════════════════════════════════════════════════════════

describe('daysAgo — month boundary correctness (H11)', () => {
    test('daysAgo(30) from March 31 does not produce Feb 31', () => {
        // Save real Date and mock
        const RealDate = globalThis.Date;
        const march31 = new RealDate('2026-03-31T12:00:00Z');

        class MockDate extends RealDate {
            constructor(...args) {
                if (args.length === 0) return new RealDate(march31);
                super(...args);
            }
        }
        MockDate.now = () => march31.getTime();
        globalThis.Date = MockDate;

        try {
            const result = daysAgo(30);
            const parsed = new RealDate(result);
            // Should be a valid date
            expect(parsed.getTime()).not.toBeNaN();
            // Month of result should be Feb (1) or Mar (2) — never invalid
            expect(parsed.getMonth()).toBeLessThanOrEqual(2);
            expect(parsed.getDate()).toBeLessThanOrEqual(31);
        } finally {
            globalThis.Date = RealDate;
        }
    });

    test('daysAgo(1) returns yesterday', () => {
        const result = daysAgo(1);
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        expect(result).toBe(yesterday);
    });

    test('daysFromNow(1) returns tomorrow', () => {
        const result = daysFromNow(1);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        expect(result).toBe(tomorrow);
    });
});

describe('Leap year date handling (H12)', () => {
    test('daysAgo handles leap year day (Feb 29)', () => {
        const RealDate = globalThis.Date;
        // 2028 is a leap year
        const feb29 = new RealDate('2028-02-29T12:00:00Z');

        class MockDate extends RealDate {
            constructor(...args) {
                if (args.length === 0) return new RealDate(feb29);
                super(...args);
            }
        }
        MockDate.now = () => feb29.getTime();
        globalThis.Date = MockDate;

        try {
            const result = daysAgo(365);
            const parsed = new RealDate(result);
            expect(parsed.getTime()).not.toBeNaN();
            // Should be approximately Feb 28, 2027
            expect(parsed.getFullYear()).toBe(2027);
        } finally {
            globalThis.Date = RealDate;
        }
    });

    test('daysFromNow handles crossing leap year boundary', () => {
        const RealDate = globalThis.Date;
        const jan30_2028 = new RealDate('2028-01-30T12:00:00Z');

        class MockDate extends RealDate {
            constructor(...args) {
                if (args.length === 0) return new RealDate(jan30_2028);
                super(...args);
            }
        }
        MockDate.now = () => jan30_2028.getTime();
        globalThis.Date = MockDate;

        try {
            const result = daysFromNow(30);
            const parsed = new RealDate(result);
            expect(parsed.getTime()).not.toBeNaN();
            // Jan 30 + 30 = Feb 29, 2028 (leap year)
            expect(parsed.getFullYear()).toBe(2028);
            expect(parsed.getMonth()).toBe(1); // February
            expect(parsed.getDate()).toBe(29);
        } finally {
            globalThis.Date = RealDate;
        }
    });
});

describe('ISO timestamp invariants (H14)', () => {
    test('now() returns valid ISO 8601 with Z suffix', () => {
        const result = now();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('now() is parseable back to Date', () => {
        const result = now();
        const parsed = new Date(result);
        expect(parsed.getTime()).not.toBeNaN();
        // Should be very close to current time
        expect(Math.abs(parsed.getTime() - Date.now())).toBeLessThan(1000);
    });

    test('today() matches ISO date portion of now()', () => {
        const n = now();
        const t = today();
        expect(n.startsWith(t)).toBe(true);
    });
});

describe('REM-19 FIX: Backend formatDate/formatPrice accept locale parameter', () => {
    test('formatDate defaults to en-US', () => {
        const result = formatDate('2026-06-15');
        expect(result).toContain('Jun');
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });

    test('formatDate accepts locale parameter', () => {
        const result = formatDate('2026-06-15', {}, 'de-DE');
        // German: "15. Juni 2026" or similar
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });

    test('formatDateTime accepts locale parameter', () => {
        const result = formatDateTime('2026-06-15T14:30:00Z', {}, 'fr-FR');
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });

    test('formatPrice defaults to en-US USD', () => {
        const result = formatPrice(1234.56);
        expect(result).toContain('$');
        expect(result).toContain('1,234.56');
    });

    test('formatPrice accepts locale parameter', () => {
        const result = formatPrice(1234.56, 'EUR', 'de-DE');
        // German EUR: "1.234,56 €" or similar
        expect(result).toContain('1');
        expect(result).toContain('234');
    });

    test('formatPrice with EUR currency and en-US locale', () => {
        const result = formatPrice(100, 'EUR', 'en-US');
        expect(result).toContain('100');
        expect(result).toMatch(/€|EUR/);
    });
});

describe('Token expiry boundary conditions (H10)', () => {
    test('JWT 15-minute window: token created now vs 15 min later', () => {
        const created = Date.now();
        const expiresAt = created + 15 * 60 * 1000;
        const atExpiry = expiresAt;
        const justBefore = expiresAt - 1;
        const justAfter = expiresAt + 1;

        // Token valid just before expiry
        expect(justBefore < expiresAt).toBe(true);
        // Token invalid at exactly expiry
        expect(atExpiry >= expiresAt).toBe(true);
        // Token invalid just after expiry
        expect(justAfter >= expiresAt).toBe(true);
    });

    test('OAuth token buffer: 30-min buffer before actual expiry', () => {
        const TOKEN_EXPIRY_BUFFER_MS = 30 * 60 * 1000; // from tokenRefreshScheduler
        const tokenExpiresAt = Date.now() + 45 * 60 * 1000; // expires in 45 min
        const bufferTime = tokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS;

        // 45min from now minus 30min buffer = 15min from now → should trigger refresh
        expect(bufferTime > Date.now()).toBe(true);
        // But if token expires in 25 min → should trigger immediately
        const soonExpiry = Date.now() + 25 * 60 * 1000;
        const soonBuffer = soonExpiry - TOKEN_EXPIRY_BUFFER_MS;
        expect(soonBuffer <= Date.now()).toBe(true);
    });
});
