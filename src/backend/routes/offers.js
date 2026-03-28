// Offers Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { websocketService } from '../services/websocket.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

const ALLOWED_RULE_FIELDS = new Set(['name', 'platform', 'conditions', 'actions', 'isEnabled']);

export async function offersRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/offers - List all offers
    if (method === 'GET' && (path === '/' || path === '')) {
        const { platform, status, limit = 50, offset = 0 } = queryParams;

        let sql = `
            SELECT o.*, l.title as listing_title, l.price as listing_price, i.images as item_images
            FROM offers o
            LEFT JOIN listings l ON o.listing_id = l.id
            LEFT JOIN inventory i ON l.inventory_id = i.id
            WHERE o.user_id = ? AND (i.id IS NULL OR i.status != 'deleted')
        `;
        const params = [user.id];

        if (platform) {
            sql += ' AND o.platform = ?';
            params.push(platform);
        }

        if (status) {
            sql += ' AND o.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

        const offers = await query.all(sql, params);

        offers.forEach(offer => {
            offer.item_images = safeJsonParse(offer.item_images, []);
            // Calculate offer percentage
            if (offer.listing_price && offer.offer_amount != null) {
                offer.percentage = offer.listing_price > 0 ? Math.round((offer.offer_amount / offer.listing_price) * 100) : 0;
            }
        });

        // Build COUNT query with same filters as main query
        let countSql = 'SELECT COUNT(*) as count FROM offers WHERE user_id = ?';
        const countParams = [user.id];

        if (platform) {
            countSql += ' AND platform = ?';
            countParams.push(platform);
        }

        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }

        const total = Number((await query.get(countSql, countParams))?.count) || 0;
        const pending = Number((await query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'pending']))?.count) || 0;

        return { status: 200, data: { offers, total, pending } };
    }

    // GET /api/offers/:id - Get single offer
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const offer = await query.get(`
            SELECT o.*, l.title as listing_title, l.price as listing_price, l.description,
                   i.images as item_images, i.brand, i.category
            FROM offers o
            LEFT JOIN listings l ON o.listing_id = l.id
            LEFT JOIN inventory i ON l.inventory_id = i.id
            WHERE o.id = ? AND o.user_id = ? AND (i.id IS NULL OR i.status != 'deleted')
        `, [id, user.id]);

        if (!offer) {
            return { status: 404, data: { error: 'Offer not found' } };
        }

        offer.item_images = safeJsonParse(offer.item_images, []);
        offer.percentage = offer.listing_price > 0 ? Math.round((offer.offer_amount / offer.listing_price) * 100) : 0;

        return { status: 200, data: { offer } };
    }

    // POST /api/offers/:id/accept - Accept offer
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/accept$/)) {
        const id = path.split('/')[1];

        // Pre-flight: verify offer exists before opening a transaction
        const preCheck = await query.get('SELECT id FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!preCheck) {
            return { status: 404, data: { error: 'Offer not found' } };
        }

        let offer;
        try {
            offer = await query.transaction(async (tx) => {
                // Lock the row to prevent concurrent accept/decline/counter
                const locked = await tx.get(
                    'SELECT id, status, listing_id, platform, buyer_username, offer_amount FROM offers WHERE id = ? AND user_id = ? FOR UPDATE',
                    [id, user.id]
                );

                if (!locked) {
                    const err = new Error('OFFER_NOT_FOUND');
                    err.status = 404;
                    throw err;
                }
                if (locked.status !== 'pending') {
                    const err = new Error('OFFER_ALREADY_PROCESSED');
                    err.status = 409;
                    throw err;
                }

                await tx.run(
                    'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    ['accepted', id, user.id]
                );

                // Create sale atomically within the same transaction
                const saleId = uuidv4();
                await tx.run(
                    `INSERT INTO sales (id, user_id, listing_id, platform, buyer_username, sale_price, platform_fee, shipping_cost, customer_shipping_cost, seller_shipping_cost, item_cost, tax_amount, net_profit, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, 'confirmed', CURRENT_TIMESTAMP)`,
                    [saleId, user.id, locked.listing_id, locked.platform, locked.buyer_username, locked.offer_amount, locked.offer_amount]
                );
                await tx.run(
                    `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'sold'`,
                    [locked.listing_id]
                );

                return locked;
            });
        } catch (err) {
            if (err.message === 'OFFER_NOT_FOUND') return { status: 404, data: { error: 'Offer not found' } };
            if (err.message === 'OFFER_ALREADY_PROCESSED') return { status: 409, data: { error: 'Offer has already been processed' } };
            logger.error('[Offers] Accept transaction failed', user?.id, { detail: err?.message });
            throw err;
        }

        // Queue automation task to accept on platform
        const taskId = uuidv4();
        await query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'accept_offer', JSON.stringify({ offerId: id, platform: offer.platform }), 'pending']);

        websocketService.notifyOfferAccepted(user.id, offer);

        return { status: 200, data: { message: 'Offer accepted', taskId } };
    }

    // POST /api/offers/:id/decline - Decline offer
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/decline$/)) {
        const id = path.split('/')[1];

        // Pre-flight: verify offer exists before opening a transaction
        const preCheck = await query.get('SELECT id FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!preCheck) {
            return { status: 404, data: { error: 'Offer not found' } };
        }

        let offer;
        try {
            offer = await query.transaction(async (tx) => {
                // Lock the row to prevent concurrent accept/decline/counter
                const locked = await tx.get(
                    'SELECT id, status, platform FROM offers WHERE id = ? AND user_id = ? FOR UPDATE',
                    [id, user.id]
                );

                if (!locked) {
                    const err = new Error('OFFER_NOT_FOUND');
                    err.status = 404;
                    throw err;
                }
                if (locked.status !== 'pending') {
                    const err = new Error('OFFER_ALREADY_PROCESSED');
                    err.status = 409;
                    throw err;
                }

                await tx.run(
                    'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    ['declined', id, user.id]
                );

                return locked;
            });
        } catch (err) {
            if (err.message === 'OFFER_NOT_FOUND') return { status: 404, data: { error: 'Offer not found' } };
            if (err.message === 'OFFER_ALREADY_PROCESSED') return { status: 409, data: { error: 'Offer has already been processed' } };
            logger.error('[Offers] Decline transaction failed', user?.id, { detail: err?.message });
            throw err;
        }

        // Queue automation task
        const taskId = uuidv4();
        await query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'decline_offer', JSON.stringify({ offerId: id, platform: offer.platform }), 'pending']);

        websocketService.notifyOfferDeclined(user.id, offer);

        return { status: 200, data: { message: 'Offer declined', taskId } };
    }

    // POST /api/offers/:id/counter - Counter offer
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/counter$/)) {
        const id = path.split('/')[1];
        const { amount } = body;

        if (amount === undefined || amount === null) {
            return { status: 400, data: { error: 'Counter amount is required' } };
        }
        if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0 || amount > 999999.99) {
            return { status: 400, data: { error: 'Counter amount must be a valid positive number' } };
        }

        // Pre-flight: verify offer exists before opening a transaction
        const preCheck = await query.get('SELECT id FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!preCheck) {
            return { status: 404, data: { error: 'Offer not found' } };
        }

        let offer;
        try {
            offer = await query.transaction(async (tx) => {
                // Lock the row to prevent concurrent accept/decline/counter
                const locked = await tx.get(
                    'SELECT id, status, platform FROM offers WHERE id = ? AND user_id = ? FOR UPDATE',
                    [id, user.id]
                );

                if (!locked) {
                    const err = new Error('OFFER_NOT_FOUND');
                    err.status = 404;
                    throw err;
                }
                if (locked.status !== 'pending') {
                    const err = new Error('OFFER_ALREADY_PROCESSED');
                    err.status = 409;
                    throw err;
                }

                await tx.run(
                    'UPDATE offers SET status = ?, counter_amount = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    ['countered', amount, id, user.id]
                );

                return locked;
            });
        } catch (err) {
            if (err.message === 'OFFER_NOT_FOUND') return { status: 404, data: { error: 'Offer not found' } };
            if (err.message === 'OFFER_ALREADY_PROCESSED') return { status: 409, data: { error: 'Offer has already been processed' } };
            logger.error('[Offers] Counter transaction failed', user?.id, { detail: err?.message });
            throw err;
        }

        // Queue automation task
        const taskId = uuidv4();
        await query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'counter_offer', JSON.stringify({ offerId: id, amount, platform: offer.platform }), 'pending']);

        websocketService.notify(user.id, { type: 'offer.countered', offer });

        return { status: 200, data: { message: 'Counter offer sent', taskId } };
    }

    // POST /api/offers/seed - Seed a test offer (test-mode only)
    if (method === 'POST' && path === '/seed') {
        if (process.env.DISABLE_CSRF !== 'true' && process.env.NODE_ENV !== 'test') {
            return { status: 404, data: { error: 'Route not found' } };
        }

        const { listing_id, platform, offer_amount, buyer_username } = body;
        if (!listing_id || !platform || !offer_amount) {
            return { status: 400, data: { error: 'listing_id, platform, and offer_amount are required' } };
        }

        const id = uuidv4();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await query.run(
            `INSERT INTO offers (id, user_id, listing_id, platform, offer_amount, buyer_username, status, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            [id, user.id, listing_id, platform, offer_amount, buyer_username || 'e2e_buyer', expires]
        );

        const offer = await query.get('SELECT * FROM offers WHERE id = ?', [id]);
        return { status: 201, data: { offer } };
    }

    // GET /api/offers/rules - Get offer rules
    if (method === 'GET' && path === '/rules') {
        const rules = await query.all(
            'SELECT * FROM automation_rules WHERE user_id = ? AND type = ?',
            [user.id, 'offer']
        );

        rules.forEach(rule => {
            rule.conditions = safeJsonParse(rule.conditions, {});
            rule.actions = safeJsonParse(rule.actions, {});
        });

        return { status: 200, data: { rules } };
    }

    // POST /api/offers/rules - Create offer rule
    if (method === 'POST' && path === '/rules') {
        const { name, platform, conditions, actions, isEnabled } = body;

        if (!name || !conditions || !actions) {
            return { status: 400, data: { error: 'Name, conditions, and actions required' } };
        }

        const id = uuidv4();

        await query.run(`
            INSERT INTO automation_rules (id, user_id, name, type, platform, conditions, actions, is_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, name, 'offer', platform,
            JSON.stringify(conditions), JSON.stringify(actions),
            isEnabled !== false ? 1 : 0
        ]);

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        rule.conditions = safeJsonParse(rule.conditions, []);
        rule.actions = safeJsonParse(rule.actions, {});

        return { status: 201, data: { rule } };
    }

    // PUT /api/offers/rules/:id - Update offer rule
    if (method === 'PUT' && path.match(/^\/rules\/[a-f0-9-]+$/)) {
        const id = path.split('/')[2];

        const existing = await query.get(
            'SELECT * FROM automation_rules WHERE id = ? AND user_id = ? AND type = ?',
            [id, user.id, 'offer']
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const { name, platform, conditions, actions, isEnabled } = body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }

        if (platform !== undefined) {
            updates.push('platform = ?');
            values.push(platform);
        }

        if (conditions !== undefined) {
            updates.push('conditions = ?');
            values.push(JSON.stringify(conditions));
        }

        if (actions !== undefined) {
            updates.push('actions = ?');
            values.push(JSON.stringify(actions));
        }

        if (isEnabled !== undefined) {
            updates.push('is_enabled = ?');
            values.push(isEnabled ? 1 : 0);
        }

        if (updates.length > 0) {
            values.push(id, user.id);
            await query.run(
                `UPDATE automation_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );
        }

        const rule = await query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        rule.conditions = safeJsonParse(rule.conditions, []);
        rule.actions = safeJsonParse(rule.actions, {});

        return { status: 200, data: { rule } };
    }

    // DELETE /api/offers/rules/:id - Delete offer rule
    if (method === 'DELETE' && path.match(/^\/rules\/[a-f0-9-]+$/)) {
        const id = path.split('/')[2];

        const existing = await query.get(
            'SELECT * FROM automation_rules WHERE id = ? AND user_id = ? AND type = ?',
            [id, user.id, 'offer']
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        await query.run('DELETE FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { message: 'Rule deleted' } };
    }

    // GET /api/offers/stats - Get offer statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            total: Number((await query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ?', [user.id]))?.count) || 0,
            pending: Number((await query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'pending']))?.count) || 0,
            accepted: Number((await query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'accepted']))?.count) || 0,
            declined: Number((await query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'declined']))?.count) || 0,
            avgOfferPercentage: Number((await query.get(`
                SELECT AVG(o.offer_amount * 100.0 / l.price) as avg
                FROM offers o
                JOIN listings l ON o.listing_id = l.id
                WHERE o.user_id = ?
            `, [user.id]))?.avg) || 0,
            acceptRate: 0
        };

        const responded = stats.accepted + stats.declined;
        if (responded > 0) {
            stats.acceptRate = Math.round((stats.accepted / responded) * 100);
        }

        return { status: 200, data: { stats } };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
