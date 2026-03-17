import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import {
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    getSubscription,
    STRIPE_PRICE_IDS,
    TIER_FOR_PRICE
} from '../services/stripeService.js';

// Single source of truth for plan definitions
const PLANS = {
    free:     { display_name: 'Free',     price: 0,     limits: { listings: 10,  orders: 50,   automations: 5,   storage_mb: 100,   api_calls: 1000 } },
    starter:  { display_name: 'Starter',  price: 9.99,  limits: { listings: 100, orders: 500,  automations: 20,  storage_mb: 1000,  api_calls: 10000 } },
    pro:      { display_name: 'Pro',      price: 24.99, limits: { listings: 500, orders: 2500, automations: 100, storage_mb: 5000,  api_calls: 50000 } },
    business: { display_name: 'Business', price: 49.99, limits: { listings: -1,  orders: -1,   automations: -1,  storage_mb: 25000, api_calls: 250000 } }
};

const VALID_PLANS = Object.keys(PLANS);

export async function billingRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
    if (!user) return { status: 401, data: { error: 'Authentication required' } };

    try {
        // GET /api/billing/usage - Get current usage metrics
        if (method === 'GET' && path === '/usage') {
            const metrics = await query.all(`
                SELECT metric, current_value, plan_limit, period_start, period_end, updated_at
                FROM plan_usage
                WHERE user_id = ?
                AND period_end >= datetime('now')
                ORDER BY metric
            `, [user.id]);

            const usageData = metrics.map(m => {
                const percentage = m.plan_limit > 0 ? (m.current_value / m.plan_limit) * 100 : 0;
                let warningLevel = 'none';
                if (percentage >= 95) warningLevel = 'critical';
                else if (percentage >= 80) warningLevel = 'warning';

                return {
                    metric: m.metric,
                    current_value: m.current_value,
                    plan_limit: m.plan_limit,
                    percentage_used: Math.round(percentage * 10) / 10,
                    warning_level: warningLevel,
                    period_start: m.period_start,
                    period_end: m.period_end,
                    updated_at: m.updated_at
                };
            });

            return { status: 200, data: { usage: usageData } };
        }

        // GET /api/billing/usage/history - Get usage history over past 6 months
        if (method === 'GET' && path === '/usage/history') {
            const history = await query.all(`
                SELECT metric, current_value, plan_limit, period_start, period_end
                FROM plan_usage
                WHERE user_id = ?
                AND period_start >= date('now', '-6 months')
                ORDER BY metric, period_start
            `, [user.id]);

            // Group by metric
            const grouped = {};
            for (const row of history) {
                if (!grouped[row.metric]) {
                    grouped[row.metric] = [];
                }
                grouped[row.metric].push({
                    period_start: row.period_start,
                    period_end: row.period_end,
                    current_value: row.current_value,
                    plan_limit: row.plan_limit
                });
            }

            return { status: 200, data: { history: grouped } };
        }

        // POST /api/billing/prorate - Calculate proration for plan change
        if (method === 'POST' && path === '/prorate') {
            const { current_plan, new_plan, billing_cycle_start, billing_cycle_end } = body || {};

            if (!current_plan || !new_plan || !billing_cycle_start || !billing_cycle_end) {
                return { status: 400, data: { error: 'Missing required fields' } };
            }

            if (!PLANS[current_plan] || !PLANS[new_plan]) {
                return { status: 400, data: { error: 'Invalid plan name' } };
            }

            const currentPrice = PLANS[current_plan].price;
            const newPrice = PLANS[new_plan].price;

            const cycleStart = new Date(billing_cycle_start);
            const cycleEnd = new Date(billing_cycle_end);
            if (isNaN(cycleStart.getTime()) || isNaN(cycleEnd.getTime())) {
                return { status: 400, data: { error: 'Invalid date format for billing cycle' } };
            }
            const now = new Date();

            if (now < cycleStart || now > cycleEnd) {
                return { status: 400, data: { error: 'Current date must be within billing cycle' } };
            }

            const totalDays = Math.ceil((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.ceil((cycleEnd - now) / (1000 * 60 * 60 * 24));
            const daysUsed = totalDays - daysRemaining;

            // Calculate prorated amounts
            const usedAmount = (currentPrice / totalDays) * daysUsed;
            const proratedCredit = currentPrice - usedAmount;
            const proratedCharge = (newPrice / totalDays) * daysRemaining;
            const amountDue = proratedCharge - proratedCredit;

            return {
                status: 200,
                data: {
                    current_plan,
                    new_plan,
                    current_price: currentPrice,
                    new_price: newPrice,
                    billing_cycle_start,
                    billing_cycle_end,
                    total_days: totalDays,
                    days_used: daysUsed,
                    days_remaining: daysRemaining,
                    used_amount: Math.round(usedAmount * 100) / 100,
                    prorated_credit: Math.round(proratedCredit * 100) / 100,
                    prorated_charge: Math.round(proratedCharge * 100) / 100,
                    amount_due: Math.round(amountDue * 100) / 100
                }
            };
        }

        // GET /api/billing/plans - Return all available plans with features
        if (method === 'GET' && path === '/plans') {
            const PLAN_FEATURES = {
                free: ['Basic inventory management', 'Manual listing creation', 'Order tracking', 'Email support'],
                starter: ['All Free features', 'Bulk listing tools', 'Basic automations', 'Calendar integration', 'Priority email support'],
                pro: ['All Starter features', 'Advanced automations', 'Analytics & reporting', 'Multi-platform sync', 'API access', 'Chat support'],
                business: ['All Pro features', 'Unlimited listings & orders', 'Unlimited automations', 'Team collaboration', 'Custom integrations', 'Dedicated account manager', 'Phone support']
            };

            const plans = VALID_PLANS.map(name => ({
                name,
                display_name: PLANS[name].display_name,
                price: PLANS[name].price,
                limits: PLANS[name].limits,
                features: PLAN_FEATURES[name]
            }));

            return { status: 200, data: { plans } };
        }

        // POST /api/billing/usage/refresh - Recalculate current usage from actual database counts
        if (method === 'POST' && path === '/usage/refresh') {
            // Get actual counts from database
            const listingsCount = await query.get(`
                SELECT COUNT(*) as count FROM listings WHERE user_id = ?
            `, [user.id]);

            const ordersCount = await query.get(`
                SELECT COUNT(*) as count FROM orders WHERE user_id = ?
            `, [user.id]);

            const automationsCount = await query.get(`
                SELECT COUNT(*) as count FROM automations WHERE user_id = ?
            `, [user.id]);

            const inventoryCount = await query.get(`
                SELECT COUNT(*) as count FROM inventory WHERE user_id = ?
            `, [user.id]);

            // Calculate storage (simplified - just count records, in real app would sum file sizes)
            const storageEstimate = Math.round(
                (listingsCount.count * 0.5) +
                (ordersCount.count * 0.1) +
                (inventoryCount.count * 0.2)
            );

            // Get current plan limits based on user's subscription tier
            const userTier = user.subscription_tier || 'free';
            const planLimits = PLANS[userTier]?.limits || PLANS.free.limits;

            // Current billing period
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

            // Upsert usage metrics
            const metrics = [
                { metric: 'listings_count', value: listingsCount.count, limit: planLimits.listings },
                { metric: 'orders_count', value: ordersCount.count, limit: planLimits.orders },
                { metric: 'automation_runs', value: automationsCount.count, limit: planLimits.automations },
                { metric: 'storage_mb', value: storageEstimate, limit: planLimits.storage_mb }
            ];

            for (const m of metrics) {
                await query.run(`
                    INSERT INTO plan_usage (id, user_id, metric, current_value, plan_limit, period_start, period_end, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, metric, period_start) DO UPDATE SET
                        current_value = ?,
                        plan_limit = ?,
                        updated_at = datetime('now')
                `, [
                    nanoid(),
                    user.id,
                    m.metric,
                    m.value,
                    m.limit,
                    periodStart,
                    periodEnd,
                    m.value,
                    m.limit
                ]);
            }

            return {
                status: 200,
                data: {
                    message: 'Usage metrics refreshed successfully',
                    metrics: metrics.map(m => ({
                        metric: m.metric,
                        current_value: m.value,
                        plan_limit: m.limit
                    }))
                }
            };
        }

        // POST /api/billing/change-plan - Change user's subscription plan
        if (method === 'POST' && path === '/change-plan') {
            const { planId } = body || {};

            if (!planId || !PLANS[planId]) {
                return { status: 400, data: { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` } };
            }

            const currentTier = user.subscription_tier || 'free';
            if (planId === currentTier) {
                return { status: 400, data: { error: 'You are already on this plan' } };
            }

            query.run('UPDATE users SET subscription_tier = ?, updated_at = datetime(?) WHERE id = ?',
                [planId, new Date().toISOString(), user.id]);

            logger.info(`[Billing] User ${user.id} changed plan: ${currentTier} → ${planId}`);

            return {
                status: 200,
                data: {
                    message: `Plan changed to ${PLANS[planId].display_name} successfully`,
                    plan: planId,
                    previous_plan: currentTier
                }
            };
        }

        // POST /api/billing/select-plan - Select a subscription plan
        if (method === 'POST' && path === '/select-plan') {
            const { planId } = body || {};

            if (!planId || !PLANS[planId]) {
                return { status: 400, data: { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` } };
            }

            const currentTier = user.subscription_tier || 'free';
            if (planId === currentTier) {
                return { status: 400, data: { error: 'You are already on this plan' } };
            }

            query.run('UPDATE users SET subscription_tier = ?, updated_at = datetime(?) WHERE id = ?',
                [planId, new Date().toISOString(), user.id]);

            logger.info(`[Billing] User ${user.id} selected plan: ${currentTier} → ${planId}`);

            return {
                status: 200,
                data: {
                    message: `Plan changed to ${PLANS[planId].display_name} successfully`,
                    plan: planId,
                    previous_plan: currentTier
                }
            };
        }

        // POST /api/billing/checkout — create Stripe Checkout session
        if (method === 'POST' && path === '/checkout') {
            const { planId, successUrl, cancelUrl } = body || {};

            if (!planId || !STRIPE_PRICE_IDS[planId]) {
                return { status: 400, data: { error: `Invalid planId. Paid plans: ${Object.keys(STRIPE_PRICE_IDS).join(', ')}` } };
            }

            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const resolvedSuccess = successUrl || `${appUrl}/#billing?upgraded=1`;
            const resolvedCancel  = cancelUrl  || `${appUrl}/#billing`;

            const session = await createCheckoutSession(user.id, STRIPE_PRICE_IDS[planId], resolvedSuccess, resolvedCancel);

            return { status: 200, data: { url: session.url, session_id: session.id } };
        }

        // POST /api/billing/portal — create Stripe Customer Portal session
        if (method === 'POST' && path === '/portal') {
            const dbUser = query.get('SELECT stripe_customer_id FROM users WHERE id = ?', [user.id]);
            if (!dbUser?.stripe_customer_id) {
                return { status: 400, data: { error: 'No Stripe customer found. Subscribe to a plan first.' } };
            }

            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const returnUrl = (body || {}).returnUrl || `${appUrl}/#billing`;

            const session = await createPortalSession(dbUser.stripe_customer_id, returnUrl);

            return { status: 200, data: { url: session.url } };
        }

        // POST /api/billing/cancel — cancel active Stripe subscription
        if (method === 'POST' && path === '/cancel') {
            const dbUser = query.get('SELECT stripe_subscription_id FROM users WHERE id = ?', [user.id]);
            if (!dbUser?.stripe_subscription_id) {
                return { status: 400, data: { error: 'No active subscription found.' } };
            }

            await cancelSubscription(dbUser.stripe_subscription_id);

            query.run(
                'UPDATE users SET subscription_tier = \'free\', stripe_subscription_id = NULL, subscription_expires_at = NULL, updated_at = datetime(\'now\') WHERE id = ?',
                [user.id]
            );

            logger.info(`[Billing] User ${user.id} cancelled subscription`);

            return { status: 200, data: { message: 'Subscription cancelled. You have been downgraded to the Free plan.' } };
        }

        // GET /api/billing/subscription — get current subscription details from Stripe
        if (method === 'GET' && path === '/subscription') {
            const dbUser = query.get(
                'SELECT subscription_tier, subscription_expires_at, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?',
                [user.id]
            );

            if (!dbUser?.stripe_subscription_id) {
                return {
                    status: 200,
                    data: {
                        tier: dbUser?.subscription_tier || 'free',
                        stripe_active: false,
                        subscription: null
                    }
                };
            }

            const subscription = await getSubscription(dbUser.stripe_subscription_id);

            return {
                status: 200,
                data: {
                    tier: dbUser.subscription_tier,
                    stripe_active: subscription.status === 'active',
                    subscription: {
                        id: subscription.id,
                        status: subscription.status,
                        current_period_end: subscription.current_period_end,
                        cancel_at_period_end: subscription.cancel_at_period_end
                    }
                }
            };
        }

        return { status: 404, data: { error: 'Endpoint not found' } };

    } catch (error) {
        logger.error('[Billing] Billing router error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
