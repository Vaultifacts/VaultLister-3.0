-- Migration 023: Add Receipt Parsing Support
-- Extends email_parse_queue for receipt types and adds vendor tracking

-- Extend email_parse_queue with additional columns for receipt parsing
-- Note: SQLite requires separate ALTER statements for each column

ALTER TABLE email_parse_queue ADD COLUMN receipt_type TEXT DEFAULT 'purchase';
-- Values: 'purchase', 'sale', 'shipping', 'expense'

ALTER TABLE email_parse_queue ADD COLUMN confidence_score REAL;

ALTER TABLE email_parse_queue ADD COLUMN source_file TEXT;
-- Original filename for uploaded files

ALTER TABLE email_parse_queue ADD COLUMN file_type TEXT DEFAULT 'image';
-- Values: 'image', 'pdf', 'email'

ALTER TABLE email_parse_queue ADD COLUMN image_data TEXT;
-- Base64 encoded image for display in UI

-- Receipt vendors lookup table for smart matching and presets
CREATE TABLE IF NOT EXISTS receipt_vendors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT DEFAULT '[]',
    -- JSON array of alternative names for matching
    default_category TEXT,
    -- 'thrift', 'wholesale', 'retail', 'shipping', 'platform', 'other'
    default_payment_method TEXT,
    -- 'Cash', 'Credit Card', 'Debit Card', 'PayPal', 'Venmo', 'Other'
    is_platform INTEGER DEFAULT 0,
    -- 1 if this is a selling platform (eBay, Poshmark, etc.)
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for receipt_vendors
CREATE INDEX IF NOT EXISTS idx_receipt_vendors_user ON receipt_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_vendors_name ON receipt_vendors(user_id, name);

-- Index on email_parse_queue for faster filtering
CREATE INDEX IF NOT EXISTS idx_email_parse_queue_status ON email_parse_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_parse_queue_type ON email_parse_queue(user_id, receipt_type);
