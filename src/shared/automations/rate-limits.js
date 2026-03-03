// Platform-specific rate limits for automation bots
// Referenced by RULES.md: "Bots must respect platform-specific rate limits"
//
// All values in milliseconds. Bots must wait at least this long between actions.
// These are conservative minimums — actual delays should add randomization on top.

export const RATE_LIMITS = {
    poshmark: {
        shareDelay:     3000,   // 3s between shares (Posh detects < 2s)
        followDelay:    2500,   // 2.5s between follows
        offerDelay:     5000,   // 5s between offers
        loginCooldown:  60000,  // 1min between login attempts
        maxSharesPerRun:  300,  // Poshmark flags > 300 shares/hour
        maxFollowsPerRun: 100,  // Conservative follow limit per run
        maxOffersPerRun:   50,  // Offers per run
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
        actionDelay:    5000,   // FB is aggressive on detection
        loginCooldown:  120000,
        maxActionsPerRun: 20,
    },
    whatnot: {
        actionDelay:    4000,
        loginCooldown:  60000,
        maxActionsPerRun: 30,
    },
};

// Add random jitter to a base delay (±30%)
export function jitteredDelay(baseMs) {
    const jitter = baseMs * 0.3;
    return baseMs + Math.floor(Math.random() * jitter * 2) - jitter;
}

export default RATE_LIMITS;
