// Token usage budget tracking for AI providers.
// Tracks per-user per-provider monthly token consumption and enforces tier limits.
// Fail-open: if the DB is unavailable, AI calls are allowed through.

import { query } from '../../backend/db/database.js';
import { logger } from '../../backend/shared/logger.js';

// Monthly token limits by subscription tier across all providers combined.
const TIER_TOKEN_LIMITS = {
    free:     50_000,
    starter:  50_000,
    pro:      500_000,
    business: 2_000_000
};

function currentPeriod() {
    const now = new Date();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${mm}`;
}

/**
 * Record token usage for a completed AI call.
 * Upserts into token_usage — fails open on any DB error.
 *
 * @param {string} userId
 * @param {'anthropic'|'openai'|'grok'} provider
 * @param {number} inputTokens
 * @param {number} outputTokens
 */
export async function trackUsage(userId, provider, inputTokens, outputTokens) {
    if (!userId || process.env.NODE_ENV === 'test') return;
    const period = currentPeriod();
    const total = (inputTokens || 0) + (outputTokens || 0);
    try {
        await query.run(
            `INSERT INTO token_usage (user_id, provider, period, input_tokens, output_tokens, total_tokens, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())
             ON CONFLICT (user_id, provider, period) DO UPDATE SET
               input_tokens  = token_usage.input_tokens  + EXCLUDED.input_tokens,
               output_tokens = token_usage.output_tokens + EXCLUDED.output_tokens,
               total_tokens  = token_usage.total_tokens  + EXCLUDED.total_tokens,
               updated_at    = NOW()`,
            [userId, provider, period, inputTokens || 0, outputTokens || 0, total]
        );
    } catch (err) {
        logger.warn('[tokenBudget] trackUsage failed (fail-open)', { userId, provider, error: err.message });
    }
}

/**
 * Check whether a user has remaining token budget for this month.
 * Returns { allowed: true } on any DB error (fail-open).
 *
 * @param {string} userId
 * @param {string} [tier] - subscription_tier ('free'|'starter'|'pro'|'business')
 * @returns {Promise<{ allowed: boolean, used: number, limit: number, provider: string }>}
 */
export async function checkBudget(userId, tier = 'free') {
    if (!userId || process.env.NODE_ENV === 'test') return { allowed: true, used: 0, limit: 0, provider: 'all' };
    const period = currentPeriod();
    const limit = TIER_TOKEN_LIMITS[tier] ?? TIER_TOKEN_LIMITS.free;
    try {
        const row = await query.get(
            `SELECT COALESCE(SUM(total_tokens), 0) AS used
             FROM token_usage
             WHERE user_id = ? AND period = ?`,
            [userId, period]
        );
        const used = Number(row?.used ?? 0);
        return { allowed: used < limit, used, limit, provider: 'all' };
    } catch (err) {
        logger.warn('[tokenBudget] checkBudget failed (fail-open)', { userId, error: err.message });
        return { allowed: true, used: 0, limit, provider: 'all' };
    }
}

export { TIER_TOKEN_LIMITS };
