-- Migration 018: Add Financial Accounting Tables
-- Creates tables for enhanced financial tracking with FIFO inventory costing

-- Chart of Accounts - 15 account types for organizing financial data
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN (
        'Bank', 'AR', 'Other Current Asset', 'Fixed Asset', 'Other Asset',
        'AP', 'Credit Card', 'Other Current Liability', 'Long Term Liability',
        'Equity', 'Income', 'COGS', 'Expense', 'Other Income', 'Other Expense'
    )),
    description TEXT,
    balance REAL DEFAULT 0,
    parent_account_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);

-- Purchases - Track inventory purchases from vendors
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purchase_number TEXT,
    vendor_name TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Credit Card', 'Bank Transfer', 'Check', 'PayPal', 'Other')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'import')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor ON purchases(vendor_name);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- Purchase Items - Line items for each purchase
CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    inventory_id TEXT,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_inventory ON purchase_items(inventory_id);

-- Financial Transactions - All financial movements
CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id TEXT,
    category TEXT,
    reference_type TEXT CHECK (reference_type IN ('purchase', 'sale', 'expense', 'income', 'manual', 'transfer')),
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account ON financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_ref ON financial_transactions(reference_type, reference_id);

-- Inventory Cost Layers - FIFO costing tracking
CREATE TABLE IF NOT EXISTS inventory_cost_layers (
    id TEXT PRIMARY KEY,
    inventory_id TEXT,
    purchase_item_id TEXT,
    quantity_original INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    purchase_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_layers_inventory ON inventory_cost_layers(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cost_layers_remaining ON inventory_cost_layers(inventory_id, quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_cost_layers_date ON inventory_cost_layers(purchase_date);

-- Email Parse Queue - Infrastructure for Phase 2 email parsing
CREATE TABLE IF NOT EXISTS email_parse_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_subject TEXT,
    email_from TEXT,
    email_body TEXT,
    email_date DATETIME,
    parsed_data TEXT, -- JSON of parsed purchase data
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_parse_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_parse_queue(status);

-- Seed default accounts for new users (triggered by application code)
-- Account types grouped by category:
-- Assets: Bank, AR, Other Current Asset, Fixed Asset, Other Asset
-- Liabilities: AP, Credit Card, Other Current Liability, Long Term Liability
-- Equity: Equity
-- Income: Income, Other Income
-- Expenses: COGS, Expense, Other Expense

-- DOWN: DROP INDEX IF EXISTS idx_accounts_user;
-- DOWN: DROP INDEX IF EXISTS idx_accounts_type;
-- DOWN: DROP INDEX IF EXISTS idx_accounts_parent;
-- DOWN: DROP INDEX IF EXISTS idx_purchases_user;
-- DOWN: DROP INDEX IF EXISTS idx_purchases_date;
-- DOWN: DROP INDEX IF EXISTS idx_purchases_vendor;
-- DOWN: DROP INDEX IF EXISTS idx_purchases_status;
-- DOWN: DROP INDEX IF EXISTS idx_purchase_items_purchase;
-- DOWN: DROP INDEX IF EXISTS idx_purchase_items_inventory;
-- DOWN: DROP INDEX IF EXISTS idx_financial_transactions_user;
-- DOWN: DROP INDEX IF EXISTS idx_financial_transactions_date;
-- DOWN: DROP INDEX IF EXISTS idx_financial_transactions_account;
-- DOWN: DROP INDEX IF EXISTS idx_financial_transactions_ref;
-- DOWN: DROP INDEX IF EXISTS idx_cost_layers_inventory;
-- DOWN: DROP INDEX IF EXISTS idx_cost_layers_remaining;
-- DOWN: DROP INDEX IF EXISTS idx_cost_layers_date;
-- DOWN: DROP INDEX IF EXISTS idx_email_queue_user;
-- DOWN: DROP INDEX IF EXISTS idx_email_queue_status;
-- DOWN: DROP TABLE IF EXISTS email_parse_queue;
-- DOWN: DROP TABLE IF EXISTS inventory_cost_layers;
-- DOWN: DROP TABLE IF EXISTS financial_transactions;
-- DOWN: DROP TABLE IF EXISTS purchase_items;
-- DOWN: DROP TABLE IF EXISTS purchases;
-- DOWN: DROP TABLE IF EXISTS accounts;
