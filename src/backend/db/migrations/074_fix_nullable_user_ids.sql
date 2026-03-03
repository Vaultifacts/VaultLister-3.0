-- Fix demand_forecasts and push_devices: add NOT NULL on user_id
-- SQLite requires table recreation to add NOT NULL constraint

-- Fix demand_forecasts.user_id
CREATE TABLE IF NOT EXISTS demand_forecasts_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    forecast_date TEXT NOT NULL,
    demand_level TEXT NOT NULL,
    volume_estimate INTEGER,
    avg_price REAL,
    price_trend TEXT,
    seasonality_index REAL DEFAULT 1.0,
    competitor_count INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO demand_forecasts_new
    SELECT * FROM demand_forecasts WHERE user_id IS NOT NULL;

DROP TABLE IF EXISTS demand_forecasts;
ALTER TABLE demand_forecasts_new RENAME TO demand_forecasts;

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_user ON demand_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_date ON demand_forecasts(forecast_date);

-- Fix push_devices.user_id
CREATE TABLE IF NOT EXISTS push_devices_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT
);

INSERT OR IGNORE INTO push_devices_new
    SELECT * FROM push_devices WHERE user_id IS NOT NULL;

DROP TABLE IF EXISTS push_devices;
ALTER TABLE push_devices_new RENAME TO push_devices;

CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);
