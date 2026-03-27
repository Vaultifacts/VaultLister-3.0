// Feature Flags Service
// Enables gradual rollout and A/B testing

import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper
 */
function safeParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        logger.error('[FeatureFlags] JSON parse error', null, { detail: e.message });
        return fallback;
    }
}

// Default feature flags
const DEFAULT_FLAGS = {
    // UI Features
    'ui.darkMode': { enabled: true, rolloutPercentage: 100 },
    'ui.newDashboard': { enabled: false, rolloutPercentage: 0 },
    'ui.advancedFilters': { enabled: true, rolloutPercentage: 100 },
    'ui.bulkActions': { enabled: true, rolloutPercentage: 100 },

    // Automation Features
    'automation.autoShare': { enabled: true, rolloutPercentage: 100 },
    'automation.priceOptimization': { enabled: false, rolloutPercentage: 10 },
    'automation.smartRelist': { enabled: false, rolloutPercentage: 25 },

    // AI Features
    'ai.listingGenerator': { enabled: true, rolloutPercentage: 100 },
    'ai.pricePredictor': { enabled: false, rolloutPercentage: 50 },
    'ai.imageEnhancer': { enabled: false, rolloutPercentage: 0 },

    // Integration Features
    'integration.whatnot': { enabled: true, rolloutPercentage: 100 },
    'integration.vestiaire': { enabled: false, rolloutPercentage: 25 },
    'integration.shopify': { enabled: false, rolloutPercentage: 0 },
    'integration.outlook': { enabled: true, rolloutPercentage: 100 },
    'integration.googleDrive': { enabled: false, rolloutPercentage: 0 },
    'integration.googleCalendarSync': { enabled: false, rolloutPercentage: 0 },

    // Beta Features
    'beta.newInventoryView': { enabled: false, rolloutPercentage: 5 },
    'beta.teamCollaboration': { enabled: false, rolloutPercentage: 0 },
    'beta.mobileApp': { enabled: false, rolloutPercentage: 0 },

    // Performance Features
    'perf.lazyLoadImages': { enabled: true, rolloutPercentage: 100 },
    'perf.virtualScrolling': { enabled: false, rolloutPercentage: 50 },
    'perf.serviceWorker': { enabled: true, rolloutPercentage: 100 },
};

// In-memory cache
let flagsCache = { ...DEFAULT_FLAGS };
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

// Feature flags service
const featureFlags = {
    // Initialize - load flags from database
    async init() {
        try {
            await this.loadFlags();
            logger.info('[FeatureFlags] Initialized');
        } catch (error) {
            logger.warn('[FeatureFlags] Using default flags', { detail: error.message });
        }
    },

    // Load flags from database
    async loadFlags() {
        try {
            const dbFlags = await query.all('SELECT * FROM feature_flags WHERE is_active = 1') || [];

            for (const flag of dbFlags) {
                flagsCache[flag.name] = {
                    enabled: flag.enabled === 1,
                    rolloutPercentage: flag.rollout_percentage || 100,
                    description: flag.description,
                    targetUsers: safeParse(flag.target_users, null),
                    targetTiers: safeParse(flag.target_tiers, null),
                };
            }

            lastCacheUpdate = Date.now();
        } catch (error) {
            // Table might not exist yet
            logger.warn('[FeatureFlags] Could not load from DB', { detail: error.message });
        }
    },

    // Check if cache needs refresh
    async ensureFreshCache() {
        if (Date.now() - lastCacheUpdate > CACHE_TTL) {
            await this.loadFlags();
        }
    },

    // Check if a feature is enabled for a user
    async isEnabled(flagName, user = null) {
        await this.ensureFreshCache();

        const flag = flagsCache[flagName];
        if (!flag) {
            return false;
        }

        // Check if globally disabled
        if (!flag.enabled) {
            return false;
        }

        // Check user targeting
        if (flag.targetUsers && user?.id) {
            if (flag.targetUsers.includes(user.id)) {
                return true;
            }
        }

        // Check tier targeting
        if (flag.targetTiers && user?.subscription_tier) {
            if (flag.targetTiers.includes(user.subscription_tier)) {
                return true;
            }
        }

        // Check rollout percentage
        if (flag.rolloutPercentage < 100) {
            // Use user ID for consistent bucketing
            const bucket = user?.id
                ? this.hashUserId(user.id) % 100
                : (crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000) * 100;

            return bucket < flag.rolloutPercentage;
        }

        return true;
    },

    // Hash user ID for consistent bucketing
    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    },

    // Get all flags for a user (for client-side)
    async getFlagsForUser(user = null) {
        await this.ensureFreshCache();

        const result = {};
        for (const [name, flag] of Object.entries(flagsCache)) {
            result[name] = await this.isEnabled(name, user);
        }
        return result;
    },

    // Get all flags with metadata (admin)
    getAllFlags() {
        return { ...flagsCache };
    },

    // Set a flag (admin)
    async setFlag(name, config) {
        flagsCache[name] = {
            ...flagsCache[name],
            ...config
        };

        // Persist to database
        try {
            await query.run(`
                INSERT INTO feature_flags (name, enabled, rollout_percentage, description, target_users, target_tiers, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON CONFLICT(name) DO UPDATE SET
                    enabled = excluded.enabled,
                    rollout_percentage = excluded.rollout_percentage,
                    description = excluded.description,
                    target_users = excluded.target_users,
                    target_tiers = excluded.target_tiers,
                    updated_at = NOW()
            `, [
                name,
                config.enabled ? 1 : 0,
                config.rolloutPercentage || 100,
                config.description || null,
                config.targetUsers ? JSON.stringify(config.targetUsers) : null,
                config.targetTiers ? JSON.stringify(config.targetTiers) : null
            ]);
        } catch (error) {
            logger.warn('[FeatureFlags] Could not persist flag', { detail: error.message });
        }
    },

    // Track feature usage for analytics
    async trackUsage(flagName, user = null) {
        try {
            await query.run(`
                INSERT INTO feature_flag_usage (flag_name, user_id, timestamp)
                VALUES (?, ?, NOW())
            `, [flagName, user?.id || null]);
        } catch (error) {
            // Non-critical, ignore
        }
    },

    // Get usage statistics (admin)
    async getUsageStats(flagName, days = 30) {
        try {
            return await query.all(`
                SELECT
                    flag_name,
                    COUNT(*) as total_uses,
                    COUNT(DISTINCT user_id) as unique_users,
                    timestamp::date as date
                FROM feature_flag_usage
                WHERE flag_name = ?
                AND timestamp > NOW() - (?::text || ' days')::interval
                GROUP BY timestamp::date
                ORDER BY date DESC
            `, [flagName, days]);
        } catch (error) {
            return [];
        }
    }
};

// A/B Testing helpers
const abTesting = {
    // Get variant for user
    getVariant(experimentName, variants = ['A', 'B'], user = null) {
        const bucket = user?.id
            ? featureFlags.hashUserId(user.id + experimentName) % variants.length
            : Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000 * variants.length);

        return variants[bucket];
    },

    // Track conversion
    async trackConversion(experimentName, variant, user = null, value = 1) {
        try {
            await query.run(`
                INSERT INTO ab_test_conversions (experiment, variant, user_id, value, timestamp)
                VALUES (?, ?, ?, ?, NOW())
            `, [experimentName, variant, user?.id || null, value]);
        } catch (error) {
            // Non-critical
        }
    },

    // Get experiment results
    async getResults(experimentName) {
        try {
            return await query.all(`
                SELECT
                    variant,
                    COUNT(*) as conversions,
                    SUM(value) as total_value,
                    COUNT(DISTINCT user_id) as unique_users
                FROM ab_test_conversions
                WHERE experiment = ?
                GROUP BY variant
            `, [experimentName]);
        } catch (error) {
            return [];
        }
    }
};

// Tables created by pg-schema.sql (managed by migration system)
const migration = '';

export { featureFlags, abTesting, migration };
export default featureFlags;
