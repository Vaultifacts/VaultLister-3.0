// Pure scoring model for adaptive rate control.
// No I/O; callers supply event arrays and timestamps.

import {
    SIGNAL_WEIGHTS,
    HIGH_CONFIDENCE_SIGNALS,
    LOW_CONFIDENCE_SIGNALS,
    SIGNAL_TYPES
} from './signal-contracts.js';
import { getPlatformProfile } from './platform-profiles.js';

// Exponential time decay — each event's contribution decays with a 24h half-life by default.
export function decayedWeight(eventTs, nowTs = Date.now(), halfLifeHours = 24) {
    const ageHours = Math.max(0, (nowTs - eventTs) / 3600000);
    return Math.pow(0.5, ageHours / halfLifeHours);
}

// Collapse a burst of same-type events within `windowMs` to a single representative event.
// Input is not mutated. Events are sorted by `ts` ascending before collapsing.
export function collapseBursts(events, windowMs = 10 * 60 * 1000) {
    if (!Array.isArray(events) || events.length === 0) return [];
    const sorted = events.slice().sort((a, b) => a.ts - b.ts);
    const collapsed = [];
    for (const e of sorted) {
        const prev = collapsed[collapsed.length - 1];
        if (!prev || prev.type !== e.type || (e.ts - prev.ts) > windowMs) {
            collapsed.push(e);
        }
    }
    return collapsed;
}

// Score an event array under the time-decay + incident-collapse + confidence-tier model.
// Low-confidence signals get 0.5x weight unless corroborated by a HIGH signal within 24h.
export function computeAnomalyScore(events, nowTs = Date.now(), opts = {}) {
    const halfLifeHours = opts.halfLifeHours ?? 24;
    const collapseWindowMs = opts.collapseWindowMs ?? 10 * 60 * 1000;
    const collapsed = collapseBursts(events, collapseWindowMs);

    const has24hHighSignal = collapsed.some(
        e => HIGH_CONFIDENCE_SIGNALS.has(e.type) && (nowTs - e.ts) <= 86400000
    );

    let score = 0;
    for (const e of collapsed) {
        const baseWeight = SIGNAL_WEIGHTS[e.type] || 0;
        if (baseWeight === 0) continue;
        const decay = decayedWeight(e.ts, nowTs, halfLifeHours);
        const confidenceMultiplier =
            LOW_CONFIDENCE_SIGNALS.has(e.type) && !has24hHighSignal ? 0.5 : 1.0;
        score += baseWeight * decay * confidenceMultiplier;
    }
    return score;
}

// Hard-override policy — bypass scoring for immediate quarantine/pause transitions.
// Returns { pause: boolean, reason: string|null } so callers can log the trigger.
export function shouldForcePause(events, nowTs = Date.now(), opts = {}) {
    const inCooldown = opts.inCooldown === true;
    const last24hMs = 24 * 3600 * 1000;
    const recent = events.filter(e => (nowTs - e.ts) <= last24hMs);

    const lockoutIn24h = recent.some(e => e.type === SIGNAL_TYPES.LOCKOUT);
    if (lockoutIn24h) return { pause: true, reason: 'lockout_in_24h' };

    const loginChallengesIn24h = recent.filter(e => e.type === SIGNAL_TYPES.LOGIN_CHALLENGE).length;
    if (loginChallengesIn24h >= 2) return { pause: true, reason: 'two_login_challenges_in_24h' };

    const captchaIn24h = recent.some(e => e.type === SIGNAL_TYPES.CAPTCHA);
    if (inCooldown && captchaIn24h) return { pause: true, reason: 'captcha_during_cooldown' };

    return { pause: false, reason: null };
}

// Deterministic piecewise warmup curve.
// Targets: day 0 → 10%, day 7 → 45%, day 14 → 78%, day 21 → 93%, day 30 → 100%.
// Intermediate values are linear interpolation between named nodes.
export function computeWarmupFactor(ageDays) {
    if (!Number.isFinite(ageDays) || ageDays <= 0) return 0.10;
    if (ageDays >= 30) return 1.00;
    if (ageDays <= 7) {
        return 0.10 + (0.45 - 0.10) * (ageDays / 7);
    }
    if (ageDays <= 14) {
        return 0.45 + (0.78 - 0.45) * ((ageDays - 7) / 7);
    }
    if (ageDays <= 21) {
        return 0.78 + (0.93 - 0.78) * ((ageDays - 14) / 7);
    }
    return 0.93 + (1.00 - 0.93) * ((ageDays - 21) / 9);
}

// Score thresholds → rate dampening multiplier.
// < 3.0 normal ; 3-6 reduced 50% ; >= 6 cooldown (0).
export function anomalyDampeningFactor(score) {
    if (!Number.isFinite(score) || score < 3) return 1.0;
    if (score < 6) return 0.5;
    return 0.0;
}

// Score thresholds → cooldown decision.
// Returns { state, cooldownHours }.
// state in: 'normal' | 'reduced' | 'cooldown_24h' | 'cooldown_72h' | 'quarantine'
export function scoreToCooldownState(score) {
    if (!Number.isFinite(score) || score < 3) return { state: 'normal', cooldownHours: 0 };
    if (score < 6) return { state: 'reduced', cooldownHours: 0 };
    if (score < 10) return { state: 'cooldown_24h', cooldownHours: 24 };
    if (score < 15) return { state: 'cooldown_72h', cooldownHours: 72 };
    return { state: 'quarantine', cooldownHours: Infinity };
}

// Effective rate = baseRate * warmup * anomaly dampening.
// baseRate defaults to profile.maxActionsPerHour.normal.
export function computeEffectiveRate(platform, ageDays, events, nowTs = Date.now()) {
    const profile = getPlatformProfile(platform);
    const baseRate = profile.maxActionsPerHour.normal;
    const warmup = computeWarmupFactor(ageDays);
    const score = computeAnomalyScore(events, nowTs);
    const dampening = anomalyDampeningFactor(score);
    return Math.floor(baseRate * warmup * dampening);
}
