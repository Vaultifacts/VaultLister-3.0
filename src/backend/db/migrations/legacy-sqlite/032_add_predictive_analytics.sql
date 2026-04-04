-- Migration: Add predictive analytics tables
-- Stores price predictions and demand forecasts

-- Price predictions for inventory items
CREATE TABLE IF NOT EXISTS price_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    predicted_price REAL NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    price_range_low REAL,
    price_range_high REAL,
    demand_score REAL CHECK (demand_score >= 0 AND demand_score <= 100),
    recommendation TEXT NOT NULL, -- 'price_up', 'price_down', 'hold', 'relist'
    recommendation_reason TEXT,
    comparable_count INTEGER DEFAULT 0,
    avg_days_to_sell INTEGER,
    seasonality_factor REAL DEFAULT 1.0,
    platform TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Demand forecasts by category
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    forecast_date TEXT NOT NULL,
    demand_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'trending'
    volume_estimate INTEGER,
    avg_price REAL,
    price_trend TEXT, -- 'rising', 'stable', 'falling'
    seasonality_index REAL DEFAULT 1.0,
    competitor_count INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_predictions_user ON price_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_inventory ON price_predictions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_predictions_recommendation ON price_predictions(recommendation);
CREATE INDEX IF NOT EXISTS idx_predictions_expires ON price_predictions(expires_at);
CREATE INDEX IF NOT EXISTS idx_forecasts_category ON demand_forecasts(category);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_platform ON demand_forecasts(platform);

-- DOWN: DROP INDEX IF EXISTS idx_predictions_user;
-- DOWN: DROP INDEX IF EXISTS idx_predictions_inventory;
-- DOWN: DROP INDEX IF EXISTS idx_predictions_recommendation;
-- DOWN: DROP INDEX IF EXISTS idx_predictions_expires;
-- DOWN: DROP INDEX IF EXISTS idx_forecasts_category;
-- DOWN: DROP INDEX IF EXISTS idx_forecasts_date;
-- DOWN: DROP INDEX IF EXISTS idx_forecasts_platform;
-- DOWN: DROP TABLE IF EXISTS demand_forecasts;
-- DOWN: DROP TABLE IF EXISTS price_predictions;
