-- Add WebP and thumbnail path columns to image_bank
ALTER TABLE image_bank ADD COLUMN IF NOT EXISTS webp_path TEXT;
ALTER TABLE image_bank ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
