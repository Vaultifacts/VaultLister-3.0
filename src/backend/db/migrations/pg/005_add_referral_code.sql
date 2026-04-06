-- Migration 005: Add referral_code column to users
-- Generates a deterministic code for existing users from their UUID prefix

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'referral_code'
    ) THEN
        ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
    END IF;
END $$;

-- Backfill existing users: 'VAULT' + first 6 chars of UUID uppercased
UPDATE users
SET referral_code = 'VAULT' || UPPER(SUBSTRING(id, 1, 6))
WHERE referral_code IS NULL;
