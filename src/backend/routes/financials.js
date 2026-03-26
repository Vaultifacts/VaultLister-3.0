// Financials Routes - Purchases, Chart of Accounts, Transactions, Reports
import { v4 as uuidv4 } from 'uuid';
import { query, escapeLike } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { parsePagination } from '../shared/helpers.js';

// Defense-in-depth: allowed update fields per entity
const ALLOWED_PURCHASE_FIELDS = new Set(['vendorName', 'purchaseDate', 'paymentMethod', 'status', 'notes']);
const ALLOWED_ACCOUNT_FIELDS = new Set(['accountName', 'description', 'isActive']);
const ALLOWED_TRANSACTION_FIELDS = new Set(['description', 'amount', 'category', 'transactionDate', 'accountId']);
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

export async function financialsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ========== PURCHASES ENDPOINTS ==========

    // GET /api/financials/purchases - List all purchases
    if (method === 'GET' && (path === '/purchases' || path === '/purchases/')) {
        try {
            const { vendor, status, startDate, endDate } = queryParams;
            const { limit, offset } = parsePagination(queryParams, { limit: 50 });

            let sql = `
                SELECT p.*,
                       (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count
                FROM purchases p
                WHERE p.user_id = ?
            `;
            const params = [user.id];

            if (vendor) {
                sql += " AND p.vendor_name ILIKE ? ESCAPE '\\'";
                params.push(`%${escapeLike(vendor)}%`);
            }

            if (status) {
                sql += ' AND p.status = ?';
                params.push(status);
            }

            if (startDate) {
                sql += ' AND p.purchase_date >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND p.purchase_date <= ?';
                params.push(endDate);
            }

            sql += ' ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const purchases = await query.all(sql, params);
            const total = await query.get('SELECT COUNT(*) as count FROM purchases WHERE user_id = ?', [user.id])?.count || 0;

            // Calculate stats
            const stats = {
                totalPurchases: total,
                totalSpend: await query.get('SELECT SUM(total_amount) as total FROM purchases WHERE user_id = ? AND status = ?', [user.id, 'completed'])?.total || 0,
                avgPurchaseAmount: await query.get('SELECT AVG(total_amount) as avg FROM purchases WHERE user_id = ? AND status = ?', [user.id, 'completed'])?.avg || 0
            };

            return { status: 200, data: { purchases, total, stats } };
        } catch (error) {
            logger.error('[Financials] Error fetching purchases', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/financials/purchases/:id - Get single purchase with items
    if (method === 'GET' && path.match(/^\/purchases\/[a-f0-9-]+$/)) {
        try {
            const id = path.split('/')[2];
            const purchase = await query.get('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!purchase) {
                return { status: 404, data: { error: 'Purchase not found' } };
            }

            // Get line items
            const items = await query.all(`
                SELECT pi.*, i.title as inventory_title, i.sku as inventory_sku
                FROM purchase_items pi
                LEFT JOIN inventory i ON pi.inventory_id = i.id
                WHERE pi.purchase_id = ?
            `, [id]);

            return { status: 200, data: { purchase, items } };
        } catch (error) {
            logger.error('[Financials] Error fetching purchase', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/purchases - Create new purchase
    if (method === 'POST' && (path === '/purchases' || path === '/purchases/')) {
        if (!body) {
            return { status: 400, data: { error: 'Request body is required' } };
        }

        const {
            vendorName, purchaseDate, paymentMethod, items,
            shippingCost, taxAmount, notes, status = 'completed'
        } = body;

        if (!vendorName || !purchaseDate || !items || items.length === 0) {
            return { status: 400, data: { error: 'Vendor name, purchase date, and at least one item required' } };
        }

        // Validate non-negative costs
        if (shippingCost != null && shippingCost < 0) {
            return { status: 400, data: { error: 'Shipping cost cannot be negative' } };
        }
        if (taxAmount != null && taxAmount < 0) {
            return { status: 400, data: { error: 'Tax amount cannot be negative' } };
        }
        for (const item of items) {
            if (item.unitCost != null && item.unitCost < 0) {
                return { status: 400, data: { error: 'Unit cost cannot be negative' } };
            }
        }

        // Calculate total from items
        let itemsTotal = 0;
        for (const item of items) {
            itemsTotal += (item.quantity || 1) * (item.unitCost || 0);
        }
        const totalAmount = itemsTotal + (shippingCost || 0) + (taxAmount || 0);

        const purchaseId = uuidv4();

        // Wrap all database operations in a transaction for data consistency
        try {
            const createPurchase = async () => {
                // Generate purchase number INSIDE transaction to prevent race conditions
                const maxNum = await query.get(
                    `SELECT MAX(CAST(SUBSTR(purchase_number, 5) AS INTEGER)) as max_num FROM purchases WHERE user_id = ?`,
                    [user.id]
                )?.max_num || 0;
                const purchaseNumber = `PUR-${String(maxNum + 1).padStart(5, '0')}`;

                // Insert purchase
                await query.run(`
                    INSERT INTO purchases (
                        id, user_id, purchase_number, vendor_name, purchase_date,
                        total_amount, shipping_cost, tax_amount, payment_method,
                        status, source, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    purchaseId, user.id, purchaseNumber, vendorName, purchaseDate,
                    totalAmount, shippingCost || 0, taxAmount || 0, paymentMethod,
                    status, 'manual', notes
                ]);

                // Insert line items and create cost layers
                for (const item of items) {
                    const quantity = item.quantity || 1;
                    const unitCost = item.unitCost || 0;
                    const totalCost = quantity * unitCost;
                    const purchaseItemId = uuidv4();

                    // Insert purchase item
                    await query.run(`
                        INSERT INTO purchase_items (
                            id, purchase_id, inventory_id, description, quantity, unit_cost, total_cost
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [purchaseItemId, purchaseId, item.inventoryId || null, item.description, quantity, unitCost, totalCost]);

                    // If linked to inventory, create cost layer and update inventory
                    if (item.inventoryId) {
                        // Create inventory cost layer for FIFO
                        await query.run(`
                            INSERT INTO inventory_cost_layers (
                                id, inventory_id, purchase_item_id, quantity_original, quantity_remaining,
                                unit_cost, purchase_date
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [uuidv4(), item.inventoryId, purchaseItemId, quantity, quantity, unitCost, purchaseDate]);

                        // Atomic update: recalculate weighted average cost in single statement
                        await query.run(`
                            UPDATE inventory SET
                                quantity = COALESCE(quantity, 0) + ?,
                                cost_price = CASE
                                    WHEN COALESCE(quantity, 0) + ? > 0
                                    THEN ROUND((COALESCE(quantity, 0) * COALESCE(cost_price, 0) + ? * ?) / (COALESCE(quantity, 0) + ?), 2)
                                    ELSE ?
                                END,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ? AND user_id = ?
                        `, [quantity, quantity, quantity, unitCost, quantity, unitCost, item.inventoryId, user.id]);
                    }
                }

                // Create financial transaction record
                const cogsAccount = await query.get(
                    'SELECT id FROM accounts WHERE user_id = ? AND account_type = ? LIMIT 1',
                    [user.id, 'COGS']
                );

                if (cogsAccount) {
                    await query.run(`
                        INSERT INTO financial_transactions (
                            id, user_id, transaction_date, description, amount, account_id,
                            category, reference_type, reference_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        uuidv4(), user.id, purchaseDate, `Purchase: ${vendorName}`, -totalAmount,
                        cogsAccount.id, 'COGS', 'purchase', purchaseId
                    ]);
                }
            };

            // Execute all operations in a transaction
            await query.transaction(createPurchase);

            const purchase = await query.get('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
            const purchaseItems = await query.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);

            return { status: 201, data: { purchase, items: purchaseItems } };
        } catch (error) {
            logger.error('[Financials] Purchase creation error', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to create purchase. Transaction rolled back.' } };
        }
    }

    // PUT /api/financials/purchases/:id - Update purchase
    if (method === 'PUT' && path.match(/^\/purchases\/[a-f0-9-]+$/)) {
        try {
            const id = path.split('/')[2];

            const existing = await query.get('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Purchase not found' } };
            }

            const { vendorName, purchaseDate, paymentMethod, status, notes } = body;

            const updates = [];
            const values = [];

            if (vendorName !== undefined) {
                updates.push('vendor_name = ?');
                values.push(vendorName);
            }
            if (purchaseDate !== undefined) {
                updates.push('purchase_date = ?');
                values.push(purchaseDate);
            }
            if (paymentMethod !== undefined) {
                updates.push('payment_method = ?');
                values.push(paymentMethod);
            }
            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }
            if (notes !== undefined) {
                updates.push('notes = ?');
                values.push(notes);
            }

            if (updates.length > 0) {
                values.push(id, user.id);
                await query.run(
                    `UPDATE purchases SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                    values
                );
            }

            const purchase = await query.get('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [id, user.id]);
            return { status: 200, data: { purchase } };
        } catch (error) {
            logger.error('[Financials] Error updating purchase', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/financials/purchases/:id - Delete purchase
    if (method === 'DELETE' && path.match(/^\/purchases\/[a-f0-9-]+$/)) {
        const id = path.split('/')[2];

        const existing = await query.get('SELECT * FROM purchases WHERE id = ? AND user_id = ?', [id, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Purchase not found' } };
        }

        try {
            await query.transaction(() => {
                // Get items to reverse inventory updates
                const items = await query.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);

                for (const item of items) {
                    if (item.inventory_id) {
                        // Remove cost layer
                        await query.run('DELETE FROM inventory_cost_layers WHERE purchase_item_id = ?', [item.id]);

                        // Reduce inventory quantity
                        await query.run(`
                            UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ? AND user_id = ?
                        `, [item.quantity, item.inventory_id, user.id]);
                    }
                }

                // Delete related transactions
                await query.run('DELETE FROM financial_transactions WHERE reference_type = ? AND reference_id = ? AND user_id = ?', ['purchase', id, user.id]);

                // Delete purchase (cascades to purchase_items)
                await query.run('DELETE FROM purchases WHERE id = ? AND user_id = ?', [id, user.id]);
            });

            return { status: 200, data: { message: 'Purchase deleted successfully' } };
        } catch (error) {
            logger.error('[Financials] Purchase deletion error', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to delete purchase. Transaction rolled back.' } };
        }
    }

    // ========== ACCOUNTS (CHART OF ACCOUNTS) ENDPOINTS ==========

    // GET /api/financials/accounts - List all accounts grouped by type
    if (method === 'GET' && (path === '/accounts' || path === '/accounts/')) {
        try {
            const accounts = await query.all(`
                SELECT a.*,
                       (SELECT COALESCE(SUM(amount), 0) FROM financial_transactions WHERE account_id = a.id) as calculated_balance,
                       (SELECT COUNT(*) FROM financial_transactions WHERE account_id = a.id) as transaction_count
                FROM accounts a
                WHERE a.user_id = ? AND a.is_active = 1
                ORDER BY a.account_type, a.account_name
            `, [user.id]);

            // Group by type
            const grouped = {};
            const typeCategories = {
                'Bank': 'Assets',
                'AR': 'Assets',
                'Other Current Asset': 'Assets',
                'Fixed Asset': 'Assets',
                'Other Asset': 'Assets',
                'AP': 'Liabilities',
                'Credit Card': 'Liabilities',
                'Other Current Liability': 'Liabilities',
                'Long Term Liability': 'Liabilities',
                'Equity': 'Equity',
                'Income': 'Income',
                'Other Income': 'Income',
                'COGS': 'Expenses',
                'Expense': 'Expenses',
                'Other Expense': 'Expenses'
            };

            for (const account of accounts) {
                const category = typeCategories[account.account_type] || 'Other';
                if (!grouped[category]) {
                    grouped[category] = {};
                }
                if (!grouped[category][account.account_type]) {
                    grouped[category][account.account_type] = [];
                }
                grouped[category][account.account_type].push(account);
            }

            return { status: 200, data: { accounts, grouped } };
        } catch (error) {
            logger.error('[Financials] Error fetching accounts', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/financials/accounts/:id - Get single account with transactions
    if (method === 'GET' && path.match(/^\/accounts\/[a-f0-9-]+$/)) {
        try {
            const id = path.split('/')[2];
            const account = await query.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, user.id]);

            if (!account) {
                return { status: 404, data: { error: 'Account not found' } };
            }

            const transactions = await query.all(`
                SELECT * FROM financial_transactions
                WHERE account_id = ?
                ORDER BY transaction_date DESC, created_at DESC
                LIMIT 100
            `, [id]);

            const balance = await query.get('SELECT COALESCE(SUM(amount), 0) as balance FROM financial_transactions WHERE account_id = ?', [id])?.balance || 0;

            return { status: 200, data: { account, transactions, balance } };
        } catch (error) {
            logger.error('[Financials] Error fetching account', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/accounts - Create new account
    if (method === 'POST' && (path === '/accounts' || path === '/accounts/')) {
        try {
            const { accountName, accountType, description, parentAccountId, initialBalance, asOfDate } = body;

            if (!accountName || !accountType) {
                return { status: 400, data: { error: 'Account name and type required' } };
            }

            const validTypes = [
                'Bank', 'AR', 'Other Current Asset', 'Fixed Asset', 'Other Asset',
                'AP', 'Credit Card', 'Other Current Liability', 'Long Term Liability',
                'Equity', 'Income', 'COGS', 'Expense', 'Other Income', 'Other Expense'
            ];

            if (!validTypes.includes(accountType)) {
                return { status: 400, data: { error: 'Invalid account type' } };
            }

            const accountId = uuidv4();

            // Validate parent account if provided
            if (parentAccountId) {
                if (parentAccountId === accountId) {
                    return { status: 400, data: { error: 'Account cannot be its own parent' } };
                }
                const parentExists = await query.get('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [parentAccountId, user.id]);
                if (!parentExists) {
                    return { status: 400, data: { error: 'Parent account not found' } };
                }
            }

            await query.run(`
                INSERT INTO accounts (
                    id, user_id, account_name, account_type, description,
                    balance, parent_account_id, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [accountId, user.id, accountName, accountType, description, 0, parentAccountId || null, 1]);

            // Create initial balance transaction if provided
            if (initialBalance && initialBalance !== 0) {
                await query.run(`
                    INSERT INTO financial_transactions (
                        id, user_id, transaction_date, description, amount,
                        account_id, category, reference_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    uuidv4(), user.id, asOfDate || new Date().toISOString().split('T')[0],
                    'Opening Balance', initialBalance, accountId, accountType, 'manual'
                ]);
            }

            const account = await query.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
            return { status: 201, data: { account } };
        } catch (error) {
            logger.error('[Financials] Error creating account', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/financials/accounts/:id - Update account
    if (method === 'PUT' && path.match(/^\/accounts\/[a-f0-9-]+$/)) {
        try {
            const id = path.split('/')[2];

            const existing = await query.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Account not found' } };
            }

            const { accountName, description, isActive } = body;

            const updates = [];
            const values = [];

            if (accountName !== undefined) {
                updates.push('account_name = ?');
                values.push(accountName);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }
            if (isActive !== undefined) {
                updates.push('is_active = ?');
                values.push(isActive ? 1 : 0);
            }

            if (updates.length > 0) {
                values.push(id, user.id);
                await query.run(
                    `UPDATE accounts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                    values
                );
            }

            const account = await query.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, user.id]);
            return { status: 200, data: { account } };
        } catch (error) {
            logger.error('[Financials] Error updating account', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/financials/accounts/:id - Delete account (only if no transactions)
    if (method === 'DELETE' && path.match(/^\/accounts\/[a-f0-9-]+$/)) {
        try {
            const id = path.split('/')[2];

            const existing = await query.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Account not found' } };
            }

            const transactionCount = await query.get('SELECT COUNT(*) as count FROM financial_transactions WHERE account_id = ?', [id])?.count || 0;
            if (transactionCount > 0) {
                return { status: 400, data: { error: 'Cannot delete account with transactions. Deactivate instead.' } };
            }

            await query.run('DELETE FROM accounts WHERE id = ? AND user_id = ?', [id, user.id]);
            return { status: 200, data: { message: 'Account deleted successfully' } };
        } catch (error) {
            logger.error('[Financials] Error deleting account', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== TRANSACTIONS ENDPOINTS ==========

    // GET /api/financials/transactions - List all transactions
    if (method === 'GET' && (path === '/transactions' || path === '/transactions/')) {
        try {
            const { accountId, referenceType, startDate, endDate } = queryParams;
            const { limit, offset } = parsePagination(queryParams, { limit: 100 });

            let sql = `
                SELECT t.*, a.account_name, a.account_type
                FROM financial_transactions t
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE t.user_id = ?
            `;
            const params = [user.id];

            if (accountId) {
                sql += ' AND t.account_id = ?';
                params.push(accountId);
            }

            if (referenceType) {
                sql += ' AND t.reference_type = ?';
                params.push(referenceType);
            }

            if (startDate) {
                sql += ' AND t.transaction_date >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND t.transaction_date <= ?';
                params.push(endDate);
            }

            sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const transactions = await query.all(sql, params);
            const total = await query.get('SELECT COUNT(*) as count FROM financial_transactions WHERE user_id = ?', [user.id])?.count || 0;

            return { status: 200, data: { transactions, total } };
        } catch (error) {
            logger.error('[Financials] Error fetching transactions', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/transactions - Create manual transaction
    if (method === 'POST' && (path === '/transactions' || path === '/transactions/')) {
        try {
            const { transactionDate, description, amount, accountId, category } = body;

            if (!transactionDate || !description || amount === undefined || !accountId) {
                return { status: 400, data: { error: 'Transaction date, description, amount, and account required' } };
            }

            // Validate amount
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
                return { status: 400, data: { error: 'Amount must be a valid number' } };
            }
            if (Math.abs(parsedAmount) > 999999999) {
                return { status: 400, data: { error: 'Amount exceeds maximum allowed value' } };
            }

            // Verify account exists and belongs to user
            const account = await query.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accountId, user.id]);
            if (!account) {
                return { status: 400, data: { error: 'Invalid account' } };
            }

            const transactionId = uuidv4();
            await query.run(`
                INSERT INTO financial_transactions (
                    id, user_id, transaction_date, description, amount,
                    account_id, category, reference_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [transactionId, user.id, transactionDate, description, parsedAmount, accountId, category || account.account_type, 'manual']);

            const transaction = await query.get('SELECT * FROM financial_transactions WHERE id = ?', [transactionId]);
            return { status: 201, data: { transaction } };
        } catch (error) {
            logger.error('[Financials] Error creating transaction', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== REPORTS ENDPOINTS ==========

    // GET /api/financials/statements - Generate financial statements
    if (method === 'GET' && path === '/statements') {
        try {
            const { start, end } = queryParams;

            const dateFilter = start && end
                ? 'AND t.transaction_date BETWEEN ? AND ?'
                : '';
            const dateParams = start && end ? [start, end] : [];

            // Get account balances by type
            const getBalanceByTypes = (types) => {
                const placeholders = types.map(() => '?').join(',');
                const sql = `
                    SELECT a.id, a.account_name, a.account_type,
                           COALESCE(SUM(t.amount), 0) as balance
                    FROM accounts a
                    LEFT JOIN financial_transactions t ON t.account_id = a.id ${dateFilter}
                    WHERE a.user_id = ? AND a.account_type IN (${placeholders}) AND a.is_active = 1
                    GROUP BY a.id
                    ORDER BY a.account_type, a.account_name
                `;
                return await query.all(sql, [...dateParams, user.id, ...types]);
            };

            const statements = {
                asOfDate: end || new Date().toISOString().split('T')[0],
                assets: {
                    currentAssets: {
                        bank: getBalanceByTypes(['Bank']),
                        accountsReceivable: getBalanceByTypes(['AR']),
                        otherCurrent: getBalanceByTypes(['Other Current Asset'])
                    },
                    fixedAssets: getBalanceByTypes(['Fixed Asset']),
                    otherAssets: getBalanceByTypes(['Other Asset'])
                },
                liabilities: {
                    currentLiabilities: {
                        accountsPayable: getBalanceByTypes(['AP']),
                        creditCards: getBalanceByTypes(['Credit Card']),
                        otherCurrent: getBalanceByTypes(['Other Current Liability'])
                    },
                    longTermLiabilities: getBalanceByTypes(['Long Term Liability'])
                },
                equity: getBalanceByTypes(['Equity'])
            };

            // Calculate totals
            const sumBalances = (accounts) => accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

            statements.totals = {
                currentAssets: sumBalances(statements.assets.currentAssets.bank) +
                              sumBalances(statements.assets.currentAssets.accountsReceivable) +
                              sumBalances(statements.assets.currentAssets.otherCurrent),
                fixedAssets: sumBalances(statements.assets.fixedAssets),
                otherAssets: sumBalances(statements.assets.otherAssets),
                currentLiabilities: sumBalances(statements.liabilities.currentLiabilities.accountsPayable) +
                                   sumBalances(statements.liabilities.currentLiabilities.creditCards) +
                                   sumBalances(statements.liabilities.currentLiabilities.otherCurrent),
                longTermLiabilities: sumBalances(statements.liabilities.longTermLiabilities),
                equity: sumBalances(statements.equity)
            };

            statements.totals.totalAssets = statements.totals.currentAssets +
                                            statements.totals.fixedAssets +
                                            statements.totals.otherAssets;

            statements.totals.totalLiabilities = statements.totals.currentLiabilities +
                                                 statements.totals.longTermLiabilities;

            statements.totals.totalLiabilitiesAndEquity = statements.totals.totalLiabilities +
                                                          statements.totals.equity;

            statements.balanceCheck = Math.abs(statements.totals.totalAssets - statements.totals.totalLiabilitiesAndEquity) < 0.01;

            return { status: 200, data: { statements } };
        } catch (error) {
            logger.error('[Financials] Error generating financial statements', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/financials/profit-loss - Generate P&L report
    if (method === 'GET' && path === '/profit-loss') {
        try {
            const { start, end } = queryParams;

            const dateFilter = start && end
                ? 'AND t.transaction_date BETWEEN ? AND ?'
                : '';
            const dateParams = start && end ? [start, end] : [];

            // Get totals by account type
            const getTotalByTypes = (types) => {
                const placeholders = types.map(() => '?').join(',');
                const sql = `
                    SELECT a.id, a.account_name, a.account_type,
                           COALESCE(SUM(t.amount), 0) as total
                    FROM accounts a
                    LEFT JOIN financial_transactions t ON t.account_id = a.id ${dateFilter}
                    WHERE a.user_id = ? AND a.account_type IN (${placeholders}) AND a.is_active = 1
                    GROUP BY a.id
                    ORDER BY a.account_name
                `;
                return await query.all(sql, [...dateParams, user.id, ...types]);
            };

            const sumTotals = (accounts) => accounts.reduce((sum, a) => sum + Math.abs(a.total || 0), 0);

            const incomeAccounts = getTotalByTypes(['Income']);
            const otherIncomeAccounts = getTotalByTypes(['Other Income']);
            const cogsAccounts = getTotalByTypes(['COGS']);
            const expenseAccounts = getTotalByTypes(['Expense']);
            const otherExpenseAccounts = getTotalByTypes(['Other Expense']);

            let totalIncome = sumTotals(incomeAccounts) + sumTotals(otherIncomeAccounts);
            let totalCOGS = sumTotals(cogsAccounts);

            // Fall back to sales table when no double-entry data exists for this user
            if (totalIncome === 0 && totalCOGS === 0) {
                const salesDateFilter = start && end ? 'AND created_at BETWEEN ? AND ?' : '';
                const salesQueryParams = start && end ? [user.id, start, end] : [user.id];
                const salesTotals = await query.get(
                    `SELECT COALESCE(SUM(sale_price), 0) as revenue,
                            COALESCE(SUM(COALESCE(item_cost, 0)), 0) as cogs,
                            COALESCE(SUM(COALESCE(platform_fee, 0)), 0) as fees,
                            COALESCE(SUM(COALESCE(shipping_cost, 0)), 0) as shipping
                     FROM sales WHERE user_id = ? ${salesDateFilter}`,
                    salesQueryParams
                );
                if (salesTotals && salesTotals.revenue > 0) {
                    incomeAccounts.push({ id: 'sales', account_name: 'Sales Revenue', account_type: 'Income', total: salesTotals.revenue });
                    totalIncome = salesTotals.revenue;
                    if (salesTotals.cogs > 0) {
                        cogsAccounts.push({ id: 'cogs', account_name: 'Cost of Goods Sold', account_type: 'COGS', total: salesTotals.cogs });
                        totalCOGS = salesTotals.cogs;
                    }
                    const totalFees = (salesTotals.fees || 0) + (salesTotals.shipping || 0);
                    if (totalFees > 0) {
                        expenseAccounts.push({ id: 'fees', account_name: 'Platform Fees & Shipping', account_type: 'Expense', total: totalFees });
                    }
                }
            }

            const grossProfit = totalIncome - totalCOGS;
            const totalExpenses = sumTotals(expenseAccounts) + sumTotals(otherExpenseAccounts);
            const netIncome = grossProfit - totalExpenses;

            const profitLoss = {
                period: { start, end },
                income: {
                    accounts: incomeAccounts,
                    otherIncome: otherIncomeAccounts,
                    total: totalIncome
                },
                costOfGoodsSold: {
                    accounts: cogsAccounts,
                    total: totalCOGS
                },
                grossProfit: {
                    amount: grossProfit,
                    margin: totalIncome > 0 ? (grossProfit / totalIncome * 100).toFixed(2) : 0
                },
                expenses: {
                    accounts: expenseAccounts,
                    otherExpenses: otherExpenseAccounts,
                    total: totalExpenses
                },
                netIncome: {
                    amount: netIncome,
                    margin: totalIncome > 0 ? (netIncome / totalIncome * 100).toFixed(2) : 0
                }
            };

            return { status: 200, data: { profitLoss } };
        } catch (error) {
            logger.error('[Financials] Error generating profit and loss report', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== FIFO HELPER - Consume cost layers ==========
    // POST /api/financials/consume-fifo - Internal endpoint for FIFO consumption
    if (method === 'POST' && path === '/consume-fifo') {
        try {
            const { inventoryId, quantity, saleId } = body;

            if (!inventoryId || !quantity) {
                return { status: 400, data: { error: 'Inventory ID and quantity required' } };
            }

            // SECURITY: Validate quantity to prevent negative or non-finite values corrupting inventory
            if (!Number.isFinite(quantity) || quantity <= 0) {
                return { status: 400, data: { error: 'Invalid quantity' } };
            }

            // Verify inventory item belongs to user
            const ownerCheck = await query.get('SELECT id FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id]);
            if (!ownerCheck) {
                return { status: 404, data: { error: 'Inventory item not found' } };
            }

            // Get cost layers in FIFO order (oldest first)
            const layers = await query.all(`
                SELECT * FROM inventory_cost_layers
                WHERE inventory_id = ? AND quantity_remaining > 0
                ORDER BY purchase_date ASC, created_at ASC
            `, [inventoryId]);

            let remainingQty = quantity;
            let totalCOGS = 0;
            const consumedLayers = [];

            for (const layer of layers) {
                if (remainingQty <= 0) break;

                const qtyToConsume = Math.min(remainingQty, layer.quantity_remaining);
                const layerCOGS = qtyToConsume * layer.unit_cost;

                totalCOGS += layerCOGS;
                remainingQty -= qtyToConsume;

                // Update layer
                await query.run(`
                    UPDATE inventory_cost_layers
                    SET quantity_remaining = quantity_remaining - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [qtyToConsume, layer.id]);

                consumedLayers.push({
                    layerId: layer.id,
                    quantityConsumed: qtyToConsume,
                    unitCost: layer.unit_cost,
                    layerCOGS
                });
            }

            // Update sale with item_cost if saleId provided
            if (saleId) {
                await query.run('UPDATE sales SET item_cost = ? WHERE id = ? AND user_id = ?', [totalCOGS, saleId, user.id]);

                // Recalculate net_profit
                const sale = await query.get('SELECT * FROM sales WHERE id = ? AND user_id = ?', [saleId, user.id]);
                if (sale) {
                    const netProfit = (sale.sale_price || 0) -
                                      (sale.platform_fee || 0) -
                                      totalCOGS -
                                      (sale.seller_shipping_cost || sale.shipping_cost || 0) -
                                      (sale.tax_amount || 0);
                    await query.run('UPDATE sales SET net_profit = ? WHERE id = ? AND user_id = ?', [netProfit, saleId, user.id]);
                }
            }

            // Update inventory quantity
            await query.run(`
                UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `, [quantity, inventoryId, user.id]);

            return {
                status: 200,
                data: {
                    totalCOGS,
                    consumedLayers,
                    remainingUnconsumed: remainingQty > 0 ? remainingQty : 0
                }
            };
        } catch (error) {
            logger.error('[Financials] Error consuming FIFO cost layers', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== EMAIL PARSING (Phase 2 Infrastructure) ==========

    // POST /api/financials/email-parse - Email parsing webhook (Phase 2, non-production only)
    if (method === 'POST' && path === '/email-parse') {
        try {
            return {
                status: 501,
                data: {
                    error: 'Email parsing not yet implemented',
                    message: 'Email parsing integration is planned for Phase 2'
                }
            };
        } catch (error) {
            logger.error('[Financials] Error in email parse endpoint', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== SEED DEFAULT ACCOUNTS ==========

    // POST /api/financials/seed-accounts - Create default accounts for new user
    if (method === 'POST' && path === '/seed-accounts') {
        try {
            // Check if user already has accounts
            const existingCount = await query.get('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?', [user.id])?.count || 0;
            if (existingCount > 0) {
                return { status: 200, data: { message: 'Accounts already exist', count: existingCount } };
            }

            const defaultAccounts = [
                // Assets
                { name: 'Business Checking', type: 'Bank' },
                { name: 'PayPal', type: 'Bank' },
                { name: 'Accounts Receivable', type: 'AR' },
                { name: 'Inventory', type: 'Other Current Asset' },
                // Liabilities
                { name: 'Accounts Payable', type: 'AP' },
                { name: 'Business Credit Card', type: 'Credit Card' },
                // Equity
                { name: 'Owner\'s Equity', type: 'Equity' },
                { name: 'Retained Earnings', type: 'Equity' },
                // Income
                { name: 'Product Sales', type: 'Income' },
                { name: 'Shipping Revenue', type: 'Income' },
                { name: 'Other Income', type: 'Other Income' },
                // Expenses
                { name: 'Cost of Goods Sold', type: 'COGS' },
                { name: 'Platform Fees', type: 'Expense' },
                { name: 'Shipping Expense', type: 'Expense' },
                { name: 'Packaging Supplies', type: 'Expense' },
                { name: 'Office Supplies', type: 'Expense' },
                { name: 'Marketing', type: 'Expense' }
            ];

            for (const account of defaultAccounts) {
                await query.run(`
                    INSERT INTO accounts (id, user_id, account_name, account_type, is_active)
                    VALUES (?, ?, ?, ?, 1)
                `, [uuidv4(), user.id, account.name, account.type]);
            }

            return { status: 201, data: { message: 'Default accounts created', count: defaultAccounts.length } };
        } catch (error) {
            logger.error('[Financials] Error seeding default accounts', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== CATEGORIZATION RULES ENDPOINTS ==========

    // GET /api/financials/categorization-rules - List all categorization rules
    if (method === 'GET' && path === '/categorization-rules') {
        try {
            const rules = await query.all(`
                SELECT cr.*, a.account_name
                FROM categorization_rules cr
                LEFT JOIN accounts a ON cr.account_id = a.id
                WHERE cr.user_id = ?
                ORDER BY cr.pattern ASC
            `, [user.id]);

            return { status: 200, data: { rules } };
        } catch (error) {
            logger.error('[Financials] Error fetching categorization rules', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/categorization-rules - Create new categorization rule
    if (method === 'POST' && path === '/categorization-rules') {
        try {
            const { pattern, accountId, description } = body;

            if (!pattern || !accountId) {
                return { status: 400, data: { error: 'Pattern and account are required' } };
            }

            // Verify account exists and belongs to user
            const account = await query.get('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, user.id]);
            if (!account) {
                return { status: 400, data: { error: 'Invalid account' } };
            }

            const ruleId = uuidv4();
            await query.run(`
                INSERT INTO categorization_rules (id, user_id, pattern, account_id, description, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `, [ruleId, user.id, pattern, accountId, description || null]);

            return { status: 201, data: { id: ruleId, message: 'Categorization rule created' } };
        } catch (error) {
            logger.error('[Financials] Error creating categorization rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/financials/categorization-rules/:id - Delete a categorization rule
    if (method === 'DELETE' && path.match(/^\/categorization-rules\/[a-f0-9-]+$/)) {
        try {
            const ruleId = path.split('/')[2];

            const result = await query.run('DELETE FROM categorization_rules WHERE id = ? AND user_id = ?', [ruleId, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Rule not found' } };
            }

            return { status: 200, data: { message: 'Categorization rule deleted' } };
        } catch (error) {
            logger.error('[Financials] Error deleting categorization rule', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== AUTO-CATEGORIZE ENDPOINT ==========

    // POST /api/financials/auto-categorize - Apply categorization rules to uncategorized transactions
    if (method === 'POST' && path === '/auto-categorize') {
        try {
            const rules = await query.all(`
                SELECT cr.*, a.account_name, a.account_type
                FROM categorization_rules cr
                LEFT JOIN accounts a ON cr.account_id = a.id
                WHERE cr.user_id = ?
            `, [user.id]);

            if (rules.length === 0) {
                return { status: 400, data: { error: 'No categorization rules defined. Create rules first.' } };
            }

            const uncategorized = await query.all(`
                SELECT * FROM financial_transactions
                WHERE user_id = ? AND (category IS NULL OR category = '' OR category = 'Uncategorized')
                ORDER BY transaction_date DESC
            `, [user.id]);

            let categorized = 0;
            for (const tx of uncategorized) {
                const desc = (tx.description || '').toLowerCase();
                for (const rule of rules) {
                    const pattern = (rule.pattern || '').toLowerCase();
                    if (pattern && desc.includes(pattern)) {
                        await query.run(`
                            UPDATE financial_transactions
                            SET category = ?, account_id = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [rule.account_type || rule.account_name, rule.account_id, tx.id]);
                        categorized++;
                        break;
                    }
                }
            }

            return { status: 200, data: { message: `Auto-categorized ${categorized} of ${uncategorized.length} transactions`, categorized, total: uncategorized.length } };
        } catch (error) {
            logger.error('[Financials] Error auto-categorizing transactions', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== TRANSACTION SPLIT ==========

    // POST /api/financials/transactions/:id/split - Split a transaction into parts
    if (method === 'POST' && path.match(/^\/transactions\/[a-f0-9-]+\/split$/)) {
        try {
            const id = path.split('/')[2];

            const original = await query.get('SELECT * FROM financial_transactions WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!original) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }

            const { splits } = body;
            if (!splits || !Array.isArray(splits) || splits.length < 2) {
                return { status: 400, data: { error: 'At least 2 splits required' } };
            }

            const totalSplit = splits.reduce((sum, s) => sum + Math.round((parseFloat(s.amount) || 0) * 100), 0) / 100;
            if (Math.abs(totalSplit - Math.abs(original.amount)) > 0.01) {
                return { status: 400, data: { error: `Split amounts ($${totalSplit.toFixed(2)}) must equal original ($${Math.abs(original.amount).toFixed(2)})` } };
            }

            // Build the split note from validated integer — bind as a parameter to avoid interpolation
            const splitCount = splits.length; // guaranteed integer (Array.length)
            const splitNote = `Split into ${splitCount} parts`;

            // Mark original as split parent
            await query.run(`
                UPDATE financial_transactions SET is_split = 1, split_note = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [splitNote, id]);

            // Log to audit — new_value bound as parameter, never interpolated into SQL
            await query.run(`
                INSERT INTO transaction_audit_log (id, transaction_id, user_id, action, field_name, old_value, new_value)
                VALUES (?, ?, ?, 'split', 'amount', ?, ?)
            `, [uuidv4(), id, user.id, String(original.amount), splitNote]);

            const childTransactions = [];
            const sign = original.amount < 0 ? -1 : 1;
            for (const split of splits) {
                const childId = uuidv4();
                await query.run(`
                    INSERT INTO financial_transactions (
                        id, user_id, transaction_date, description, amount,
                        account_id, category, reference_type, parent_transaction_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'split', ?)
                `, [
                    childId, user.id, original.transaction_date,
                    split.description || original.description,
                    sign * Math.abs(parseFloat(split.amount)),
                    split.accountId || original.account_id,
                    split.category || original.category,
                    id
                ]);
                childTransactions.push(await query.get('SELECT * FROM financial_transactions WHERE id = ?', [childId]));
            }

            // Zero out original amount since children now hold it
            await query.run('UPDATE financial_transactions SET amount = 0 WHERE id = ? AND user_id = ?', [id, user.id]);

            return { status: 200, data: { message: 'Transaction split successfully', parent: id, children: childTransactions } };
        } catch (error) {
            logger.error('[Financials] Error splitting transaction', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== RECURRING TRANSACTION TEMPLATES ==========

    // GET /api/financials/recurring-templates - List recurring templates
    if (method === 'GET' && path === '/recurring-templates') {
        try {
            const templates = await query.all(`
                SELECT rt.*, a.account_name
                FROM recurring_transaction_templates rt
                LEFT JOIN accounts a ON rt.account_id = a.id
                WHERE rt.user_id = ?
                ORDER BY rt.created_at DESC
            `, [user.id]);
            return { status: 200, data: { templates } };
        } catch (error) {
            logger.error('[Financials] Error fetching recurring templates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/recurring-templates - Create a recurring template
    if (method === 'POST' && path === '/recurring-templates') {
        try {
            const { description, amount, accountId, category, frequency } = body;

            if (!description || amount === undefined || !accountId) {
                return { status: 400, data: { error: 'Description, amount, and account required' } };
            }

            const templateId = uuidv4();
            await query.run(`
                INSERT INTO recurring_transaction_templates (id, user_id, description, amount, account_id, category, frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [templateId, user.id, description, amount, accountId, category || 'Expense', frequency || 'monthly']);

            return { status: 201, data: { id: templateId, message: 'Recurring template created' } };
        } catch (error) {
            logger.error('[Financials] Error creating recurring template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/recurring-templates/:id/execute - Execute a recurring template
    if (method === 'POST' && path.match(/^\/recurring-templates\/[a-f0-9-]+\/execute$/)) {
        try {
            const templateId = path.split('/')[2];
            const template = await query.get('SELECT * FROM recurring_transaction_templates WHERE id = ? AND user_id = ?', [templateId, user.id]);

            if (!template) {
                return { status: 404, data: { error: 'Template not found' } };
            }

            const txId = uuidv4();
            await query.run(`
                INSERT INTO financial_transactions (
                    id, user_id, transaction_date, description, amount,
                    account_id, category, reference_type, reference_id
                ) VALUES (?, ?, date('now'), ?, ?, ?, ?, 'recurring', ?)
            `, [txId, user.id, template.description, template.amount, template.account_id, template.category, templateId]);

            // Update last_executed
            await query.run('UPDATE recurring_transaction_templates SET last_executed = NOW() WHERE id = ?', [templateId]);

            const transaction = await query.get('SELECT * FROM financial_transactions WHERE id = ?', [txId]);
            return { status: 201, data: { transaction, message: 'Recurring transaction created' } };
        } catch (error) {
            logger.error('[Financials] Error executing recurring template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/financials/recurring-templates/:id - Delete a recurring template
    if (method === 'DELETE' && path.match(/^\/recurring-templates\/[a-f0-9-]+$/)) {
        try {
            const templateId = path.split('/')[2];
            const result = await query.run('DELETE FROM recurring_transaction_templates WHERE id = ? AND user_id = ?', [templateId, user.id]);
            if (result.changes === 0) {
                return { status: 404, data: { error: 'Template not found' } };
            }
            return { status: 200, data: { message: 'Recurring template deleted' } };
        } catch (error) {
            logger.error('[Financials] Error deleting recurring template', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== TRANSACTION ATTACHMENTS ==========

    // GET /api/financials/transactions/:id/attachments - List attachments
    if (method === 'GET' && path.match(/^\/transactions\/[a-f0-9-]+\/attachments$/)) {
        try {
            const txId = path.split('/')[2];
            const tx = await query.get('SELECT id FROM financial_transactions WHERE id = ? AND user_id = ?', [txId, user.id]);
            if (!tx) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }
            const attachments = await query.all('SELECT id, transaction_id, file_name, file_type, file_size, created_at FROM transaction_attachments WHERE transaction_id = ?', [txId]);
            return { status: 200, data: { attachments } };
        } catch (error) {
            logger.error('[Financials] Error fetching transaction attachments', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/financials/transactions/:id/attachments - Attach a receipt
    if (method === 'POST' && path.match(/^\/transactions\/[a-f0-9-]+\/attachments$/)) {
        try {
            const txId = path.split('/')[2];
            const tx = await query.get('SELECT id FROM financial_transactions WHERE id = ? AND user_id = ?', [txId, user.id]);
            if (!tx) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }

            const { fileName, fileType, fileData } = body;
            if (!fileName || !fileData) {
                return { status: 400, data: { error: 'File name and data required' } };
            }

            // Validate size (2MB limit for base64)
            const sizeBytes = Math.ceil((fileData.length * 3) / 4);
            if (sizeBytes > 2 * 1024 * 1024) {
                return { status: 400, data: { error: 'File too large (max 2MB)' } };
            }

            const attachId = uuidv4();
            await query.run(`
                INSERT INTO transaction_attachments (id, transaction_id, file_name, file_type, file_size, file_data)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [attachId, txId, fileName, fileType || 'image/jpeg', sizeBytes, fileData]);

            return { status: 201, data: { id: attachId, message: 'Attachment added' } };
        } catch (error) {
            logger.error('[Financials] Error adding transaction attachment', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/financials/transactions/:id/attachments/:attachId - Delete attachment
    if (method === 'DELETE' && path.match(/^\/transactions\/[a-f0-9-]+\/attachments\/[a-f0-9-]+$/)) {
        try {
            const parts = path.split('/');
            const txId = parts[2];
            const attachId = parts[4];

            const tx = await query.get('SELECT id FROM financial_transactions WHERE id = ? AND user_id = ?', [txId, user.id]);
            if (!tx) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }

            const result = await query.run('DELETE FROM transaction_attachments WHERE id = ? AND transaction_id = ?', [attachId, txId]);
            if (result.changes === 0) {
                return { status: 404, data: { error: 'Attachment not found' } };
            }
            return { status: 200, data: { message: 'Attachment deleted' } };
        } catch (error) {
            logger.error('[Financials] Error deleting transaction attachment', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== PLATFORM FEES REPORTING ==========

    // GET /api/financials/platform-fees - Get platform fee breakdown by platform
    if (method === 'GET' && (path === '/platform-fees' || path === '/platform-fees/')) {
        try {
            const { startDate, endDate } = queryParams;

            let sql = `
                SELECT
                    platform,
                    COUNT(*) as transaction_count,
                    SUM(platform_fee) as total_fees,
                    SUM(sale_price) as total_sales,
                    CASE
                        WHEN SUM(sale_price) > 0
                        THEN (SUM(platform_fee) / SUM(sale_price)) * 100
                        ELSE 0
                    END as fee_percentage
                FROM sales
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (startDate) {
                sql += ' AND created_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND created_at <= ?';
                params.push(endDate);
            }

            sql += ' GROUP BY platform ORDER BY total_fees DESC';

            const platformFees = await query.all(sql, params);

            return { status: 200, data: { platformFees } };
        } catch (error) {
            logger.error('[Financials] Error fetching platform fees', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/financials/platform-fees/summary - Get aggregate platform fee summary
    if (method === 'GET' && path === '/platform-fees/summary') {
        try {
            const { startDate, endDate } = queryParams;

            let sql = `
                SELECT
                    COUNT(*) as total_transactions,
                    COUNT(DISTINCT platform) as platform_count,
                    SUM(platform_fee) as total_fees,
                    SUM(sale_price) as total_sales,
                    CASE
                        WHEN SUM(sale_price) > 0
                        THEN (SUM(platform_fee) / SUM(sale_price)) * 100
                        ELSE 0
                    END as overall_fee_percentage,
                    AVG(platform_fee) as avg_fee_per_transaction
                FROM sales
                WHERE user_id = ?
            `;
            const params = [user.id];

            if (startDate) {
                sql += ' AND created_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND created_at <= ?';
                params.push(endDate);
            }

            const summary = await query.get(sql, params);

            return { status: 200, data: { summary } };
        } catch (error) {
            logger.error('[Financials] Error fetching platform fees summary', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ========== TRANSACTION AUDIT LOG ==========

    // GET /api/financials/transactions/:id/audit - Get audit log for a transaction
    if (method === 'GET' && path.match(/^\/transactions\/[a-f0-9-]+\/audit$/)) {
        try {
            const txId = path.split('/')[2];
            const tx = await query.get('SELECT id FROM financial_transactions WHERE id = ? AND user_id = ?', [txId, user.id]);
            if (!tx) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }
            const logs = await query.all('SELECT * FROM transaction_audit_log WHERE transaction_id = ? ORDER BY created_at DESC', [txId]);
            return { status: 200, data: { logs } };
        } catch (error) {
            logger.error('[Financials] Error fetching transaction audit log', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/financials/transactions/:id - Update a transaction (with audit logging)
    if (method === 'PUT' && path.match(/^\/transactions\/[a-f0-9-]+$/) && !path.includes('/attachments') && !path.includes('/audit')) {
        try {
            const id = path.split('/')[2];
            const existing = await query.get('SELECT * FROM financial_transactions WHERE id = ? AND user_id = ?', [id, user.id]);
            if (!existing) {
                return { status: 404, data: { error: 'Transaction not found' } };
            }

            const { description, amount, category, transactionDate, accountId } = body;
            const updates = [];
            const values = [];

            // Track changes for audit log
            const changes = [];

            if (description !== undefined && description !== existing.description) {
                updates.push('description = ?');
                values.push(description);
                changes.push({ field: 'description', old: existing.description, new: description });
            }
            if (amount !== undefined && amount !== existing.amount) {
                updates.push('amount = ?');
                values.push(amount);
                changes.push({ field: 'amount', old: String(existing.amount), new: String(amount) });
            }
            if (category !== undefined && category !== existing.category) {
                updates.push('category = ?');
                values.push(category);
                changes.push({ field: 'category', old: existing.category, new: category });
            }
            if (transactionDate !== undefined && transactionDate !== existing.transaction_date) {
                updates.push('transaction_date = ?');
                values.push(transactionDate);
                changes.push({ field: 'transaction_date', old: existing.transaction_date, new: transactionDate });
            }
            if (accountId !== undefined && accountId !== existing.account_id) {
                updates.push('account_id = ?');
                values.push(accountId);
                changes.push({ field: 'account_id', old: existing.account_id, new: accountId });
            }

            if (updates.length > 0) {
                values.push(id, user.id);
                await query.run(`UPDATE financial_transactions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, values);

                // Write audit log entries
                for (const change of changes) {
                    await query.run(`
                        INSERT INTO transaction_audit_log (id, transaction_id, user_id, action, field_name, old_value, new_value)
                        VALUES (?, ?, ?, 'update', ?, ?, ?)
                    `, [uuidv4(), id, user.id, change.field, change.old || '', change.new || '']);
                }
            }

            const transaction = await query.get('SELECT * FROM financial_transactions WHERE id = ? AND user_id = ?', [id, user.id]);
            return { status: 200, data: { transaction, changes: changes.length } };
        } catch (error) {
            logger.error('[Financials] Error updating transaction', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
