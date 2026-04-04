-- Add missing columns to offers table

-- Add buyer_name column
ALTER TABLE offers ADD COLUMN buyer_name TEXT;

-- Add listing_price column for reference
ALTER TABLE offers ADD COLUMN listing_price REAL;

-- Add message column for buyer messages
ALTER TABLE offers ADD COLUMN message TEXT;

-- DOWN: ALTER TABLE offers DROP COLUMN IF EXISTS buyer_name;
-- DOWN: ALTER TABLE offers DROP COLUMN IF EXISTS listing_price;
-- DOWN: ALTER TABLE offers DROP COLUMN IF EXISTS message;
