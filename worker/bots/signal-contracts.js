// Boolean signal contracts for adaptive rate control
// Signals are emitted by bots/sync adapters to adaptive-rate-control.js

export const SIGNAL_TYPES = {
    CAPTCHA: 'captcha',
    LOCKOUT: 'lockout',
    LISTING_INVISIBLE: 'listing_invisible',
    ENGAGEMENT_DROP: 'engagement_drop',
    API_LATENCY_ANOMALY: 'api_latency_anomaly',
    LOGIN_CHALLENGE: 'login_challenge'
};

// Confidence tiers — LOW signals get 0.5x weight unless corroborated by HIGH signal within 24h
export const HIGH_CONFIDENCE_SIGNALS = new Set([
    SIGNAL_TYPES.CAPTCHA,
    SIGNAL_TYPES.LOCKOUT,
    SIGNAL_TYPES.LOGIN_CHALLENGE
]);

export const LOW_CONFIDENCE_SIGNALS = new Set([
    SIGNAL_TYPES.LISTING_INVISIBLE,
    SIGNAL_TYPES.ENGAGEMENT_DROP
]);

export const MEDIUM_CONFIDENCE_SIGNALS = new Set([
    SIGNAL_TYPES.API_LATENCY_ANOMALY
]);

// Signal base weights
export const SIGNAL_WEIGHTS = {
    [SIGNAL_TYPES.CAPTCHA]: 3.0,
    [SIGNAL_TYPES.LOCKOUT]: 5.0,
    [SIGNAL_TYPES.LISTING_INVISIBLE]: 2.0,
    [SIGNAL_TYPES.ENGAGEMENT_DROP]: 1.5,
    [SIGNAL_TYPES.API_LATENCY_ANOMALY]: 1.0,
    [SIGNAL_TYPES.LOGIN_CHALLENGE]: 4.0
};

// --- Predicate helpers ------------------------------------------------------
// Each predicate returns true if the boolean signal contract holds.

export function isCaptchaSignal({ captchaElementDetected }) {
    return captchaElementDetected === true;
}

export function isLockoutSignal({ redirectedToLogin, pageText }) {
    if (redirectedToLogin === true) return true;
    if (typeof pageText === 'string' && /temporarily locked/i.test(pageText)) return true;
    return false;
}

export function isLoginChallengeSignal({ reauthRequiredAfterValidSession, pageText }) {
    if (reauthRequiredAfterValidSession === true) return true;
    if (typeof pageText === 'string' && /verify it'?s you/i.test(pageText)) return true;
    return false;
}

// Adapter-side: true only after 2 consecutive checks 2h apart, item not sold, age ≥ 24h.
// Caller is responsible for the two-sample cadence — this predicate gates on the inputs.
export function isListingInvisibleSignal({
    inVaultlisterDb,
    notInMarketplaceSearchTwiceIn2h,
    notSold,
    ageHours
}) {
    return (
        inVaultlisterDb === true &&
        notInMarketplaceSearchTwiceIn2h === true &&
        notSold === true &&
        typeof ageHours === 'number' && ageHours >= 24
    );
}

export function isEngagementDropSignal({
    rolling7dayPerListing,
    rolling30dayBaseline,
    listingCountInPeriod
}) {
    if (typeof listingCountInPeriod !== 'number' || listingCountInPeriod < 10) return false;
    if (typeof rolling7dayPerListing !== 'number' || typeof rolling30dayBaseline !== 'number') return false;
    if (rolling30dayBaseline <= 0) return false;
    return rolling7dayPerListing < 0.5 * rolling30dayBaseline;
}

export function isApiLatencyAnomalySignal({
    rolling5minMedianMs,
    rolling30dayMedianMs,
    requestCountInPeriod
}) {
    if (typeof requestCountInPeriod !== 'number' || requestCountInPeriod < 20) return false;
    if (typeof rolling5minMedianMs !== 'number' || typeof rolling30dayMedianMs !== 'number') return false;
    if (rolling30dayMedianMs <= 0) return false;
    return rolling5minMedianMs > 3 * rolling30dayMedianMs;
}

export function isValidSignalType(type) {
    return Object.values(SIGNAL_TYPES).includes(type);
}
