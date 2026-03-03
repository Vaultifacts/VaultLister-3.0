-- Price history tracking for inventory items
-- Tracks changes to cost price and list price over time

CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cost_price REAL,
    list_price REAL,
    previous_cost_price REAL,
    previous_list_price REAL,
    change_reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_inventory ON price_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(changed_at);
