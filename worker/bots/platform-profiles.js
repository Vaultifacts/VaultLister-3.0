// Per-platform behavioral profiles
// Controls session length, action cadence shape, warmup tiers, and bursting rules.

export const SHARE_PATTERNS = {
    HUMAN_GAUSSIAN: 'human_gaussian',
    LINEAR: 'linear',
    BURSTY: 'bursty'
};

export const COOLDOWN_BEHAVIORS = {
    GRADUAL: 'gradual',
    IMMEDIATE: 'immediate'
};

export const LISTING_FREQUENCIES = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    SPARSE: 'sparse'
};

export const EDIT_BEHAVIORS = {
    FREQUENT: 'frequent',
    SPARSE: 'sparse',
    DISALLOWED: 'disallowed'
};

// Each profile defines behavioral envelope for a platform.
// maxActionsPerHour is authoritative; continuous warmup curve (anomaly-scorer) uses `normal` as the ceiling.
export const PLATFORM_PROFILES = {
    poshmark: {
        sharePattern: SHARE_PATTERNS.HUMAN_GAUSSIAN,
        sessionLengthMinMs: 20 * 60 * 1000,
        sessionLengthMaxMs: 40 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.GRADUAL,
        listingFrequency: LISTING_FREQUENCIES.HIGH,
        editBehavior: EDIT_BEHAVIORS.FREQUENT,
        burstingAllowed: true,
        maxActionsPerHour: { day1: 20, day7: 60, day30: 120, normal: 180 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 5
    },
    mercari: {
        sharePattern: SHARE_PATTERNS.HUMAN_GAUSSIAN,
        sessionLengthMinMs: 10 * 60 * 1000,
        sessionLengthMaxMs: 25 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.GRADUAL,
        listingFrequency: LISTING_FREQUENCIES.MEDIUM,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 10, day7: 25, day30: 40, normal: 50 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 2
    },
    depop: {
        sharePattern: SHARE_PATTERNS.HUMAN_GAUSSIAN,
        sessionLengthMinMs: 15 * 60 * 1000,
        sessionLengthMaxMs: 35 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.GRADUAL,
        listingFrequency: LISTING_FREQUENCIES.MEDIUM,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 10, day7: 25, day30: 40, normal: 50 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 2
    },
    grailed: {
        sharePattern: SHARE_PATTERNS.LINEAR,
        sessionLengthMinMs: 10 * 60 * 1000,
        sessionLengthMaxMs: 20 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.GRADUAL,
        listingFrequency: LISTING_FREQUENCIES.LOW,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 5, day7: 12, day30: 25, normal: 30 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 1,
        bumpCooldownDays: 7
    },
    facebook: {
        sharePattern: SHARE_PATTERNS.HUMAN_GAUSSIAN,
        sessionLengthMinMs: 8 * 60 * 1000,
        sessionLengthMaxMs: 20 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.IMMEDIATE,
        listingFrequency: LISTING_FREQUENCIES.LOW,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 2, day7: 4, day30: 6, normal: 10 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 1
    },
    whatnot: {
        sharePattern: SHARE_PATTERNS.LINEAR,
        sessionLengthMinMs: 12 * 60 * 1000,
        sessionLengthMaxMs: 25 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.GRADUAL,
        listingFrequency: LISTING_FREQUENCIES.MEDIUM,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 5, day7: 15, day30: 25, normal: 30 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 2
    },
    ebay: {
        sharePattern: SHARE_PATTERNS.LINEAR,
        sessionLengthMinMs: 5 * 60 * 1000,
        sessionLengthMaxMs: 15 * 60 * 1000,
        cooldownBehavior: COOLDOWN_BEHAVIORS.IMMEDIATE,
        listingFrequency: LISTING_FREQUENCIES.LOW,
        editBehavior: EDIT_BEHAVIORS.SPARSE,
        burstingAllowed: false,
        maxActionsPerHour: { day1: 5, day7: 15, day30: 40, normal: 60 },
        burstWindowMs: 60 * 1000,
        maxBurstActions: 1
    }
};

export function getPlatformProfile(platform) {
    const profile = PLATFORM_PROFILES[platform];
    if (!profile) {
        throw new Error(`[platform-profiles] Unknown platform: ${platform}`);
    }
    return profile;
}

export function hasPlatformProfile(platform) {
    return Object.prototype.hasOwnProperty.call(PLATFORM_PROFILES, platform);
}

// Random session duration within profile envelope
export function pickSessionDurationMs(platform) {
    const p = getPlatformProfile(platform);
    const range = p.sessionLengthMaxMs - p.sessionLengthMinMs;
    return p.sessionLengthMinMs + Math.floor(Math.random() * range);
}

export default PLATFORM_PROFILES;
