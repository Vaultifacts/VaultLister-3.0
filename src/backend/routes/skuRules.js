// SKU Rules Routes
// Pattern-based SKU generation system
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

// Category abbreviation mapping
const categoryAbbreviations = {
    'tops': 'TOP',
    'bottoms': 'BTM',
    'dresses': 'DRS',
    'outerwear': 'OUT',
    'footwear': 'FTW',
    'bags': 'BAG',
    'accessories': 'ACC',
    'jewelry': 'JWL',
    'activewear': 'ACT',
    'swimwear': 'SWM',
    'intimates': 'INT',
    'other': 'OTH'
};

// Get category code from category name
function getCategoryCode(category) {
    if (!category) return 'UNK';
    const lowerCategory = category.toLowerCase();
    return categoryAbbreviations[lowerCategory] || category.toUpperCase().slice(0, 3);
}

// Generate random alphanumeric code
function generateRandomCode(length = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
    let result = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars.charAt(randomValues[i] % chars.length);
    }
    return result;
}

// Generate SKU from pattern
function generateSku(pattern, itemData, rule) {
    let sku = pattern;

    const now = new Date();
    const replacements = {
        '{brand}': (itemData.brand || 'UNK').toUpperCase().slice(0, 3),
        '{category}': getCategoryCode(itemData.category),
        '{color}': (itemData.color || 'XXX').toUpperCase().slice(0, 3),
        '{size}': (itemData.size || 'OS').toUpperCase().replace(/\s+/g, ''),
        '{year}': now.getFullYear().toString().slice(-2),
        '{month}': String(now.getMonth() + 1).padStart(2, '0'),
        '{day}': String(now.getDate()).padStart(2, '0'),
        '{counter}': String((rule?.counter_current || 0) + 1).padStart(rule?.counter_padding || 4, '0'),
        '{random}': generateRandomCode(4)
    };

    for (const [token, value] of Object.entries(replacements)) {
        sku = sku.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    // Apply prefix and suffix
    const prefix = rule?.prefix || '';
    const suffix = rule?.suffix || '';

    return prefix + sku + suffix;
}


export async function skuRulesRouter(ctx) {
    const { method, path, body, user, query: queryParams } = ctx;

    // GET /api/sku-rules - List all rules for user
    if (method === 'GET' && (path === '' || path === '/')) {
        const rules = await query.all(
            'SELECT * FROM sku_rules WHERE user_id = ? ORDER BY is_default DESC, name ASC',
            [user.id]
        );

        // Parse JSON fields
        rules.forEach(rule => {
            rule.variables = safeJsonParse(rule.variables, []);
        });

        return { status: 200, data: { rules } };
    }

    // GET /api/sku-rules/default - Get default rule (must be before :id catch-all)
    if (method === 'GET' && path === '/default') {
        const rule = await query.get(
            'SELECT * FROM sku_rules WHERE user_id = ? AND is_default = TRUE',
            [user.id]
        );

        if (!rule) {
            return { status: 200, data: { rule: null } };
        }

        rule.variables = safeJsonParse(rule.variables, []);

        return { status: 200, data: { rule } };
    }

    // POST /api/sku-rules/preview - Preview pattern with sample data (must be before :id catch-all)
    if (method === 'POST' && path === '/preview') {
        const { pattern, itemData, ruleId } = body;

        if (!pattern) {
            return { status: 400, data: { error: 'Pattern is required' } };
        }

        let rule = null;
        if (ruleId) {
            rule = await query.get(
                'SELECT * FROM sku_rules WHERE id = ? AND user_id = ?',
                [ruleId, user.id]
            );
        }

        const sampleData = itemData || {
            brand: 'Nike',
            category: 'Tops',
            color: 'Black',
            size: 'M'
        };

        const generatedSku = generateSku(pattern, sampleData, rule || { counter_current: 0, counter_padding: 4 });

        return {
            status: 200,
            data: {
                pattern,
                itemData: sampleData,
                generatedSku
            }
        };
    }

    // POST /api/sku-rules/generate - Generate SKU for an item (must be before :id catch-all)
    if (method === 'POST' && path === '/generate') {
        const { itemData, ruleId } = body;

        if (!itemData) {
            return { status: 400, data: { error: 'Item data is required' } };
        }

        let rule;
        if (ruleId) {
            rule = await query.get(
                'SELECT * FROM sku_rules WHERE id = ? AND user_id = ?',
                [ruleId, user.id]
            );
        } else {
            rule = await query.get(
                'SELECT * FROM sku_rules WHERE user_id = ? AND is_default = TRUE',
                [user.id]
            );
        }

        if (!rule) {
            const sku = `VL-${Date.now()}`;
            return { status: 200, data: { sku, ruleUsed: null } };
        }

        const generatedSku = generateSku(rule.pattern, itemData, rule);

        await query.run(
            'UPDATE sku_rules SET counter_current = counter_current + 1 WHERE id = ?',
            [rule.id]
        );

        return {
            status: 200,
            data: {
                sku: generatedSku,
                ruleUsed: {
                    id: rule.id,
                    name: rule.name,
                    pattern: rule.pattern
                }
            }
        };
    }

    // POST /api/sku-rules/batch-update - Batch update inventory SKUs (must be before :id catch-all)
    if (method === 'POST' && path === '/batch-update') {
        const { ruleId, updateAll, onlyEmpty } = body;

        if (!ruleId) {
            return { status: 400, data: { error: 'Rule ID is required' } };
        }

        const rule = await query.get(
            'SELECT * FROM sku_rules WHERE id = ? AND user_id = ?',
            [ruleId, user.id]
        );

        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        let items;
        if (onlyEmpty) {
            items = await query.all(
                "SELECT * FROM inventory WHERE user_id = ? AND (sku IS NULL OR sku = '')",
                [user.id]
            );
        } else {
            items = await query.all(
                'SELECT * FROM inventory WHERE user_id = ?',
                [user.id]
            );
        }

        let updated = 0;
        let currentCounter = rule.counter_current;

        for (const item of items) {
            const tempRule = { ...rule, counter_current: currentCounter };
            const newSku = generateSku(rule.pattern, item, tempRule);

            await query.run(
                'UPDATE inventory SET sku = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newSku, item.id]
            );

            currentCounter++;
            updated++;
        }

        await query.run(
            'UPDATE sku_rules SET counter_current = ? WHERE id = ?',
            [currentCounter, ruleId]
        );

        return {
            status: 200,
            data: {
                message: `Updated ${updated} item(s)`,
                updated,
                total: items.length
            }
        };
    }

    // GET /api/sku-rules/:id - Get single rule
    if (method === 'GET' && path.startsWith('/') && !path.includes('/', 1)) {
        const ruleId = path.substring(1);

        const rule = await query.get(
            'SELECT * FROM sku_rules WHERE id = ? AND user_id = ?',
            [ruleId, user.id]
        );

        if (!rule) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        rule.variables = safeJsonParse(rule.variables, []);

        return { status: 200, data: rule };
    }

    // POST /api/sku-rules - Create new rule
    if (method === 'POST' && (path === '' || path === '/')) {
        const {
            name,
            pattern,
            description,
            isDefault,
            prefix,
            suffix,
            separator,
            counterStart,
            counterPadding
        } = body;

        if (!name || !name.trim()) {
            return { status: 400, data: { error: 'Rule name is required' } };
        }

        if (!pattern || !pattern.trim()) {
            return { status: 400, data: { error: 'Pattern is required' } };
        }

        const ruleId = uuidv4();

        // If setting as default, clear other defaults first
        if (isDefault) {
            await query.run(
                'UPDATE sku_rules SET is_default = FALSE WHERE user_id = ?',
                [user.id]
            );
        }

        // Extract variables from pattern
        const variableMatches = pattern.match(/\{[^}]+\}/g) || [];
        const variables = [...new Set(variableMatches)];

        await query.run(`
            INSERT INTO sku_rules (
                id, user_id, name, pattern, description, is_default,
                prefix, suffix, separator, counter_start, counter_padding,
                counter_current, variables
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ruleId,
            user.id,
            name.trim(),
            pattern.trim(),
            description || null,
            isDefault ? 1 : 0,
            prefix || null,
            suffix || null,
            separator || '-',
            counterStart || 1,
            counterPadding || 4,
            (counterStart || 1) - 1, // Start one below so first generated is counterStart
            JSON.stringify(variables)
        ]);

        const newRule = await query.get('SELECT * FROM sku_rules WHERE id = ?', [ruleId]);
        newRule.variables = variables;

        return { status: 201, data: newRule };
    }

    // PUT /api/sku-rules/:id - Update rule
    if (method === 'PUT' && path.startsWith('/') && !path.includes('/', 1)) {
        const ruleId = path.substring(1);

        const existing = await query.get(
            'SELECT id FROM sku_rules WHERE id = ? AND user_id = ?',
            [ruleId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        const {
            name,
            pattern,
            description,
            isDefault,
            isActive,
            prefix,
            suffix,
            separator,
            counterStart,
            counterPadding,
            counterCurrent
        } = body;

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (pattern !== undefined) {
            updates.push('pattern = ?');
            params.push(pattern.trim());

            // Update variables when pattern changes
            const variableMatches = pattern.match(/\{[^}]+\}/g) || [];
            const variables = [...new Set(variableMatches)];
            updates.push('variables = ?');
            params.push(JSON.stringify(variables));
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (isDefault !== undefined) {
            // Clear other defaults first if setting this as default
            if (isDefault) {
                await query.run('UPDATE sku_rules SET is_default = FALSE WHERE user_id = ?', [user.id]);
            }
            updates.push('is_default = ?');
            params.push(isDefault ? 1 : 0);
        }
        if (isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(isActive ? 1 : 0);
        }
        if (prefix !== undefined) {
            updates.push('prefix = ?');
            params.push(prefix);
        }
        if (suffix !== undefined) {
            updates.push('suffix = ?');
            params.push(suffix);
        }
        if (separator !== undefined) {
            updates.push('separator = ?');
            params.push(separator);
        }
        if (counterStart !== undefined) {
            updates.push('counter_start = ?');
            params.push(counterStart);
        }
        if (counterPadding !== undefined) {
            updates.push('counter_padding = ?');
            params.push(counterPadding);
        }
        if (counterCurrent !== undefined) {
            updates.push('counter_current = ?');
            params.push(counterCurrent);
        }

        if (updates.length === 0) {
            return { status: 400, data: { error: 'No updates provided' } };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(ruleId, user.id);

        await query.run(
            `UPDATE sku_rules SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            params
        );

        const updatedRule = await query.get('SELECT * FROM sku_rules WHERE id = ?', [ruleId]);
        updatedRule.variables = safeJsonParse(updatedRule.variables, []);

        return { status: 200, data: updatedRule };
    }

    // DELETE /api/sku-rules/:id - Delete rule
    if (method === 'DELETE' && path.startsWith('/') && !path.includes('/', 1)) {
        const ruleId = path.substring(1);

        const existing = await query.get(
            'SELECT id FROM sku_rules WHERE id = ? AND user_id = ?',
            [ruleId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        await query.run('DELETE FROM sku_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);

        return { status: 200, data: { message: 'Rule deleted successfully' } };
    }

    // POST /api/sku-rules/:id/set-default - Set rule as default
    if (method === 'POST' && path.match(/^\/[^/]+\/set-default$/)) {
        const ruleId = path.split('/')[1];

        const existing = await query.get(
            'SELECT id FROM sku_rules WHERE id = ? AND user_id = ?',
            [ruleId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Rule not found' } };
        }

        // Clear all defaults for user
        await query.run('UPDATE sku_rules SET is_default = FALSE WHERE user_id = ?', [user.id]);

        // Set this rule as default
        await query.run('UPDATE sku_rules SET is_default = TRUE WHERE id = ?', [ruleId]);

        return { status: 200, data: { message: 'Default rule updated' } };
    }

    return { status: 404, data: { error: 'Not found' } };
}
