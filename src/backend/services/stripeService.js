import Stripe from 'stripe';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia'
}) : null;

function requireStripe() {
    if (!stripe) throw new Error('Stripe is not configured — set STRIPE_SECRET_KEY in .env');
    return stripe;
}

// Placeholder Price IDs — replace with real IDs after creating products in Stripe Dashboard
export const STRIPE_PRICE_IDS = {
    starter:  process.env.STRIPE_PRICE_STARTER  || 'price_starter_placeholder',
    pro:      process.env.STRIPE_PRICE_PRO       || 'price_pro_placeholder',
    business: process.env.STRIPE_PRICE_BUSINESS  || 'price_business_placeholder'
};

export const TIER_FOR_PRICE = Object.fromEntries(
    Object.entries(STRIPE_PRICE_IDS).map(([tier, priceId]) => [priceId, tier])
);

export async function createCustomer(userId, email) {
    try {
        const customer = await requireStripe().customers.create({ email, metadata: { vaultlister_user_id: userId } });
        query.run('UPDATE users SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
            [customer.id, userId]);
        logger.info(`[Stripe] Created customer ${customer.id} for user ${userId}`);
        return customer;
    } catch (error) {
        logger.error('[Stripe] createCustomer failed', userId, { detail: error.message });
        throw error;
    }
}

export async function createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
    try {
        let user = query.get('SELECT id, email, stripe_customer_id FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('User not found');

        let customerId = user.stripe_customer_id;
        if (!customerId) {
            const customer = await createCustomer(userId, user.email);
            customerId = customer.id;
        }

        const session = await requireStripe().checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { vaultlister_user_id: userId }
        });

        logger.info(`[Stripe] Checkout session ${session.id} created for user ${userId}`);
        return session;
    } catch (error) {
        logger.error('[Stripe] createCheckoutSession failed', userId, { detail: error.message });
        throw error;
    }
}

export async function createPortalSession(customerId, returnUrl) {
    try {
        const session = await requireStripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl
        });
        return session;
    } catch (error) {
        logger.error('[Stripe] createPortalSession failed', null, { detail: error.message });
        throw error;
    }
}

export async function cancelSubscription(subscriptionId) {
    try {
        const subscription = await requireStripe().subscriptions.cancel(subscriptionId);
        logger.info(`[Stripe] Subscription ${subscriptionId} cancelled`);
        return subscription;
    } catch (error) {
        logger.error('[Stripe] cancelSubscription failed', null, { detail: error.message });
        throw error;
    }
}

export async function getSubscription(subscriptionId) {
    try {
        return await requireStripe().subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product']
        });
    } catch (error) {
        logger.error('[Stripe] getSubscription failed', null, { detail: error.message });
        throw error;
    }
}

export function constructWebhookEvent(rawBody, signature) {
    return requireStripe().webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
    );
}
