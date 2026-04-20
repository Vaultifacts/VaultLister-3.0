// Unit tests for the adaptive rate control foundation (Tier 1 — Gaps 1, 2, 4.5).
// Focus: pure scoring model, warmup curve, hard overrides, file persistence roundtrip.

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';

import {
    computeAnomalyScore,
    decayedWeight,
    collapseBursts,
    computeWarmupFactor,
    anomalyDampeningFactor,
    scoreToCooldownState,
    shouldForcePause,
    computeEffectiveRate
} from './anomaly-scorer.js';
import {
    SIGNAL_TYPES,
    SIGNAL_WEIGHTS,
    HIGH_CONFIDENCE_SIGNALS,
    LOW_CONFIDENCE_SIGNALS,
    isValidSignalType
} from './signal-contracts.js';
import {
    PLATFORM_PROFILES,
    getPlatformProfile,
    hasPlatformProfile,
    pickSessionDurationMs
} from './platform-profiles.js';
import {
    recordDetectionEvent,
    readCooldown,
    writeCooldown,
    isCoolingDown,
    clearCooldown,
    canActOnItem,
    recordItemAction,
    readRelistTracker,
    writeRelistTracker,
    checkQuarantine
} from './adaptive-rate-control.js';

const TEST_PLATFORM = 'poshmark';
const DATA_DIR = path.join(process.cwd(), 'data');

function cleanState(platform) {
    const paths = [
        path.join(DATA_DIR, `.${platform}-cooldown.json`),
        path.join(DATA_DIR, `.${platform}-relist.json`)
    ];
    for (const p of paths) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
}

// ----------------------------------------------------------------------------
// signal-contracts
// ----------------------------------------------------------------------------

describe('signal-contracts', () => {
    test('SIGNAL_WEIGHTS defines weight for every SIGNAL_TYPES value', () => {
        for (const type of Object.values(SIGNAL_TYPES)) {
            expect(SIGNAL_WEIGHTS[type]).toBeGreaterThan(0);
        }
    });

    test('HIGH_CONFIDENCE covers captcha, lockout, login_challenge', () => {
        expect(HIGH_CONFIDENCE_SIGNALS.has(SIGNAL_TYPES.CAPTCHA)).toBe(true);
        expect(HIGH_CONFIDENCE_SIGNALS.has(SIGNAL_TYPES.LOCKOUT)).toBe(true);
        expect(HIGH_CONFIDENCE_SIGNALS.has(SIGNAL_TYPES.LOGIN_CHALLENGE)).toBe(true);
    });

    test('LOW_CONFIDENCE covers listing_invisible, engagement_drop', () => {
        expect(LOW_CONFIDENCE_SIGNALS.has(SIGNAL_TYPES.LISTING_INVISIBLE)).toBe(true);
        expect(LOW_CONFIDENCE_SIGNALS.has(SIGNAL_TYPES.ENGAGEMENT_DROP)).toBe(true);
    });

    test('isValidSignalType rejects unknown types', () => {
        expect(isValidSignalType('captcha')).toBe(true);
        expect(isValidSignalType('not_a_signal')).toBe(false);
    });
});

// ----------------------------------------------------------------------------
// platform-profiles
// ----------------------------------------------------------------------------

describe('platform-profiles', () => {
    test('7 platforms defined with full envelope schema', () => {
        const platforms = ['poshmark', 'mercari', 'depop', 'grailed', 'facebook', 'whatnot', 'ebay'];
        for (const p of platforms) {
            expect(hasPlatformProfile(p)).toBe(true);
            const profile = getPlatformProfile(p);
            expect(profile.maxActionsPerHour.normal).toBeGreaterThan(0);
            expect(profile.sessionLengthMinMs).toBeGreaterThan(0);
            expect(profile.sessionLengthMaxMs).toBeGreaterThanOrEqual(profile.sessionLengthMinMs);
        }
    });

    test('getPlatformProfile throws on unknown platform', () => {
        expect(() => getPlatformProfile('unknown_platform')).toThrow();
    });

    test('pickSessionDurationMs lies inside profile envelope', () => {
        const profile = getPlatformProfile('poshmark');
        for (let i = 0; i < 50; i++) {
            const d = pickSessionDurationMs('poshmark');
            expect(d).toBeGreaterThanOrEqual(profile.sessionLengthMinMs);
            expect(d).toBeLessThanOrEqual(profile.sessionLengthMaxMs);
        }
    });

    test('eBay bursting disallowed, Poshmark bursting allowed', () => {
        expect(getPlatformProfile('ebay').burstingAllowed).toBe(false);
        expect(getPlatformProfile('poshmark').burstingAllowed).toBe(true);
    });
});

// ----------------------------------------------------------------------------
// anomaly-scorer pure functions
// ----------------------------------------------------------------------------

describe('anomaly-scorer.decayedWeight', () => {
    test('weight at t=now is 1.0', () => {
        const now = Date.now();
        expect(decayedWeight(now, now)).toBe(1);
    });

    test('weight after one 24h half-life is 0.5', () => {
        const now = Date.now();
        const yesterday = now - 24 * 3600 * 1000;
        expect(decayedWeight(yesterday, now)).toBeCloseTo(0.5, 4);
    });

    test('weight after two half-lives is 0.25', () => {
        const now = Date.now();
        const twoDaysAgo = now - 48 * 3600 * 1000;
        expect(decayedWeight(twoDaysAgo, now)).toBeCloseTo(0.25, 4);
    });
});

describe('anomaly-scorer.collapseBursts', () => {
    test('empty array returns empty', () => {
        expect(collapseBursts([])).toEqual([]);
    });

    test('same-type events within window collapse to one', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 1000, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 2000, type: SIGNAL_TYPES.CAPTCHA }
        ];
        const collapsed = collapseBursts(events, 10 * 60 * 1000);
        expect(collapsed.length).toBe(1);
    });

    test('same-type events outside window do NOT collapse', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 15 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA }
        ];
        const collapsed = collapseBursts(events, 10 * 60 * 1000);
        expect(collapsed.length).toBe(2);
    });

    test('different types do not collapse', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 1000, type: SIGNAL_TYPES.LOCKOUT }
        ];
        expect(collapseBursts(events, 10 * 60 * 1000).length).toBe(2);
    });
});

describe('anomaly-scorer.computeAnomalyScore', () => {
    test('empty events → score 0', () => {
        expect(computeAnomalyScore([])).toBe(0);
    });

    test('three CAPTCHA events collapsed to one (same burst) → ~3.0', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 1000, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 2000, type: SIGNAL_TYPES.CAPTCHA }
        ];
        const score = computeAnomalyScore(events, now + 3000);
        expect(score).toBeCloseTo(SIGNAL_WEIGHTS.captcha, 1);
    });

    test('three CAPTCHA events 20min apart → ~9.0 (no collapse)', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 20 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now + 40 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA }
        ];
        const score = computeAnomalyScore(events, now + 40 * 60 * 1000);
        // Three events × weight 3 × decay ~1.0 (all within same hour)
        expect(score).toBeGreaterThan(8.5);
        expect(score).toBeLessThanOrEqual(9.0);
    });

    test('low-confidence signal alone (engagement_drop) → 0.5× weight', () => {
        const now = Date.now();
        const events = [{ ts: now, type: SIGNAL_TYPES.ENGAGEMENT_DROP }];
        const score = computeAnomalyScore(events, now);
        expect(score).toBeCloseTo(SIGNAL_WEIGHTS.engagement_drop * 0.5, 3);
    });

    test('low-confidence signal corroborated by recent HIGH → full weight', () => {
        const now = Date.now();
        const events = [
            { ts: now - 3600 * 1000, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now, type: SIGNAL_TYPES.ENGAGEMENT_DROP }
        ];
        const score = computeAnomalyScore(events, now);
        // captcha (3.0 × decay ~0.97) + engagement_drop (1.5 × decay 1.0, full weight)
        expect(score).toBeGreaterThan(SIGNAL_WEIGHTS.engagement_drop);
    });
});

describe('anomaly-scorer.shouldForcePause', () => {
    test('lockout in last 24h forces pause', () => {
        const now = Date.now();
        const result = shouldForcePause([{ ts: now - 3600 * 1000, type: SIGNAL_TYPES.LOCKOUT }], now);
        expect(result.pause).toBe(true);
        expect(result.reason).toBe('lockout_in_24h');
    });

    test('2+ login_challenges in 24h forces pause', () => {
        const now = Date.now();
        const events = [
            { ts: now - 3600 * 1000, type: SIGNAL_TYPES.LOGIN_CHALLENGE },
            { ts: now - 1800 * 1000, type: SIGNAL_TYPES.LOGIN_CHALLENGE }
        ];
        expect(shouldForcePause(events, now).pause).toBe(true);
    });

    test('1 login_challenge in 24h does NOT force pause', () => {
        const now = Date.now();
        const events = [{ ts: now - 3600 * 1000, type: SIGNAL_TYPES.LOGIN_CHALLENGE }];
        expect(shouldForcePause(events, now).pause).toBe(false);
    });

    test('captcha during cooldown forces pause', () => {
        const now = Date.now();
        const events = [{ ts: now - 3600 * 1000, type: SIGNAL_TYPES.CAPTCHA }];
        expect(shouldForcePause(events, now, { inCooldown: true }).pause).toBe(true);
    });

    test('captcha outside cooldown does not force pause', () => {
        const now = Date.now();
        const events = [{ ts: now - 3600 * 1000, type: SIGNAL_TYPES.CAPTCHA }];
        expect(shouldForcePause(events, now, { inCooldown: false }).pause).toBe(false);
    });
});

describe('anomaly-scorer.computeWarmupFactor', () => {
    test('day 0 → 10%', () => {
        expect(computeWarmupFactor(0)).toBe(0.10);
    });
    test('day 7 → 45%', () => {
        expect(computeWarmupFactor(7)).toBeCloseTo(0.45, 4);
    });
    test('day 14 → 78%', () => {
        expect(computeWarmupFactor(14)).toBeCloseTo(0.78, 4);
    });
    test('day 21 → 93%', () => {
        expect(computeWarmupFactor(21)).toBeCloseTo(0.93, 4);
    });
    test('day 30 → 100%', () => {
        expect(computeWarmupFactor(30)).toBe(1.00);
    });
    test('day 35 → 100% (clamped)', () => {
        expect(computeWarmupFactor(35)).toBe(1.00);
    });
    test('negative day → 10% (clamped)', () => {
        expect(computeWarmupFactor(-1)).toBe(0.10);
    });
    test('intermediate day 3.5 lies between day 0 and day 7', () => {
        const v = computeWarmupFactor(3.5);
        expect(v).toBeGreaterThan(0.10);
        expect(v).toBeLessThan(0.45);
    });
});

describe('anomaly-scorer.anomalyDampeningFactor', () => {
    test('score 0 → 1.0 (normal)', () => {
        expect(anomalyDampeningFactor(0)).toBe(1.0);
    });
    test('score 4.5 → 0.5 (reduced)', () => {
        expect(anomalyDampeningFactor(4.5)).toBe(0.5);
    });
    test('score 9.0 → 0 (cooldown)', () => {
        expect(anomalyDampeningFactor(9.0)).toBe(0);
    });
});

describe('anomaly-scorer.scoreToCooldownState', () => {
    test('score < 3 → normal', () => {
        expect(scoreToCooldownState(2.9).state).toBe('normal');
    });
    test('score 3-6 → reduced', () => {
        expect(scoreToCooldownState(4.5).state).toBe('reduced');
    });
    test('score 6-10 → cooldown_24h', () => {
        const r = scoreToCooldownState(7);
        expect(r.state).toBe('cooldown_24h');
        expect(r.cooldownHours).toBe(24);
    });
    test('score 10-15 → cooldown_72h', () => {
        const r = scoreToCooldownState(12);
        expect(r.state).toBe('cooldown_72h');
        expect(r.cooldownHours).toBe(72);
    });
    test('score > 15 → quarantine', () => {
        const r = scoreToCooldownState(20);
        expect(r.state).toBe('quarantine');
        expect(r.cooldownHours).toBe(Infinity);
    });
});

describe('anomaly-scorer.computeEffectiveRate', () => {
    test('day 30, no events → floor(normal × 1.0 × 1.0)', () => {
        const profile = getPlatformProfile('poshmark');
        const rate = computeEffectiveRate('poshmark', 30, []);
        expect(rate).toBe(profile.maxActionsPerHour.normal);
    });

    test('day 0, no events → 10% of normal', () => {
        const profile = getPlatformProfile('poshmark');
        const rate = computeEffectiveRate('poshmark', 0, []);
        expect(rate).toBe(Math.floor(profile.maxActionsPerHour.normal * 0.10));
    });

    test('day 30 with score > 6 → rate 0', () => {
        const now = Date.now();
        const events = [
            { ts: now, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now - 20 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA },
            { ts: now - 40 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA }
        ];
        const rate = computeEffectiveRate('poshmark', 30, events);
        expect(rate).toBe(0);
    });
});

// ----------------------------------------------------------------------------
// adaptive-rate-control persistence
// ----------------------------------------------------------------------------

describe('adaptive-rate-control.recordDetectionEvent', () => {
    beforeEach(() => cleanState(TEST_PLATFORM));
    afterEach(() => cleanState(TEST_PLATFORM));

    test('recording a captcha event persists to disk', () => {
        recordDetectionEvent(TEST_PLATFORM, SIGNAL_TYPES.CAPTCHA, { url: 'https://x' });
        const data = readCooldown(TEST_PLATFORM);
        expect(data.events.length).toBe(1);
        expect(data.events[0].type).toBe(SIGNAL_TYPES.CAPTCHA);
    });

    test('recorded state survives a re-read (no in-memory caching)', () => {
        recordDetectionEvent(TEST_PLATFORM, SIGNAL_TYPES.CAPTCHA, {});
        const a = readCooldown(TEST_PLATFORM);
        const b = readCooldown(TEST_PLATFORM);
        expect(b.events.length).toBe(a.events.length);
    });

    test('3 CAPTCHA events in separate windows → cooldown_24h state', () => {
        const now = Date.now();
        // Write events directly to bypass collapse window
        writeCooldown(TEST_PLATFORM, {
            events: [
                { ts: now - 40 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA },
                { ts: now - 20 * 60 * 1000, type: SIGNAL_TYPES.CAPTCHA }
            ],
            cooldownUntil: null,
            quarantined: false
        });
        const result = recordDetectionEvent(TEST_PLATFORM, SIGNAL_TYPES.CAPTCHA, {});
        expect(['cooldown_24h', 'cooldown_72h']).toContain(result.state);
        expect(result.cooldownUntil).toBeTruthy();
    });

    test('lockout forces immediate quarantine', () => {
        const result = recordDetectionEvent(TEST_PLATFORM, SIGNAL_TYPES.LOCKOUT, {});
        expect(result.quarantined).toBe(true);
        expect(result.forceReason).toBe('lockout_in_24h');
    });

    test('clearCooldown resets all state', () => {
        recordDetectionEvent(TEST_PLATFORM, SIGNAL_TYPES.LOCKOUT, {});
        expect(checkQuarantine(TEST_PLATFORM)).toBe(true);
        clearCooldown(TEST_PLATFORM);
        expect(checkQuarantine(TEST_PLATFORM)).toBe(false);
        expect(readCooldown(TEST_PLATFORM).events.length).toBe(0);
    });

    test('throws on unknown signal type', () => {
        expect(() => recordDetectionEvent(TEST_PLATFORM, 'not_a_signal', {})).toThrow();
    });

    test('normalizes legacy ISO-string event timestamps', () => {
        const nowIso = new Date().toISOString();
        writeCooldown(TEST_PLATFORM, {
            events: [{ ts: nowIso, type: SIGNAL_TYPES.CAPTCHA }],
            cooldownUntil: null,
            quarantined: false
        });
        const data = readCooldown(TEST_PLATFORM);
        expect(typeof data.events[0].ts).toBe('number');
    });
});

describe('adaptive-rate-control.isCoolingDown', () => {
    beforeEach(() => cleanState(TEST_PLATFORM));
    afterEach(() => cleanState(TEST_PLATFORM));

    test('no state → not cooling', () => {
        expect(isCoolingDown(TEST_PLATFORM).cooling).toBe(false);
    });

    test('future cooldownUntil → cooling', () => {
        writeCooldown(TEST_PLATFORM, {
            events: [],
            cooldownUntil: new Date(Date.now() + 3600000).toISOString(),
            quarantined: false
        });
        const s = isCoolingDown(TEST_PLATFORM);
        expect(s.cooling).toBe(true);
        expect(s.remainingMs).toBeGreaterThan(0);
    });

    test('quarantined → cooling with reason=quarantined', () => {
        writeCooldown(TEST_PLATFORM, {
            events: [],
            cooldownUntil: null,
            quarantined: true
        });
        const s = isCoolingDown(TEST_PLATFORM);
        expect(s.cooling).toBe(true);
        expect(s.reason).toBe('quarantined');
    });
});

describe('adaptive-rate-control.canActOnItem / recordItemAction', () => {
    const ITEM = 'https://example.com/listing/42';
    beforeEach(() => writeRelistTracker(TEST_PLATFORM, {}));
    afterEach(() => writeRelistTracker(TEST_PLATFORM, {}));

    test('no prior action → can act', () => {
        expect(canActOnItem(TEST_PLATFORM, ITEM, 7)).toBe(true);
    });

    test('after recordItemAction, cannot act within window', () => {
        recordItemAction(TEST_PLATFORM, ITEM, { pruneAfterDays: 30 });
        expect(canActOnItem(TEST_PLATFORM, ITEM, 7)).toBe(false);
    });

    test('backdated action older than window → can act', () => {
        const tracker = readRelistTracker(TEST_PLATFORM);
        tracker[ITEM] = new Date(Date.now() - 10 * 86400000).toISOString();
        writeRelistTracker(TEST_PLATFORM, tracker);
        expect(canActOnItem(TEST_PLATFORM, ITEM, 7)).toBe(true);
    });
});
