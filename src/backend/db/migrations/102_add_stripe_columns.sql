-- Migration 102: Add Stripe customer and subscription columns to users table
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;

-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
-- DOWN: ALTER TABLE users DROP COLUMN IF EXISTS stripe_subscription_id;
