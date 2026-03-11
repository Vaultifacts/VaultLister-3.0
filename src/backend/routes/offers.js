// Offers Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { websocketService } from '../services/websocket.js';

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
        params.push(parseInt(limit), parseInt(offset));

        const offers = query.all(sql, params);

        offers.forEach(offer => {
            try { offer.item_images = JSON.parse(offer.item_images || '[]'); } catch { offer.item_images = []; }
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

        const total = query.get(countSql, countParams)?.count || 0;
        const pending = query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'pending'])?.count || 0;

        return { status: 200, data: { offers, total, pending } };
    }

    // GET /api/offers/:id - Get single offer
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const id = path.slice(1);
        const offer = query.get(`
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

        try { offer.item_images = JSON.parse(offer.item_images || '[]'); } catch (e) { offer.item_images = []; }
        offer.percentage = offer.listing_price > 0 ? Math.round((offer.offer_amount / offer.listing_price) * 100) : 0;

        return { status: 200, data: { offer } };
    }

    // POST /api/offers/:id/accept - Accept offer
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/accept$/)) {
        const id = path.split('/')[1];

        // Check offer exists first
        const existingOffer = query.get('SELECT id, status FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existingOffer) {
            return { status: 404, data: { error: 'Offer not found' } };
        }
        if (existingOffer.status !== 'pending') {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        // Atomic UPDATE with WHERE status = 'pending' to prevent TOCTOU race condition
        const result = query.run(
            'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = ?',
            ['accepted', id, user.id, 'pending']
        );

        if (result.changes === 0) {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        const offer = query.get(`
            SELECT o.*, l.id as listing_id, l.price as listing_price
            FROM offers o
            LEFT JOIN listings l ON o.listing_id = l.id
            WHERE o.id = ? AND o.user_id = ?
        `, [id, user.id]);

        // Best-effort sale creation — failure must not block the 200 response
        try {
            const saleId = uuidv4();
            query.run(
                `INSERT INTO sales (id, user_id, listing_id, platform, buyer_username, sale_price, platform_fee, shipping_cost, customer_shipping_cost, seller_shipping_cost, item_cost, tax_amount, net_profit, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, 'confirmed', CURRENT_TIMESTAMP)`,
                [saleId, user.id, offer.listing_id, offer.platform, offer.buyer_username, offer.offer_amount, offer.offer_amount]
            );
            query.run(
                `UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'sold'`,
                [offer.listing_id]
            );
        } catch (saleErr) {
            logger.warn('Best-effort sale creation failed for offer ' + id + ': ' + saleErr.message);
        }

        // Queue automation task to accept on platform
        const taskId = uuidv4();
        query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'accept_offer', JSON.stringify({ offerId: id, platform: offer.platform }), 'pending']);

        websocketService.notifyOfferAccepted(user.id, offer);

        return { status: 200, data: { message: 'Offer accepted', taskId } };
    }

    // POST /api/offers/:id/decline - Decline offer
    if (method === 'POST' && path.match(/^\/[a-f0-9-]+\/decline$/)) {
        const id = path.split('/')[1];

        // Check offer exists first
        const existingOffer = query.get('SELECT id, status FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existingOffer) {
            return { status: 404, data: { error: 'Offer not found' } };
        }
        if (existingOffer.status !== 'pending') {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        // Atomic UPDATE with WHERE status = 'pending' to prevent TOCTOU race condition
        const result = query.run(
            'UPDATE offers SET status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = ?',
            ['declined', id, user.id, 'pending']
        );

        if (result.changes === 0) {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        const offer = query.get('SELECT * FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);

        // Queue automation task
        const taskId = uuidv4();
        query.run(`
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

        // Check offer exists first
        const existingOffer = query.get('SELECT id, status FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existingOffer) {
            return { status: 404, data: { error: 'Offer not found' } };
        }
        if (existingOffer.status !== 'pending') {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        // Atomic UPDATE with WHERE status = 'pending' to prevent TOCTOU race condition
        const result = query.run(
            'UPDATE offers SET status = ?, counter_amount = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = ?',
            ['countered', amount, id, user.id, 'pending']
        );

        if (result.changes === 0) {
            return { status: 400, data: { error: 'Offer has already been responded to' } };
        }

        const offer = query.get('SELECT * FROM offers WHERE id = ? AND user_id = ?', [id, user.id]);

        // Queue automation task
        const taskId = uuidv4();
        query.run(`
            INSERT INTO tasks (id, user_id, type, payload, status)
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, user.id, 'counter_offer', JSON.stringify({ offerId: id, amount, platform: offer.platform }), 'pending']);

        websocketService.notify(user.id, { type: 'offer.countered', offer });

        return { status: 200, data: { message: 'Counter offer sent', taskId } };
    }

    // GET /api/offers/rules - Get offer rules
    if (method === 'GET' && path === '/rules') {
        const rules = query.all(
            'SELECT * FROM automation_rules WHERE user_id = ? AND type = ?',
            [user.id, 'offer']
        );

        rules.forEach(rule => {
            try { rule.conditions = JSON.parse(rule.conditions || '{}'); } catch (e) { rule.conditions = {}; }
            try { rule.actions = JSON.parse(rule.actions || '{}'); } catch (e) { rule.actions = {}; }
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

        query.run(`
            INSERT INTO automation_rules (id, user_id, name, type, platform, conditions, actions, is_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, name, 'offer', platform,
            JSON.stringify(conditions), JSON.stringify(actions),
            isEnabled !== false ? 1 : 0
        ]);

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        try {
            rule.conditions = JSON.parse(rule.conditions);
        } catch (e) {
            rule.conditions = [];
        }
        try {
            rule.actions = JSON.parse(rule.actions);
        } catch (e) {
            rule.actions = {};
        }

        return { status: 201, data: { rule } };
    }

    // PUT /api/offers/rules/:id - Update offer rule
    if (method === 'PUT' && path.match(/^\/rules\/[a-f0-9-]+$/)) {
        const id = path.split('/')[2];

        const existing = query.get(
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
            values.push(id);
            query.run(
                `UPDATE automation_rules SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );
        }

        const rule = query.get('SELECT * FROM automation_rules WHERE id = ?', [id]);
        try {
            rule.conditions = JSON.parse(rule.conditions);
        } catch (e) {
            rule.conditions = [];
        }
        try {
            rule.actions = JSON.parse(rule.actions);
        } catch (e) {
            rule.actions = {};
        }

        return { status: 200, data: { rule } };
    }

    // DELETE /api/offers/rules/:id - Delete offer rule
    if (method === 'DELETE' && path.match(/^\/rules\/[a-f0-9-]+$/)) {
        const id = path.split('/')[2];

        const existing = query.get(
            'SELECT * FROM automation_rules WHERE id = ? AND user_id = ? AND type = ?',
            [id, user.id, 'offer']
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        query.run('DELETE FROM automation_rules WHERE id = ? AND user_id = ?', [id, user.id]);

        return { status: 200, data: { message: 'Rule deleted' } };
    }

    // GET /api/offers/stats - Get offer statistics
    if (method === 'GET' && path === '/stats') {
        const stats = {
            total: query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ?', [user.id])?.count || 0,
            pending: query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'pending'])?.count || 0,
            accepted: query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'accepted'])?.count || 0,
            declined: query.get('SELECT COUNT(*) as count FROM offers WHERE user_id = ? AND status = ?', [user.id, 'declined'])?.count || 0,
            avgOfferPercentage: query.get(`
                SELECT AVG(o.offer_amount * 100.0 / l.price) as avg
                FROM offers o
                JOIN listings l ON o.listing_id = l.id
                WHERE o.user_id = ?
            `, [user.id])?.avg || 0,
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
