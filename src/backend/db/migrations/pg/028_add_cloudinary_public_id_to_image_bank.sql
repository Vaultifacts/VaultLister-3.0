ALTER TABLE image_bank ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
CREATE INDEX IF NOT EXISTS idx_image_bank_cloudinary_public_id ON image_bank(cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL;
