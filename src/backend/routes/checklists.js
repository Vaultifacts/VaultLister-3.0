// Checklists Routes
import { query } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger.js';

export async function checklistsRouter(ctx) {
    const { method, path, body, user } = ctx;

    // Predefined checklist templates
    const TEMPLATES = {
        'daily-shipping': {
            id: 'daily-shipping',
            name: 'Daily Shipping Routine',
            description: 'Standard checklist for daily shipping operations',
            items: [
                { title: 'Print shipping labels', priority: 'high' },
                { title: 'Pack items securely', priority: 'high' },
                { title: 'Verify addresses', priority: 'high' },
                { title: 'Update tracking numbers', priority: 'normal' },
                { title: 'Schedule pickup or drop-off', priority: 'normal' },
                { title: 'Send shipping notifications', priority: 'low' }
            ]
        },
        'new-listing': {
            id: 'new-listing',
            name: 'New Listing Checklist',
            description: 'Steps for creating a new product listing',
            items: [
                { title: 'Take high-quality photos', priority: 'high' },
                { title: 'Write detailed description', priority: 'high' },
                { title: 'Research competitive pricing', priority: 'high' },
                { title: 'Set SKU and inventory count', priority: 'normal' },
                { title: 'Add relevant tags/categories', priority: 'normal' },
                { title: 'Double-check listing details', priority: 'normal' },
                { title: 'Publish listing', priority: 'low' }
            ]
        },
        'weekly-inventory': {
            id: 'weekly-inventory',
            name: 'Weekly Inventory Audit',
            description: 'Routine inventory check and reconciliation',
            items: [
                { title: 'Count physical inventory', priority: 'high' },
                { title: 'Compare with system records', priority: 'high' },
                { title: 'Update discrepancies', priority: 'high' },
                { title: 'Check for damaged items', priority: 'normal' },
                { title: 'Identify slow-moving stock', priority: 'normal' },
                { title: 'Plan restocking orders', priority: 'low' }
            ]
        },
        'end-of-day': {
            id: 'end-of-day',
            name: 'End of Day Closeout',
            description: 'Daily wrap-up and reconciliation tasks',
            items: [
                { title: 'Process pending orders', priority: 'high' },
                { title: 'Review customer messages', priority: 'high' },
                { title: 'Update inventory counts', priority: 'normal' },
                { title: 'Reconcile payments', priority: 'normal' },
                { title: 'Back up important data', priority: 'normal' },
                { title: 'Plan tomorrow\'s tasks', priority: 'low' }
            ]
        }
    };

    // GET /api/checklists/templates - List available templates
    if (method === 'GET' && path === '/templates') {
        try {
            const templates = Object.values(TEMPLATES).map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                itemCount: t.items.length
            }));
            return { status: 200, data: { templates } };
        } catch (error) {
            logger.error('[Checklists] Error listing templates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/checklists/from-template - Create checklist from template
    if (method === 'POST' && path === '/from-template') {
        const { template_id, name } = body;

        if (!template_id || !TEMPLATES[template_id]) {
            return { status: 400, data: { error: 'Invalid template_id' } };
        }

        const template = TEMPLATES[template_id];
        const checklistId = uuidv4();
        const now = new Date().toISOString();

        try {
            const itemIds = [];
            await query.transaction(async () => {
                // Create the checklist
                await query.run(
                    `INSERT INTO checklists (id, user_id, name, description, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [checklistId, user.id, name || template.name, template.description, now, now]
                );

                // Create all items from template
                for (const item of template.items) {
                    const itemId = uuidv4();
                    await query.run(
                        `INSERT INTO checklist_items
                         (id, checklist_id, user_id, title, priority, due_date, recurring_interval, notes, attachments, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [itemId, checklistId, user.id, item.title, item.priority, null, 'once', '', '[]', now, now]
                    );
                    itemIds.push(itemId);
                }
            });

            return { status: 201, data: { checklistId, itemCount: itemIds.length } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to create checklist from template' } };
        }
    }

    // GET /api/checklists/shares - List shares for current user
    if (method === 'GET' && path === '/shares') {
        try {
            const shares = await query.all(
                `SELECT * FROM checklist_shares WHERE user_id = ? ORDER BY created_at DESC`,
                [user.id]
            );
            return { status: 200, data: { shares } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to fetch shares' } };
        }
    }

    // POST /api/checklists/share - Share checklist with someone
    if (method === 'POST' && path === '/share') {
        const { shared_with, permission } = body;
        if (!shared_with) {
            return { status: 400, data: { error: 'shared_with is required' } };
        }
        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            await query.run(
                'INSERT INTO checklist_shares (id, user_id, shared_with, permission, created_at) VALUES (?, ?, ?, ?, ?)',
                [id, user.id, shared_with, permission || 'view', now]
            );
            return { status: 201, data: { id, shared_with, permission: permission || 'view' } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to share checklist' } };
        }
    }

    // DELETE /api/checklists/shares/:id - Remove a share
    if (method === 'DELETE' && path.match(/^\/shares\/[a-f0-9-]+$/)) {
        const shareId = path.split('/')[2];
        try {
            const result = await query.run(
                `DELETE FROM checklist_shares WHERE id = ? AND user_id = ?`,
                [shareId, user.id]
            );
            if (result.changes === 0) {
                return { status: 404, data: { error: 'Share not found' } };
            }
            return { status: 200, data: { message: 'Share removed' } };
        } catch (err) {
            return { status: 500, data: { error: 'Failed to remove share' } };
        }
    }

    // GET /api/checklists/items - Get all checklist items (no checklist grouping for now)
    if (method === 'GET' && path === '/items') {
        try {
            const items = await query.all(
                `SELECT * FROM checklist_items
                 WHERE user_id = ?
                 ORDER BY completed ASC, priority DESC, created_at ASC
                 LIMIT 500`,
                [user.id]
            );
            return { status: 200, data: { items } };
        } catch (error) {
            logger.error('[Checklists] Error fetching items', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/checklists/items - Create checklist item
    if (method === 'POST' && path === '/items') {
        try {
            const { checklistId, title, priority, dueDate, recurringInterval, notes, attachments } = body;
            const id = uuidv4();
            const now = new Date().toISOString();

            await query.run(
                `INSERT INTO checklist_items
                 (id, checklist_id, user_id, title, priority, due_date, recurring_interval, notes, attachments, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, checklistId || null, user.id, title, priority || 'normal', dueDate || null, recurringInterval || 'once', notes || '', JSON.stringify(attachments || []), now, now]
            );

            return { status: 201, data: { id, title } };
        } catch (error) {
            logger.error('[Checklists] Error creating item', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PATCH /api/checklists/items/:id - Update item (toggle completion or full edit)
    if (method === 'PATCH' && path.match(/^\/items\/[a-f0-9-]+$/)) {
        try {
            const itemId = path.split('/')[2];
            const { completed, title, priority, due_date, recurring_interval, notes, attachments } = body;
            const now = new Date().toISOString();

            // Build dynamic update query based on provided fields
            const updates = [];
            const params = [];

            if (completed !== undefined) {
                updates.push('completed = ?', 'last_completed_at = ?');
                params.push(completed ? 1 : 0, completed ? now : null);
            }
            if (title !== undefined) {
                updates.push('title = ?');
                params.push(title);
            }
            if (priority !== undefined) {
                updates.push('priority = ?');
                params.push(priority);
            }
            if (due_date !== undefined) {
                updates.push('due_date = ?');
                params.push(due_date || null);
            }
            if (recurring_interval !== undefined) {
                updates.push('recurring_interval = ?');
                params.push(recurring_interval);
            }
            if (notes !== undefined) {
                updates.push('notes = ?');
                params.push(notes);
            }
            if (attachments !== undefined) {
                updates.push('attachments = ?');
                params.push(JSON.stringify(attachments));
            }

            updates.push('updated_at = ?');
            params.push(now);
            params.push(itemId, user.id);

            await query.run(
                `UPDATE checklist_items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                params
            );

            return { status: 200, data: { id: itemId, message: 'Item updated' } };
        } catch (error) {
            logger.error('[Checklists] Error updating item', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/checklists/items/:id - Delete item
    if (method === 'DELETE' && path.match(/^\/items\/[a-f0-9-]+$/)) {
        try {
            const itemId = path.split('/')[2];

            await query.run(
                `DELETE FROM checklist_items WHERE id = ? AND user_id = ?`,
                [itemId, user.id]
            );

            return { status: 200, data: { message: 'Item deleted' } };
        } catch (error) {
            logger.error('[Checklists] Error deleting item', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/checklists/:id/items - Get checklist items
    if (method === 'GET' && path.match(/^\/[^\/]+\/items$/)) {
        try {
            const checklistId = path.match(/^\/([^\/]+)\/items$/)[1];
            const items = await query.all(
                `SELECT * FROM checklist_items
                 WHERE checklist_id = ? AND user_id = ?
                 ORDER BY completed ASC, priority DESC, created_at ASC`,
                [checklistId, user.id]
            );
            return { status: 200, data: { items } };
        } catch (error) {
            logger.error('[Checklists] Error fetching checklist items', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/checklists - List user's checklists
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const checklists = await query.all(
                `SELECT * FROM checklists WHERE user_id = ? ORDER BY created_at DESC`,
                [user.id]
            );
            return { status: 200, data: { checklists } };
        } catch (error) {
            logger.error('[Checklists] Error listing checklists', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/checklists - Create checklist
    if (method === 'POST' && (path === '/' || path === '')) {
        try {
            const { name, description } = body;
            const id = uuidv4();
            const now = new Date().toISOString();

            await query.run(
                `INSERT INTO checklists (id, user_id, name, description, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, user.id, name, description, now, now]
            );

            return { status: 201, data: { id, name, description } };
        } catch (error) {
            logger.error('[Checklists] Error creating checklist', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
