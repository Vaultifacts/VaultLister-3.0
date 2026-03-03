-- Migration 060: Transaction Enhancements
-- Adds: split columns, attachments table, recurring templates table, audit log table

-- Add split columns to financial_transactions
ALTER TABLE financial_transactions ADD COLUMN parent_transaction_id TEXT REFERENCES financial_transactions(id);
ALTER TABLE financial_transactions ADD COLUMN is_split INTEGER DEFAULT 0;
ALTER TABLE financial_transactions ADD COLUMN split_note TEXT;

-- Transaction attachments (receipt storage)
CREATE TABLE IF NOT EXISTS transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'image/jpeg',
    file_size INTEGER DEFAULT 0,
    file_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_attachments_transaction ON transaction_attachments(transaction_id);

-- Recurring transaction templates
CREATE TABLE IF NOT EXISTS recurring_transaction_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id),
    category TEXT DEFAULT 'Expense',
    frequency TEXT DEFAULT 'monthly',
    last_executed DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_transaction_templates(user_id);

-- Transaction audit log
CREATE TABLE IF NOT EXISTS transaction_audit_log (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_audit_transaction ON transaction_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_audit_user ON transaction_audit_log(user_id);
