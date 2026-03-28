# Database Reference
> Last reviewed: 2026-03-28

## Overview
## Overview

- **Engine:** PostgreSQL (postgres npm package, DATABASE_URL)
- **Search:** TSVECTOR full-text search with GIN index

---

## Query Helpers

**File:** `src/backend/db/database.js`

The query helpers accept `?` positional parameters, which are automatically converted to `$1`, `$2`, … for the underlying `postgres` npm driver.

```javascript
import { query } from '../db/database.js';

// Single row
const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);

// Multiple rows
const items = await query.all('SELECT * FROM inventory WHERE user_id = ?', [userId]);

// INSERT/UPDATE/DELETE
await query.run('INSERT INTO inventory (id, user_id, title) VALUES (?, ?, ?)', [id, userId, title]);
```

All query helpers are `async` and return Promises.

---

## Core Tables

### users
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,          -- UUID
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,       -- bcrypt hash
    name TEXT,
    tier TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### inventory
```sql
CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    brand TEXT,
    category TEXT,
    size TEXT,
    color TEXT,
    condition TEXT,
    cost_price REAL DEFAULT 0,
    list_price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    low_stock_threshold INTEGER DEFAULT 5,
    status TEXT DEFAULT 'draft',   -- draft, active, sold
    images TEXT,                    -- JSON array
    tags TEXT,                      -- JSON array
    deleted_at TIMESTAMPTZ,            -- Soft delete
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### listings
```sql
CREATE TABLE listings (
    id TEXT PRIMARY KEY,
    inventory_id TEXT,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,        -- poshmark, ebay, mercari, depop, grailed, facebook
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    status TEXT DEFAULT 'draft',   -- draft, active, ended, sold
    platform_listing_id TEXT,
    platform_url TEXT,
    images TEXT,                    -- JSON array
    last_relisted_at TIMESTAMPTZ,
    last_delisted_at TIMESTAMPTZ,
    staleness_days INTEGER DEFAULT 30,
    auto_relist_enabled INTEGER DEFAULT 0,
    marked_as_sold INTEGER DEFAULT 0,  -- For Facebook
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### sales
```sql
CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    listing_id TEXT,
    platform TEXT,
    buyer_username TEXT,
    sale_price REAL NOT NULL,
    platform_fee REAL DEFAULT 0,
    item_cost REAL DEFAULT 0,          -- COGS from FIFO
    customer_shipping_cost REAL DEFAULT 0,
    seller_shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_profit REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',     -- pending, shipped, delivered
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Financial Tables

### accounts (Chart of Accounts)
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,    -- Bank, AR, COGS, Expense, Income, etc. (15 types)
    description TEXT,
    balance REAL DEFAULT 0,
    parent_account_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### purchases
```sql
CREATE TABLE purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purchase_number TEXT,
    vendor_name TEXT,
    purchase_date DATE,
    total_amount REAL,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    payment_method TEXT,
    status TEXT DEFAULT 'completed',
    source TEXT DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### inventory_cost_layers (FIFO)
```sql
CREATE TABLE inventory_cost_layers (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    purchase_item_id TEXT,
    quantity_remaining INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    purchase_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Chatbot Tables

### chat_conversations
```sql
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Chat',
    last_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### chat_messages
```sql
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,            -- user, assistant, system
    content TEXT NOT NULL,
    metadata TEXT,                 -- JSON
    rating INTEGER,                -- 1-5
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Listing Refresh History

```sql
CREATE TABLE listing_refresh_history (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    action TEXT NOT NULL,          -- delist, relist, mark_sold
    reason TEXT,                   -- manual, stale, automation
    previous_status TEXT,
    new_status TEXT,
    platform_response TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Migrations

**Location:** `src/backend/db/migrations/`

Migrations are numbered sequentially (112 total as of March 2026):
- `001_add_inventory_fields.sql`
- `002_add_analytics_tables.sql`
- ...
- `111_add_poshmark_monitoring_log.sql`
- `112_add_csrf_tokens_table.sql`

**Adding a new migration:**
1. Create file: `XXX_description.sql`
2. Add to `migrationFiles` array in `database.js`
3. Restart server (migrations run automatically)

**Migration tracking:**
```sql
CREATE TABLE migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Common Queries

**Full-text search:**
```sql
SELECT * FROM inventory
WHERE search_vector @@ plainto_tsquery('english', $1)
```

**Stale listings:**
```sql
SELECT * FROM listings
WHERE status = 'active'
AND COALESCE(last_relisted_at, listed_at, created_at) <= NOW() - INTERVAL '30 days'
```

**FIFO cost layers:**
```sql
SELECT * FROM inventory_cost_layers
WHERE inventory_id = ? AND quantity_remaining > 0
ORDER BY purchase_date ASC
```

---

## Important Notes

- **IDs:** Always use TEXT for UUIDs, never INTEGER
- **JSON fields:** Store as TEXT, parse with `JSON.parse()`
- **Dates:** Use ISO format strings or PostgreSQL datetime functions
- **Soft deletes:** Use `deleted_at` timestamp, not actual deletion
- **Foreign keys:** Always reference with ON DELETE CASCADE or SET NULL
