// Feature flag middleware (REM-17)
// Reads FEATURE_* env vars and gates route access.
// Usage: if (requireFeature('FEATURE_AI_LISTING', ctx)) return;

import { logger } from '../shared/logger.js';

const featureFlags = {};

/**
 * Check if a feature flag is enabled.
 * Reads from process.env on first access, caches thereafter.
 * @param {string} flagName - e.g. 'FEATURE_AI_LISTING'
 * @returns {boolean}
 */
export function isFeatureEnabled(flagName) {
    if (!(flagName in featureFlags)) {
        const val = process.env[flagName];
        featureFlags[flagName] = val === 'true' || val === '1';
        logger.debug(`[FeatureFlags] ${flagName} = ${featureFlags[flagName]}`);
    }
    return featureFlags[flagName];
}

/**
 * Gate a route behind a feature flag. Returns true if the feature is disabled
 * (meaning the caller should return early). Returns false if the feature is enabled.
 * @param {string} flagName - e.g. 'FEATURE_AI_LISTING'
 * @param {object} ctx - Request context with res object
 * @returns {boolean} true if blocked (caller should return), false if allowed
 */
export function requireFeature(flagName, ctx) {
    if (isFeatureEnabled(flagName)) return false; // allowed

    ctx.res = new Response(JSON.stringify({
        error: 'Feature not available',
        feature: flagName,
        message: `This feature is currently disabled. Set ${flagName}=true to enable.`
    }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
    });
    return true; // blocked
}

/** Reset cached flags (for testing) */
export function resetFeatureFlags() {
    for (const key of Object.keys(featureFlags)) {
        delete featureFlags[key];
    }
}
