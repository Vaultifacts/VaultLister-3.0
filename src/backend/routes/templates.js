// Listing Templates Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { cacheForUser } from '../middleware/cache.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function templatesRouter(ctx) {
    const { method, path, user } = ctx;

    // GET /api/templates - Get all templates for user
    if (method === 'GET' && (path === '' || path === '/')) {
        const templates = query.all(
            'SELECT * FROM listing_templates WHERE user_id = ? ORDER BY is_favorite DESC, use_count DESC, created_at DESC LIMIT 500',
            [user.id]
        );

        // Parse JSON fields
        templates.forEach(template => {
            template.tags = safeJsonParse(template.tags, []);
            template.platform_settings = safeJsonParse(template.platform_settings, {});
        });

        return { status: 200, data: templates, cacheControl: cacheForUser(300) };
    }

    // GET /api/templates/:id - Get single template
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !path.startsWith('/use')) {
        const templateId = path.substring(1);
        const template = query.get('SELECT * FROM listing_templates WHERE id = ? AND user_id = ?', [templateId, user.id]);

        if (!template) {
            return { status: 404, data: { error: 'Template not found' } };
        }

        // Parse JSON fields
        template.tags = safeJsonParse(template.tags, []);
        template.platform_settings = safeJsonParse(template.platform_settings, {});

        return { status: 200, data: template };
    }

    // POST /api/templates - Create new template
    if (method === 'POST' && (path === '' || path === '/')) {
        const {
            name,
            description,
            category,
            titlePattern,
            descriptionTemplate,
            tags,
            pricingStrategy,
            markupPercentage,
            platformSettings,
            shippingProfileId,
            conditionDefault,
            isFavorite
        } = ctx.body;

        if (!name) {
            return { status: 400, data: { error: 'Template name is required' } };
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        query.run(`
            INSERT INTO listing_templates (
                id, user_id, name, description, category,
                title_pattern, description_template, tags,
                pricing_strategy, markup_percentage,
                platform_settings, shipping_profile_id,
                condition_default, is_favorite, use_count,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.id, name, description || null, category || null,
            titlePattern || null, descriptionTemplate || null, JSON.stringify(tags || []),
            pricingStrategy || 'fixed', markupPercentage || 0,
            JSON.stringify(platformSettings || {}), shippingProfileId || null,
            conditionDefault || null, isFavorite ? 1 : 0, 0,
            now, now
        ]);

        const template = query.get('SELECT * FROM listing_templates WHERE id = ?', [id]);

        // Parse JSON fields for response
        template.tags = safeJsonParse(template.tags, []);
        template.platform_settings = safeJsonParse(template.platform_settings, {});

        return { status: 201, data: template };
    }

    // PUT /api/templates/:id - Update template
    if (method === 'PUT' && path.match(/^\/[a-zA-Z0-9_-]+$/)) {
        const templateId = path.substring(1);

        // Verify ownership
        const existing = query.get('SELECT id FROM listing_templates WHERE id = ? AND user_id = ?', [templateId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Template not found' } };
        }

        const {
            name,
            description,
            category,
            titlePattern,
            descriptionTemplate,
            tags,
            pricingStrategy,
            markupPercentage,
            platformSettings,
            shippingProfileId,
            conditionDefault,
            isFavorite
        } = ctx.body;

        const updates = [];
        const values = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (category !== undefined) { updates.push('category = ?'); values.push(category); }
        if (titlePattern !== undefined) { updates.push('title_pattern = ?'); values.push(titlePattern); }
        if (descriptionTemplate !== undefined) { updates.push('description_template = ?'); values.push(descriptionTemplate); }
        if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
        if (pricingStrategy !== undefined) { updates.push('pricing_strategy = ?'); values.push(pricingStrategy); }
        if (markupPercentage !== undefined) { updates.push('markup_percentage = ?'); values.push(markupPercentage); }
        if (platformSettings !== undefined) { updates.push('platform_settings = ?'); values.push(JSON.stringify(platformSettings)); }
        if (shippingProfileId !== undefined) { updates.push('shipping_profile_id = ?'); values.push(shippingProfileId); }
        if (conditionDefault !== undefined) { updates.push('condition_default = ?'); values.push(conditionDefault); }
        if (isFavorite !== undefined) { updates.push('is_favorite = ?'); values.push(isFavorite ? 1 : 0); }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());

        values.push(templateId, user.id);

        query.run(
            `UPDATE listing_templates SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            values
        );

        const template = query.get('SELECT * FROM listing_templates WHERE id = ?', [templateId]);

        // Parse JSON fields
        template.tags = safeJsonParse(template.tags, []);
        template.platform_settings = safeJsonParse(template.platform_settings, {});

        return { status: 200, data: template };
    }

    // DELETE /api/templates/:id - Delete template
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/)) {
        const templateId = path.substring(1);

        const result = query.run('DELETE FROM listing_templates WHERE id = ? AND user_id = ?', [templateId, user.id]);

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Template not found' } };
        }

        return { status: 200, data: { message: 'Template deleted successfully' } };
    }

    // POST /api/templates/:id/use - Increment use count when template is applied
    if (method === 'POST' && path.match(/^\/[a-zA-Z0-9_-]+\/use$/)) {
        const templateId = path.replace('/use', '').substring(1);

        query.run(
            'UPDATE listing_templates SET use_count = use_count + 1, updated_at = ? WHERE id = ? AND user_id = ?',
            [new Date().toISOString(), templateId, user.id]
        );

        return { status: 200, data: { message: 'Template use count updated' } };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
