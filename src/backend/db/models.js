import { query } from './query.js';
import { validateIdentifier } from './sql-helpers.js';

// Model helpers for common operations
export const models = {
    async create(table, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sqlStr = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return await query.run(sqlStr, values);
    },

    async findById(table, id) {
        validateIdentifier(table);
        return await query.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },

    async findOne(table, conditions) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
        return await query.get(`SELECT * FROM ${table} WHERE ${where}`, values);
    },

    async findMany(table, conditions = {}, options = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT * FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        if (options.orderBy) {
            const orderParts = options.orderBy.split(',').map((s) => s.trim());
            const sanitizedParts = orderParts.map((part) => {
                const [col, dir] = part.trim().split(/\s+/);
                validateIdentifier(col);
                const safeDir = dir && ['ASC', 'DESC', 'asc', 'desc'].includes(dir) ? dir.toUpperCase() : 'ASC';
                return `${col} ${safeDir}`;
            });
            sqlStr += ` ORDER BY ${sanitizedParts.join(', ')}`;
        }

        if (options.limit) {
            sqlStr += ` LIMIT ${parseInt(options.limit, 10)}`;
        }

        if (options.offset) {
            sqlStr += ` OFFSET ${parseInt(options.offset, 10)}`;
        }

        return await query.all(sqlStr, values);
    },

    async update(table, id, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const sqlStr = `UPDATE ${table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1}`;
        return await query.run(sqlStr, [...values, id]);
    },

    async delete(table, id) {
        validateIdentifier(table);
        return await query.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },

    async count(table, conditions = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT COUNT(*) as count FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        const row = await query.get(sqlStr, values);
        return row?.count || 0;
    },
};
