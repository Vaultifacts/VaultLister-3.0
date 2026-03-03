-- Brand Size Guides Migration
-- Adds the brand_size_guides table used by src/backend/routes/sizeCharts.js

CREATE TABLE IF NOT EXISTS brand_size_guides (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    garment_type TEXT NOT NULL,
    size_label TEXT NOT NULL,
    us_size TEXT,
    uk_size TEXT,
    eu_size TEXT,
    jp_size TEXT,
    cn_size TEXT,
    it_size TEXT,
    fr_size TEXT,
    au_size TEXT,
    chest_cm REAL,
    waist_cm REAL,
    hips_cm REAL,
    length_cm REAL,
    shoulder_cm REAL,
    sleeve_cm REAL,
    inseam_cm REAL,
    foot_length_cm REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_size_guides_brand ON brand_size_guides(brand);
CREATE INDEX IF NOT EXISTS idx_brand_size_guides_garment ON brand_size_guides(garment_type);
CREATE INDEX IF NOT EXISTS idx_brand_size_guides_brand_garment ON brand_size_guides(brand, garment_type);
