// Platform-specific rate limits for automation bots
// Referenced by RULES.md: "Bots must respect platform-specific rate limits"
//
// All values in milliseconds. Bots must wait at least this long between actions.
// These are conservative minimums — actual delays should add randomization on top.

export const RATE_LIMITS = {
    poshmark: {
        shareDelay:     4000,   // 4s between shares (Posh detects < 2s; extra margin for safety)
        followDelay:    3500,   // 3.5s between follows
        offerDelay:     6000,   // 6s between offers
        loginCooldown:  90000,  // 1.5min between login attempts
        maxSharesPerRun:  200,  // Conservative: Poshmark flags > 300 shares/hour
        maxFollowsPerRun:  75,  // Conservative follow limit per run
        maxOffersPerRun:   40,  // Offers per run
    },
    mercari: {
        actionDelay:    4000,   // 4s between any action
        loginCooldown:  60000,
        maxActionsPerRun: 50,
    },
    depop: {
        actionDelay:    3500,
        loginCooldown:  60000,
        maxActionsPerRun: 50,
    },
    grailed: {
        actionDelay:    4000,
        loginCooldown:  60000,
        maxActionsPerRun: 30,
    },
    facebook: {
        actionDelay:      5000,    // FB is aggressive on detection
        loginCooldown:    120000,
        maxActionsPerRun: 20,
        maxListingsPerDay: 10,     // FB flags bulk listing sessions
        maxLoginsPerDay:   3,      // Repeated logins signal bot activity
        listingDelay:     8000,    // Extra gap between listing creates
        sessionCooldown:  300000,  // 5min minimum between bot runs
        profileCooldown:  3600000, // 1hr minimum between uses of same profile
    },
    whatnot: {
        actionDelay:    4000,
        loginCooldown:  60000,
        maxActionsPerRun: 30,
    },
    ebay: {
        listingCreate:  3000,   // 3s between listing actions
        listingUpdate:  2000,
        search:         2000,
        pageLoad:       1500,
        login:          5000,
        betweenActions: 2500,
    },
};

// Add random jitter to a base delay (±30%)
export function jitteredDelay(baseMs) {
    const jitter = baseMs * 0.3;
    return baseMs + Math.floor(Math.random() * jitter * 2) - jitter;
}

export default RATE_LIMITS;
