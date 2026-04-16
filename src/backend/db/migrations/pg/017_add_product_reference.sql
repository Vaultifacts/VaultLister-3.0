-- Migration 017: Add product_reference table, ai_cache table, and embedding column to image_bank
-- Requires: pg_trgm and vector (pgvector) extensions

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS product_reference (
    id TEXT PRIMARY KEY,
    brand TEXT,
    model TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    description TEXT,
    condition TEXT,
    tags JSONB DEFAULT '[]',
    avg_sold_price NUMERIC(10,2),
    min_sold_price NUMERIC(10,2),
    max_sold_price NUMERIC(10,2),
    sold_count INTEGER DEFAULT 1,
    source TEXT DEFAULT 'claude-generated',
    source_id TEXT,
    search_text TEXT GENERATED ALWAYS AS (
        COALESCE(brand, '') || ' ' || COALESCE(model, '') || ' ' || COALESCE(category, '') || ' ' || COALESCE(subcategory, '')
    ) STORED,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_ref_search_trgm ON product_reference USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_ref_brand ON product_reference(brand);
CREATE INDEX IF NOT EXISTS idx_product_ref_category ON product_reference(category);

-- NOTE: ivfflat index on embedding requires >= 100 rows to be created efficiently.
-- Run after preloading data:
--   CREATE INDEX idx_product_ref_embedding ON product_reference USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS ai_cache (
    hash TEXT PRIMARY KEY,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache(created_at);

-- Add embedding column to image_bank for future user-specific similarity search.
-- NOTE: Index should be created after data is loaded, not here.
ALTER TABLE image_bank ADD COLUMN IF NOT EXISTS embedding vector(1536);
