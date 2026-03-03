-- Migration: Add Outlook email support
-- Adds index for efficient provider-based queries

-- Create index on email_accounts for provider filtering
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider_enabled
    ON email_accounts(provider, is_enabled);

-- Add outlook-specific fields if needed
-- (email_accounts table already has generic provider field)
