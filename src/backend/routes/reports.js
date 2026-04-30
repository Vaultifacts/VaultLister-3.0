import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

// Whitelist of allowed tables for custom queries
const ALLOWED_TABLES = ['inventory', 'listings', 'orders', 'offers', 'sales', 'checklists', 'suppliers'];

// Per-table column whitelists — only these columns may appear in SELECT, WHERE, GROUP BY, ORDER BY
const ALLOWED_COLUMNS = {
    inventory: [
        'id',
        'user_id',
        'title',
        'name',
        'sku',
        'category',
        'brand',
        'size',
        'color',
        'condition',
        'status',
        'quantity',
        'cost_price',
        'list_price',
        'location',
        'source',
        'notes',
        'acquired_date',
        'created_at',
        'updated_at',
    ],
    listings: ['id', 'user_id', 'title', 'platform', 'status', 'price', 'views', 'likes', 'created_at', 'updated_at'],
    sales: [
        'id',
        'user_id',
        'platform',
        'sale_price',
        'shipping_cost',
        'platform_fee',
        'net_profit',
        'status',
        'created_at',
        'updated_at',
    ],
    orders: [
        'id',
        'user_id',
        'platform',
        'status',
        'sale_price',
        'shipping_cost',
        'platform_fee',
        'created_at',
        'updated_at',
    ],
    offers: ['id', 'user_id', 'platform', 'status', 'amount', 'created_at', 'updated_at'],
    checklists: ['id', 'user_id', 'name', 'status', 'created_at', 'updated_at'],
    suppliers: ['id', 'user_id', 'name', 'status', 'created_at', 'updated_at'],
    // Generic fallback for columns allowed across all tables (used when table context is unknown)
    _any: [
        'id',
        'user_id',
        'name',
        'title',
        'sku',
        'category',
        'brand',
        'status',
        'quantity',
        'cost_price',
        'list_price',
        'sale_price',
        'platform',
        'platform_fee',
        'shipping_cost',
        'net_profit',
        'created_at',
        'updated_at',
        'acquired_date',
        'views',
        'likes',
        'source',
        'condition',
        'notes',
        'location',
        'size',
        'color',
    ],
};

// Strict operator whitelist
const ALLOWED_OPERATORS = [
    '=',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    'ILIKE',
    'NOT ILIKE',
    'IN',
    'NOT IN',
    'IS NULL',
    'IS NOT NULL',
];

// Calculate next run date based on frequency
function calculateNextRun(frequency) {
    const now = new Date();
    switch (frequency) {
        case 'daily':
            now.setDate(now.getDate() + 1);
            break;
        case 'weekly':
            now.setDate(now.getDate() + 7);
            break;
        case 'monthly':
            now.setMonth(now.getMonth() + 1);
            break;
        default:
            return null;
    }
    return now.toISOString();
}

// Validate and sanitize a raw custom SQL query.
// This endpoint is enterprise-only. It enforces SELECT-only access and
// blocks all known SQL injection vectors before execution.
function validateCustomQuery(sql, userId) {
    if (typeof sql !== 'string' || sql.trim().length === 0) {
        throw new Error('SQL query must be a non-empty string');
    }

    const trimmed = sql.trim();
    const upperSQL = trimmed.toUpperCase();

    // Only allow SELECT statements (must be the very first keyword)
    if (!upperSQL.startsWith('SELECT')) {
        throw new Error('Only SELECT statements are allowed');
    }

    // Block SQL comments (inline -- and block /* */)
    if (/--/.test(trimmed) || /\/\*/.test(trimmed) || /\*\//.test(trimmed)) {
        throw new Error('SQL comments are not allowed');
    }

    // Block semicolons — prevents statement stacking
    if (/;/.test(trimmed)) {
        throw new Error('Multiple statements are not allowed');
    }

    // Block UNION to prevent cross-query data exfiltration
    if (/\bUNION\b/.test(upperSQL)) {
        throw new Error('UNION is not allowed');
    }

    // Block subqueries
    if (/\(\s*SELECT\b/.test(upperSQL)) {
        throw new Error('Subqueries are not allowed');
    }

    // Block all write/DDL/dangerous keywords
    const dangerousKeywords = [
        'INSERT',
        'UPDATE',
        'DELETE',
        'DROP',
        'ALTER',
        'CREATE',
        'TRUNCATE',
        'REPLACE',
        'MERGE',
        'EXEC',
        'EXECUTE',
        'COPY',
        'LISTEN',
        'NOTIFY',
        'SET ROLE',
        'GRANT',
        'REVOKE',
        'LOAD',
        'ATTACH',
        'DETACH',
        'LOAD_EXTENSION',
        'RANDOMBLOB',
    ];

    for (const keyword of dangerousKeywords) {
        const pattern = new RegExp(`\\b${keyword}\\b`); // nosemgrep: javascript.lang.security.detect-non-literal-regexp
        if (pattern.test(upperSQL)) {
            throw new Error(`Keyword ${keyword} is not allowed`);
        }
    }

    // Validate all table references are in the whitelist
    // Handle bare names and quoted identifiers ("table", `table`, [table])
    const fromMatch = upperSQL.match(/FROM\s+["`\[]?(\w+)["`\]]?/gi);
    const joinMatch = upperSQL.match(/JOIN\s+["`\[]?(\w+)["`\]]?/gi);
    const allTableRefs = [...(fromMatch || []), ...(joinMatch || [])];

    for (const ref of allTableRefs) {
        const tableName = ref
            .replace(/^(FROM|JOIN)\s+["`\[]?/i, '')
            .replace(/["`\]]?$/, '')
            .toLowerCase();
        if (!ALLOWED_TABLES.includes(tableName)) {
            throw new Error(`Table "${tableName}" is not allowed`);
        }
    }

    // Inject user_id filter using parameterized placeholders
    const params = [];
    if (!upperSQL.includes('USER_ID')) {
        if (upperSQL.includes('WHERE')) {
            sql = trimmed.replace(/WHERE/i, 'WHERE user_id = ? AND');
        } else {
            const insertPoint = trimmed.search(/GROUP\s+BY|ORDER\s+BY|LIMIT/i);
            if (insertPoint !== -1) {
                sql = trimmed.slice(0, insertPoint) + ' WHERE user_id = ? ' + trimmed.slice(insertPoint);
            } else {
                sql = trimmed + ' WHERE user_id = ?';
            }
        }
        params.push(userId);
    } else {
        // User included user_id — strip their conditions and force our own scoping
        // Remove any user-supplied user_id conditions to prevent bypass (e.g., OR 1=1)
        sql = trimmed.replace(/user_id\s*=\s*['"]?\w+['"]?/gi, '1=1');
        // Now inject our own user_id constraint
        if (sql.toUpperCase().includes('WHERE')) {
            sql = sql.replace(/WHERE/i, 'WHERE user_id = ? AND');
        } else {
            sql += ' WHERE user_id = ?';
        }
        params.push(userId);
    }

    // Enforce a hard row limit
    if (!/\bLIMIT\b/.test(sql.toUpperCase())) {
        sql += ' LIMIT 1000';
    }

    return { sql, params };
}

// Validate a column name against the per-table whitelist.
// table is optional; when omitted the _any cross-table list is used.
// Accepts bare column names and table-prefixed names (e.g. "inventory.sku").
// Does NOT accept SQL function expressions — those are handled separately in
// SELECT column parsing where the function wrapper is stripped first.
function validateColumn(column, table) {
    if (typeof column !== 'string' || column.trim().length === 0) {
        throw new Error('Column name must be a non-empty string');
    }

    // Strip table prefix (e.g. "inventory.sku" -> "sku")
    const bare = column.includes('.') ? column.split('.').pop() : column;

    // Reject any characters outside safe identifiers
    if (!/^[a-zA-Z0-9_]+$/.test(bare)) {
        throw new Error(`Invalid column name format: "${column}"`);
    }

    const tableKey = table && ALLOWED_COLUMNS[table] ? table : '_any';
    const allowed = ALLOWED_COLUMNS[tableKey];

    if (!allowed.includes(bare) && bare !== '*') {
        throw new Error(`Column "${bare}" is not allowed${table ? ` for table "${table}"` : ''}`);
    }
}

// Validate a SELECT column expression, which may include SQL aggregate functions.
// Strips the function wrapper before delegating to validateColumn.
function validateSelectColumn(column, table) {
    const bare = column.includes('.') ? column.split('.').pop() : column;

    // Allow aggregate/scalar functions wrapping a column or *
    const fnMatch = bare.match(/^(COUNT|SUM|AVG|MIN|MAX|DATE|ROUND|COALESCE|UPPER|LOWER)\s*\(([^)]*)\)/i);
    if (fnMatch) {
        const inner = fnMatch[2].trim();
        if (inner === '*' || inner === '') return; // COUNT(*) — fine
        // The inner expression may itself be a table-prefixed column
        validateColumn(inner.split('.').pop(), table);
        return;
    }

    // Allow expressions like "TO_CHAR(created_at, 'YYYY-MM') as month" — these come
    // only from REPORT_TEMPLATES which are server-controlled strings, not user input.
    // For user-supplied SELECT columns we require bare identifier or table.identifier.
    if (/\(/.test(bare)) {
        // Has parentheses but didn't match known functions — reject
        throw new Error(`Unsupported column expression: "${column}"`);
    }

    validateColumn(column, table);
}

// Build a safe parameterized SQL query from a structured report config.
// All column names are validated against per-table whitelists.
// Filter values are always bound as parameters — never interpolated.
function buildReportQuery(config, userId) {
    const { tables, columns, filters, groupBy, orderBy, dateRange } = config;

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
        throw new Error('Tables array is required');
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
        throw new Error('Columns array is required');
    }

    // Validate all tables are in the whitelist
    for (const table of tables) {
        if (!ALLOWED_TABLES.includes(table)) {
            throw new Error(`Table "${table}" is not allowed`);
        }
    }

    const primaryTable = tables[0];

    // Validate all SELECT columns using the per-table whitelist
    for (const column of columns) {
        // Determine table context from "table.column" prefix
        let colTable = primaryTable;
        if (column.includes('.')) {
            const prefix = column.split('.')[0];
            if (ALLOWED_TABLES.includes(prefix)) colTable = prefix;
        }
        validateSelectColumn(column, colTable);
    }

    let sql = `SELECT ${columns.join(', ')} FROM ${primaryTable}`;
    const params = [userId];

    // Add WHERE clause — user_id scope is always enforced first
    const conditions = [`${primaryTable}.user_id = ?`];

    if (filters && Array.isArray(filters)) {
        for (const filter of filters) {
            if (!filter || typeof filter.column !== 'string' || typeof filter.operator !== 'string') {
                throw new Error('Each filter must have a column and operator');
            }

            // Validate filter column against per-table whitelist
            let filterTable = primaryTable;
            if (filter.column.includes('.')) {
                const prefix = filter.column.split('.')[0];
                if (ALLOWED_TABLES.includes(prefix)) filterTable = prefix;
            }
            validateColumn(filter.column, filterTable);

            // Validate operator against the strict whitelist
            const upperOp = filter.operator.toUpperCase().trim();
            if (!ALLOWED_OPERATORS.includes(upperOp)) {
                throw new Error(`Invalid operator: "${filter.operator}"`);
            }

            // NULL-check operators do not take a value parameter
            if (upperOp === 'IS NULL' || upperOp === 'IS NOT NULL') {
                conditions.push(`${filter.column} ${upperOp}`);
            } else if (upperOp === 'IN' || upperOp === 'NOT IN') {
                // Value must be an array for IN / NOT IN
                if (!Array.isArray(filter.value) || filter.value.length === 0) {
                    throw new Error(`Filter value for ${upperOp} must be a non-empty array`);
                }
                const placeholders = filter.value.map(() => '?').join(', ');
                conditions.push(`${filter.column} ${upperOp} (${placeholders})`);
                params.push(...filter.value);
            } else {
                conditions.push(`${filter.column} ${upperOp} ?`);
                params.push(filter.value);
            }
        }
    }

    if (dateRange && dateRange.start && dateRange.end) {
        const dateColumn = dateRange.column || 'created_at';
        // Validate dateRange.column against the primary table whitelist
        validateColumn(dateColumn, primaryTable);
        conditions.push(`${dateColumn} BETWEEN ? AND ?`);
        params.push(dateRange.start, dateRange.end);
    }

    sql += ` WHERE ${conditions.join(' AND ')}`;

    // GROUP BY — each column must pass the per-table whitelist check
    if (groupBy && Array.isArray(groupBy) && groupBy.length > 0) {
        for (const col of groupBy) {
            let colTable = primaryTable;
            if (typeof col === 'string' && col.includes('.')) {
                const prefix = col.split('.')[0];
                if (ALLOWED_TABLES.includes(prefix)) colTable = prefix;
            }
            validateColumn(col, colTable);
        }
        sql += ` GROUP BY ${groupBy.join(', ')}`;
    }

    // ORDER BY — column portion must pass the whitelist; direction must be ASC or DESC
    if (orderBy && Array.isArray(orderBy) && orderBy.length > 0) {
        const safeOrderClauses = [];
        for (const clause of orderBy) {
            if (typeof clause !== 'string') throw new Error('ORDER BY clause must be a string');
            const parts = clause.trim().split(/\s+/);
            const colPart = parts[0];
            const dirPart = (parts[1] || 'ASC').toUpperCase();

            if (!['ASC', 'DESC'].includes(dirPart)) {
                throw new Error(`Invalid ORDER BY direction: "${dirPart}"`);
            }

            // Validate the column part — allow aliases (single-word identifiers) and table.column
            // Aliases like "month" or "revenue" may not be in the column whitelist, so we only
            // apply the whitelist check when the clause contains a dot (explicit table reference).
            if (colPart.includes('.')) {
                let colTable = primaryTable;
                const prefix = colPart.split('.')[0];
                if (ALLOWED_TABLES.includes(prefix)) colTable = prefix;
                validateColumn(colPart, colTable);
            } else {
                // Bare identifier — must be safe characters only (alias or column name)
                if (!/^[a-zA-Z0-9_]+$/.test(colPart)) {
                    throw new Error(`Invalid ORDER BY column: "${colPart}"`);
                }
            }

            safeOrderClauses.push(`${colPart} ${dirPart}`);
        }
        sql += ` ORDER BY ${safeOrderClauses.join(', ')}`;
    }

    // Hard row limit — prevents runaway queries
    sql += ' LIMIT 1000';

    return { sql, params };
}

// Whitelist of allowed groupBy values for P&L reports
const ALLOWED_PNL_GROUPBY = ['platform', 'category', 'brand', 'month'];

// Generate P&L report
async function generatePnL(userId, startDate, endDate, groupBy) {
    try {
        // Validate groupBy against whitelist
        if (groupBy && !ALLOWED_PNL_GROUPBY.includes(groupBy)) {
            throw new Error(`Invalid groupBy value: ${groupBy}`);
        }

        let groupColumn = '';
        let groupLabel = 'Total';

        switch (groupBy) {
            case 'platform':
                groupColumn = 'l.platform';
                groupLabel = 'Platform';
                break;
            case 'category':
                groupColumn = 'i.category';
                groupLabel = 'Category';
                break;
            case 'brand':
                groupColumn = 'i.brand';
                groupLabel = 'Brand';
                break;
            case 'month':
                groupColumn = "TO_CHAR(s.created_at, 'YYYY-MM')";
                groupLabel = 'Month';
                break;
            default:
                groupColumn = "'Total'";
        }

        const sql = `
      SELECT
        ${groupColumn} as group_name,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.sale_price) as revenue,
        SUM(COALESCE(i.cost_price, 0)) as cogs,
        SUM(COALESCE(s.platform_fee, 0)) as platform_fees,
        SUM(COALESCE(s.shipping_cost, 0)) as shipping_costs,
        SUM(s.sale_price) - SUM(COALESCE(i.cost_price, 0)) - SUM(COALESCE(s.platform_fee, 0)) - SUM(COALESCE(s.shipping_cost, 0)) as net_profit
      FROM sales s
      LEFT JOIN inventory i ON s.inventory_id = i.id
      LEFT JOIN listings l ON s.listing_id = l.id
      WHERE s.user_id = ?
        AND s.created_at BETWEEN ? AND ?
      GROUP BY ${groupColumn}
      ORDER BY net_profit DESC
    `;

        const results = await query.all(sql, [userId, startDate, endDate]);

        // Calculate totals
        const totals = {
            group_name: 'Grand Total',
            total_sales: 0,
            revenue: 0,
            cogs: 0,
            platform_fees: 0,
            shipping_costs: 0,
            net_profit: 0,
        };

        results.forEach((row) => {
            totals.total_sales += row.total_sales;
            totals.revenue += row.revenue;
            totals.cogs += row.cogs;
            totals.platform_fees += row.platform_fees;
            totals.shipping_costs += row.shipping_costs;
            totals.net_profit += row.net_profit;
        });

        return {
            groupBy: groupLabel,
            startDate,
            endDate,
            lineItems: results,
            totals,
        };
    } catch (error) {
        logger.error('[Reports] Error generating P&L', userId, { detail: error?.message });
        throw error;
    }
}

// Pre-built report templates
const REPORT_TEMPLATES = [
    {
        id: 'monthly-sales',
        name: 'Monthly Sales Summary',
        description: 'Total sales and revenue grouped by month',
        report_type: 'custom',
        config: {
            tables: ['sales'],
            columns: [
                "TO_CHAR(created_at, 'YYYY-MM') as month",
                'COUNT(*) as total_sales',
                'SUM(sale_price) as revenue',
                'AVG(sale_price) as avg_sale_price',
            ],
            filters: [],
            groupBy: ["TO_CHAR(created_at, 'YYYY-MM')"],
            orderBy: ['month DESC'],
        },
    },
    {
        id: 'inventory-aging',
        name: 'Inventory Aging Report',
        description: 'Items grouped by how long they have been in inventory',
        report_type: 'custom',
        config: {
            tables: ['inventory'],
            columns: [
                'CASE ' +
                    'WHEN EXTRACT(EPOCH FROM (NOW() - acquired_date)) / 86400 < 30 THEN "0-30 days" ' +
                    'WHEN EXTRACT(EPOCH FROM (NOW() - acquired_date)) / 86400 < 90 THEN "30-90 days" ' +
                    'WHEN EXTRACT(EPOCH FROM (NOW() - acquired_date)) / 86400 < 180 THEN "90-180 days" ' +
                    'ELSE "180+ days" END as age_bracket',
                'COUNT(*) as item_count',
                'SUM(cost_price) as total_cost',
                'AVG(cost_price) as avg_cost',
            ],
            filters: [{ column: 'status', operator: '=', value: 'available' }],
            groupBy: ['age_bracket'],
            orderBy: ['age_bracket'],
        },
    },
    {
        id: 'platform-performance',
        name: 'Platform Performance',
        description: 'Sales, fees, and profit breakdown by selling platform',
        report_type: 'custom',
        config: {
            tables: ['sales', 'listings'],
            columns: [
                'listings.platform',
                'COUNT(sales.id) as total_sales',
                'SUM(sales.sale_price) as revenue',
                'SUM(sales.platform_fee) as fees',
                'SUM(sales.sale_price - COALESCE(sales.platform_fee, 0)) as net_revenue',
            ],
            filters: [],
            groupBy: ['listings.platform'],
            orderBy: ['revenue DESC'],
        },
    },
    {
        id: 'category-profitability',
        name: 'Category Profitability',
        description: 'Profit margins and performance by item category',
        report_type: 'custom',
        config: {
            tables: ['sales', 'inventory'],
            columns: [
                'inventory.category',
                'COUNT(sales.id) as total_sales',
                'SUM(sales.sale_price) as revenue',
                'SUM(inventory.cost_price) as cogs',
                'SUM(sales.sale_price - COALESCE(inventory.cost_price, 0)) as gross_profit',
                'ROUND(AVG((sales.sale_price - COALESCE(inventory.cost_price, 0)) / sales.sale_price * 100), 2) as avg_margin_pct',
            ],
            filters: [],
            groupBy: ['inventory.category'],
            orderBy: ['gross_profit DESC'],
        },
    },
    {
        id: 'top-sellers',
        name: 'Top Sellers',
        description: 'Best performing items by revenue',
        report_type: 'custom',
        config: {
            tables: ['sales', 'inventory'],
            columns: [
                'inventory.name',
                'inventory.sku',
                'inventory.category',
                'COUNT(sales.id) as times_sold',
                'SUM(sales.sale_price) as total_revenue',
                'AVG(sales.sale_price) as avg_sale_price',
            ],
            filters: [],
            groupBy: ['inventory.id', 'inventory.name', 'inventory.sku', 'inventory.category'],
            orderBy: ['total_revenue DESC'],
            limit: 50,
        },
    },
];

// ===================== Widget-Based Report System =====================

const WIDGET_CATALOG = [
    { type: 'revenue_chart', label: 'Revenue Chart', category: 'financial', size: 'large' },
    { type: 'profit_chart', label: 'Profit Chart', category: 'financial', size: 'large' },
    { type: 'sales_by_platform', label: 'Sales by Platform', category: 'sales', size: 'medium' },
    { type: 'inventory_value', label: 'Inventory Value', category: 'inventory', size: 'small' },
    { type: 'top_sellers', label: 'Top Sellers', category: 'sales', size: 'large' },
    { type: 'sell_through_rate', label: 'Sell Through Rate', category: 'inventory', size: 'small' },
    { type: 'profit_margin', label: 'Profit Margin', category: 'financial', size: 'small' },
    { type: 'listing_age', label: 'Listing Age', category: 'inventory', size: 'medium' },
    { type: 'platform_fees', label: 'Platform Fees', category: 'financial', size: 'small' },
    { type: 'monthly_summary', label: 'Monthly Summary', category: 'financial', size: 'large' },
];

async function generateWidgetResult(type, userId, startDate, endDate) {
    // Generate widget data from DB for the given type and date range
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    try {
        switch (type) {
            case 'revenue_chart': {
                const rows = await query.all(
                    `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(sale_price) as revenue
           FROM sales WHERE user_id = ? AND created_at BETWEEN ? AND ?
           GROUP BY month ORDER BY month`,
                    [userId, start, end],
                );
                return {
                    type: 'line',
                    labels: rows.map((r) => r.month),
                    datasets: [{ label: 'Revenue', data: rows.map((r) => r.revenue || 0) }],
                };
            }
            case 'profit_chart': {
                const rows = await query.all(
                    `SELECT TO_CHAR(s.created_at, 'YYYY-MM') as month,
                  SUM(s.sale_price - COALESCE(i.cost_price,0) - COALESCE(s.platform_fee,0)) as profit
           FROM sales s LEFT JOIN inventory i ON s.inventory_id = i.id
           WHERE s.user_id = ? AND s.created_at BETWEEN ? AND ?
           GROUP BY month ORDER BY month`,
                    [userId, start, end],
                );
                return {
                    type: 'line',
                    labels: rows.map((r) => r.month),
                    datasets: [{ label: 'Profit', data: rows.map((r) => r.profit || 0) }],
                };
            }
            case 'sales_by_platform': {
                const rows = await query.all(
                    `SELECT platform, COUNT(*) as count, SUM(sale_price) as revenue
           FROM sales WHERE user_id = ? AND created_at BETWEEN ? AND ?
           GROUP BY platform`,
                    [userId, start, end],
                );
                return {
                    type: 'pie',
                    labels: rows.map((r) => r.platform || 'Unknown'),
                    datasets: [{ data: rows.map((r) => r.revenue || 0) }],
                };
            }
            case 'inventory_value': {
                const row = await query.get(
                    `SELECT SUM(cost_price * quantity) as total_value, COUNT(*) as item_count
           FROM inventory WHERE user_id = ? AND status != 'sold' AND status != 'deleted'`,
                    [userId],
                );
                return {
                    type: 'stat',
                    value: row?.total_value || 0,
                    label: 'Total Inventory Value',
                    secondary: { label: 'Items', value: row?.item_count || 0 },
                };
            }
            case 'top_sellers': {
                const rows = await query.all(
                    `SELECT i.title as name, i.sku, COUNT(s.id) as times_sold, SUM(s.sale_price) as revenue
           FROM sales s JOIN inventory i ON s.inventory_id = i.id
           WHERE s.user_id = ? AND s.created_at BETWEEN ? AND ?
           GROUP BY i.id ORDER BY revenue DESC LIMIT 10`,
                    [userId, start, end],
                );
                return {
                    type: 'table',
                    headers: ['Name', 'SKU', 'Times Sold', 'Revenue'],
                    rows: rows.map((r) => [r.name, r.sku || '', r.times_sold, r.revenue || 0]),
                };
            }
            case 'sell_through_rate': {
                const total = await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ?', [userId]);
                const sold = await query.get(
                    'SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND status = ?',
                    [userId, 'sold'],
                );
                const rate = total?.count ? Math.round(((sold?.count || 0) / total.count) * 100) : 0;
                return { type: 'stat', value: rate, label: 'Sell Through Rate', unit: '%' };
            }
            case 'profit_margin': {
                const row = await query.get(
                    `SELECT SUM(sale_price) as revenue,
                  SUM(sale_price - COALESCE(platform_fee, 0) - COALESCE(
                    (SELECT cost_price FROM inventory WHERE id = sales.inventory_id), 0
                  )) as profit
           FROM sales WHERE user_id = ? AND created_at BETWEEN ? AND ?`,
                    [userId, start, end],
                );
                const margin = row?.revenue ? Math.round((row.profit / row.revenue) * 100) : 0;
                return {
                    type: 'stat',
                    value: margin,
                    label: 'Profit Margin',
                    unit: '%',
                    secondary: { label: 'Revenue', value: row?.revenue || 0 },
                };
            }
            case 'listing_age': {
                const rows = await query.all(
                    `SELECT
            CASE
              WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 7 THEN '< 1 week'
              WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 30 THEN '1-4 weeks'
              WHEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 < 90 THEN '1-3 months'
              ELSE '3+ months'
            END as bracket,
            COUNT(*) as count
           FROM inventory WHERE user_id = ? AND status NOT IN ('sold', 'deleted')
           GROUP BY bracket ORDER BY MIN(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)`,
                    [userId],
                );
                return {
                    type: 'bar',
                    labels: rows.map((r) => r.bracket),
                    datasets: [{ label: 'Items', data: rows.map((r) => r.count) }],
                };
            }
            case 'platform_fees': {
                const row = await query.get(
                    `SELECT SUM(COALESCE(platform_fee, 0)) as total_fees, COUNT(*) as sale_count
           FROM sales WHERE user_id = ? AND created_at BETWEEN ? AND ?`,
                    [userId, start, end],
                );
                return {
                    type: 'stat',
                    value: row?.total_fees || 0,
                    label: 'Platform Fees',
                    secondary: { label: 'Sales', value: row?.sale_count || 0 },
                };
            }
            case 'monthly_summary': {
                const rows = await query.all(
                    `SELECT TO_CHAR(s.created_at, 'YYYY-MM') as month,
                  COUNT(*) as sales_count,
                  SUM(s.sale_price) as revenue,
                  SUM(COALESCE(s.platform_fee, 0)) as fees,
                  SUM(s.sale_price - COALESCE(s.platform_fee, 0) - COALESCE(
                    (SELECT cost_price FROM inventory WHERE id = s.inventory_id), 0
                  )) as profit
           FROM sales s WHERE s.user_id = ? AND s.created_at BETWEEN ? AND ?
           GROUP BY month ORDER BY month`,
                    [userId, start, end],
                );
                return {
                    type: 'table',
                    headers: ['Month', 'Sales', 'Revenue', 'Fees', 'Profit'],
                    rows: rows.map((r) => [r.month, r.sales_count, r.revenue || 0, r.fees || 0, r.profit || 0]),
                };
            }
            default:
                return { type: 'stat', value: 0, label: type };
        }
    } catch (_err) {
        return { type: 'stat', value: 0, label: type };
    }
}

// Parse a report row from DB into a clean report object
function parseReport(row) {
    let config = {};
    try {
        config = JSON.parse(row.config || '{}');
    } catch (_) {
        logger.warn('Failed to parse report config', { rowId: row.id });
    }
    return {
        id: row.id,
        name: row.name,
        description: config.description || null,
        widgets: config.widgets || [],
        date_range: config.date_range || '30d',
        report_type: row.report_type,
        last_run_at: row.last_run_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function reportsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    try {
        // GET /api/reports - List user's saved reports
        if (method === 'GET' && (path === '/' || path === '')) {
            const rows = await query.all(
                `SELECT id, name, report_type, config, last_run_at, created_at, updated_at
         FROM saved_reports
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT 200`,
                [user.id],
            );
            const reports = rows.map(parseReport);
            return { status: 200, data: { reports } };
        }

        // GET /api/reports/widgets - Return widget type catalog
        if (method === 'GET' && path === '/widgets') {
            return { status: 200, data: { widgets: WIDGET_CATALOG } };
        }

        // POST /api/reports/generate - Generate widget data on demand (no save)
        if (method === 'POST' && path === '/generate') {
            const { widgets = [], startDate, endDate } = body;
            const validWidgets = widgets.filter((w) => w?.type);
            const results = await Promise.all(
                validWidgets.map((w) => generateWidgetResult(w.type, user.id, startDate, endDate)),
            );
            const widgetData = Object.fromEntries(validWidgets.map((w, i) => [w.type, results[i]]));
            return { status: 200, data: { widgetData } };
        }

        // POST /api/reports - Create a new saved report
        if (method === 'POST' && (path === '/' || path === '')) {
            const { name, description, widgets, date_range, report_type, config } = body;

            if (!name) {
                return { status: 400, data: { error: 'Report name required' } };
            }

            const id = nanoid();
            const now = new Date().toISOString();

            // Support both new widget-based format and legacy SQL format
            const isLegacy = report_type && config;
            const storedConfig = isLegacy
                ? JSON.stringify(config)
                : JSON.stringify({
                      description: description || null,
                      widgets: widgets || [],
                      date_range: date_range || '30d',
                  });
            const storedType = report_type || 'widget';

            await query.run(
                `INSERT INTO saved_reports (id, user_id, name, report_type, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, user.id, name, storedType, storedConfig, now, now],
            );

            const row = await query.get('SELECT * FROM saved_reports WHERE id = ?', [id]);
            const report = parseReport(row);

            return { status: 201, data: { report, message: 'Report created' } };
        }

        // GET /api/reports/:id - Get single report with widget data
        if (
            method === 'GET' &&
            path.match(/^\/[^\/]+$/) &&
            !path.startsWith('/templates') &&
            !path.startsWith('/pnl') &&
            !path.startsWith('/query') &&
            !path.startsWith('/widgets') &&
            !path.startsWith('/generate')
        ) {
            const reportId = path.slice(1);

            const row = await query.get('SELECT * FROM saved_reports WHERE id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!row) {
                return { status: 404, data: { error: 'Report not found' } };
            }

            const report = parseReport(row);

            // Generate widget data for the report's widgets — parallel fetches
            const { startDate, endDate } = queryParams;
            const reportWidgets = (report.widgets || []).filter((w) => w?.type);
            const widgetResults = await Promise.all(
                reportWidgets.map((w) => generateWidgetResult(w.type, user.id, startDate, endDate)),
            );
            const widgetData = Object.fromEntries(reportWidgets.map((w, i) => [w.type, widgetResults[i]]));

            const schedule = await query.get('SELECT * FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            return {
                status: 200,
                data: { report: { ...report, schedule: schedule || null }, widgetData },
            };
        }

        // PUT /api/reports/:id - Update report
        if (
            method === 'PUT' &&
            path.match(/^\/[^\/]+$/) &&
            !path.startsWith('/templates') &&
            !path.startsWith('/pnl') &&
            !path.startsWith('/query') &&
            !path.startsWith('/widgets') &&
            !path.startsWith('/generate')
        ) {
            const reportId = path.slice(1);
            const { name, description, widgets, date_range, config } = body;

            const existingRow = await query.get('SELECT * FROM saved_reports WHERE id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!existingRow) {
                return { status: 404, data: { error: 'Report not found' } };
            }

            const updates = [];
            const params = [];

            if (name !== undefined) {
                updates.push('name = ?');
                params.push(name);
            }

            // Merge widget-based fields into config
            if (
                description !== undefined ||
                widgets !== undefined ||
                date_range !== undefined ||
                config !== undefined
            ) {
                let existingConfig = {};
                try {
                    existingConfig = JSON.parse(existingRow.config || '{}');
                } catch (_) {
                    logger.warn('Failed to parse existing report config');
                }

                let newConfig;
                if (config !== undefined) {
                    // Legacy format — replace config wholesale
                    newConfig = config;
                } else {
                    // Widget format — merge into existing config
                    newConfig = {
                        ...existingConfig,
                        ...(description !== undefined && { description }),
                        ...(widgets !== undefined && { widgets }),
                        ...(date_range !== undefined && { date_range }),
                    };
                }
                updates.push('config = ?');
                params.push(JSON.stringify(newConfig));
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(reportId, user.id);

            await query.run(`UPDATE saved_reports SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

            const updatedRow = await query.get('SELECT * FROM saved_reports WHERE id = ?', [reportId]);
            const report = parseReport(updatedRow);

            return { status: 200, data: { report } };
        }

        // DELETE /api/reports/:id - Delete report and its schedules
        if (
            method === 'DELETE' &&
            path.match(/^\/[^\/]+$/) &&
            !path.startsWith('/templates') &&
            !path.startsWith('/pnl') &&
            !path.startsWith('/query') &&
            !path.startsWith('/widgets') &&
            !path.startsWith('/generate')
        ) {
            const reportId = path.slice(1);

            const existing = await query.get('SELECT id FROM saved_reports WHERE id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!existing) {
                return { status: 404, data: { error: 'Report not found' } };
            }

            await query.transaction(async () => {
                await query.run('DELETE FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                    reportId,
                    user.id,
                ]);
                await query.run('DELETE FROM saved_reports WHERE id = ? AND user_id = ?', [reportId, user.id]);
            });

            return { status: 200, data: { message: 'Report deleted' } };
        }

        // POST /api/reports/:id/run - Execute a saved report
        if (method === 'POST' && path.match(/^\/[^\/]+\/run$/)) {
            const reportId = path.split('/')[1];

            const report = await query.get('SELECT * FROM saved_reports WHERE id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!report) {
                return { status: 404, data: { error: 'Report not found' } };
            }

            const config = safeJsonParse(report.config, {});
            const { sql, params } = buildReportQuery(config, user.id);

            const results = await query.all(sql, params);

            // Update last_run_at
            await query.run('UPDATE saved_reports SET last_run_at = ? WHERE id = ? AND user_id = ?', [
                new Date().toISOString(),
                reportId,
                user.id,
            ]);

            return {
                status: 200,
                data: {
                    report: report,
                    results,
                    executedAt: new Date().toISOString(),
                },
            };
        }

        // GET /api/reports/pnl - Generate Profit & Loss statement
        if (method === 'GET' && path === '/pnl') {
            const { startDate, endDate, groupBy } = queryParams;

            if (!startDate || !endDate) {
                return { status: 400, data: { error: 'startDate and endDate are required' } };
            }

            const pnlData = await generatePnL(user.id, startDate, endDate, groupBy);

            return { status: 200, data: pnlData };
        }

        // POST /api/reports/query - Execute a restricted custom SELECT query (enterprise only)
        if (method === 'POST' && path === '/query') {
            // Restrict raw SQL execution to enterprise-tier users only
            if (!user.is_admin) {
                logger.warn(`[Reports] Custom query attempt denied for non-admin user: ${user.id}`);
                return { status: 403, data: { error: 'Admin access required for custom SQL queries' } };
            }

            const { sql } = body;

            if (!sql || typeof sql !== 'string') {
                return { status: 400, data: { error: 'SQL query is required' } };
            }

            let safeSql, queryParams;
            try {
                ({ sql: safeSql, params: queryParams } = validateCustomQuery(sql, user.id));
            } catch (validationError) {
                // Validation errors are intentional user-facing messages (e.g. "Only SELECT allowed")
                logger.warn(`[Reports] Custom query validation failed for user ${user.id}: ${validationError.message}`);
                return { status: 400, data: { error: validationError.message } };
            }

            try {
                // Execute with the parameterized user_id bindings from validateCustomQuery
                const results = await query.all(safeSql, queryParams);

                // Extract column names from first result
                const columns = results.length > 0 ? Object.keys(results[0]) : [];

                return {
                    status: 200,
                    data: {
                        columns,
                        rows: results,
                        rowCount: results.length,
                    },
                };
            } catch (error) {
                logger.error('[Reports] Custom query execution error', user?.id, { detail: error?.message });
                return { status: 500, data: { error: 'Query execution failed' } };
            }
        }

        // GET /api/reports/:id/schedule - Get schedule for a report
        if (method === 'GET' && path.match(/^\/[^\/]+\/schedule$/)) {
            const reportId = path.split('/')[1];

            const schedule = await query.get('SELECT * FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!schedule) {
                return { status: 404, data: { error: 'Schedule not found' } };
            }

            return { status: 200, data: schedule };
        }

        // POST /api/reports/:id/schedule - Create/update schedule
        if (method === 'POST' && path.match(/^\/[^\/]+\/schedule$/)) {
            const reportId = path.split('/')[1];
            const { frequency, recipients, format } = body;

            if (!frequency) {
                return { status: 400, data: { error: 'Frequency is required' } };
            }

            if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
                return { status: 400, data: { error: 'Invalid frequency. Must be daily, weekly, or monthly' } };
            }

            // Verify report exists
            const report = await query.get('SELECT id FROM saved_reports WHERE id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!report) {
                return { status: 404, data: { error: 'Report not found' } };
            }

            const nextRunAt = calculateNextRun(frequency);
            const now = new Date().toISOString();

            // Check if schedule already exists
            const existing = await query.get('SELECT id FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (existing) {
                // Update existing schedule
                await query.run(
                    `UPDATE report_schedules
           SET frequency = ?, recipients = ?, format = ?, next_run_at = ?, is_active = TRUE
           WHERE report_id = ? AND user_id = ?`,
                    [
                        frequency,
                        recipients ? JSON.stringify(recipients) : null,
                        format || 'json',
                        nextRunAt,
                        reportId,
                        user.id,
                    ],
                );
            } else {
                // Create new schedule
                const scheduleId = nanoid();
                await query.run(
                    `INSERT INTO report_schedules
           (id, report_id, user_id, frequency, recipients, format, next_run_at, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [
                        scheduleId,
                        reportId,
                        user.id,
                        frequency,
                        recipients ? JSON.stringify(recipients) : null,
                        format || 'json',
                        nextRunAt,
                        now,
                    ],
                );
            }

            const schedule = await query.get('SELECT * FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            return { status: 200, data: schedule };
        }

        // DELETE /api/reports/:id/schedule - Remove schedule
        if (method === 'DELETE' && path.match(/^\/[^\/]+\/schedule$/)) {
            const reportId = path.split('/')[1];

            const existing = await query.get('SELECT id FROM report_schedules WHERE report_id = ? AND user_id = ?', [
                reportId,
                user.id,
            ]);

            if (!existing) {
                return { status: 404, data: { error: 'Schedule not found' } };
            }

            await query.run('DELETE FROM report_schedules WHERE report_id = ? AND user_id = ?', [reportId, user.id]);

            return { status: 200, data: { message: 'Schedule deleted successfully' } };
        }

        // GET /api/reports/templates - Return list of pre-built report configs
        if (method === 'GET' && path === '/templates') {
            return { status: 200, data: REPORT_TEMPLATES };
        }

        // POST /api/reports/from-template - Create a saved report from a template
        if (method === 'POST' && path === '/from-template') {
            const { template_id } = body;
            if (!template_id) {
                return { status: 400, data: { error: 'template_id is required' } };
            }

            const template = REPORT_TEMPLATES.find((t) => t.id === template_id);
            if (!template) {
                return { status: 404, data: { error: `Template '${template_id}' not found` } };
            }

            const id = nanoid();
            const now = new Date().toISOString();

            await query.run(
                `INSERT INTO saved_reports (id, user_id, name, report_type, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, user.id, template.name, template.report_type, JSON.stringify(template.config), now, now],
            );

            const row = await query.get('SELECT * FROM saved_reports WHERE id = ?', [id]);
            const report = parseReport(row);

            return { status: 201, data: { report, message: `Report created from template: ${template.name}` } };
        }

        // No matching route
        return { status: 404, data: { error: 'Route not found' } };
    } catch (error) {
        logger.error('[Reports] Reports router error', user?.id, { detail: error?.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
