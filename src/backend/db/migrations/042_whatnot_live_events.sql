-- Whatnot Live Selling Events
CREATE TABLE IF NOT EXISTS whatnot_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    estimated_duration INTEGER DEFAULT 60,
    shipping_option TEXT DEFAULT 'standard',
    notes TEXT,
    status TEXT DEFAULT 'scheduled',
    stream_url TEXT,
    viewers_peak INTEGER DEFAULT 0,
    total_sales REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS whatnot_event_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    starting_price REAL DEFAULT 0,
    buy_now_price REAL,
    min_price REAL DEFAULT 0,
    sold_price REAL,
    buyer_username TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

CREATE INDEX IF NOT EXISTS idx_whatnot_events_user ON whatnot_events(user_id);
CREATE INDEX IF NOT EXISTS idx_whatnot_events_status ON whatnot_events(status);
CREATE INDEX IF NOT EXISTS idx_whatnot_event_items_event ON whatnot_event_items(event_id);

-- DOWN: DROP INDEX IF EXISTS idx_whatnot_events_user;
-- DOWN: DROP INDEX IF EXISTS idx_whatnot_events_status;
-- DOWN: DROP INDEX IF EXISTS idx_whatnot_event_items_event;
-- DOWN: DROP TABLE IF EXISTS whatnot_event_items;
-- DOWN: DROP TABLE IF EXISTS whatnot_events;
