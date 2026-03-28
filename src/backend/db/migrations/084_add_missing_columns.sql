-- Fix missing columns that were added by services but not by migrations
-- Covers: Enhanced MFA user columns, audit_logs.category, orders.priority

-- Enhanced MFA columns on users table
ALTER TABLE users ADD COLUMN mfa_method TEXT;
ALTER TABLE users ADD COLUMN phone_number TEXT;
ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN pending_phone TEXT;
ALTER TABLE users ADD COLUMN phone_verification_code TEXT;
ALTER TABLE users ADD COLUMN phone_verification_expires TEXT;

-- Audit log category column
ALTER TABLE audit_logs ADD COLUMN category TEXT;
ALTER TABLE audit_logs ADD COLUMN resource_type TEXT;

-- Orders priority columns
ALTER TABLE orders ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE orders ADD COLUMN priority_note TEXT;

-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS mfa_method;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS pending_phone;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS phone_verification_code;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS phone_verification_expires;
-- DOWN: ALTER TABLE audit_logs DROP COLUMN IF EXISTS category;
-- DOWN: ALTER TABLE audit_logs DROP COLUMN IF EXISTS resource_type;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS priority;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS priority_note;
