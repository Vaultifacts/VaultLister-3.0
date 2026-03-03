-- Add missing columns to offers table

-- Add buyer_name column
ALTER TABLE offers ADD COLUMN buyer_name TEXT;

-- Add listing_price column for reference
ALTER TABLE offers ADD COLUMN listing_price REAL;

-- Add message column for buyer messages
ALTER TABLE offers ADD COLUMN message TEXT;
