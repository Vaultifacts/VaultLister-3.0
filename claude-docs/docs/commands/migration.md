# /migration - Create Database Migration

Create and register PostgreSQL database migrations for VaultLister.

## Usage
```
/migration <name> [description]
```

## Workflow

1. **Determine next migration number**
   ```bash
   ls src/backend/db/migrations/*.sql | sort -V | tail -1
   ```

2. **Create migration file**
   - Location: `src/backend/db/migrations/XXX_<name>.sql`
   - Include descriptive header comment
   - Use `CREATE TABLE IF NOT EXISTS` for new tables
   - Use `ALTER TABLE` for modifications
   - Add appropriate indexes

3. **Register migration** in `src/backend/db/database.js`
   - Add filename to `migrationFiles` array
   - Maintain order (migrations run sequentially)

4. **Test migration**
   ```bash
   bun run src/backend/server.js
   ```

## Migration Template
```sql
-- Migration XXX: <Description>
-- <Detailed explanation of what this migration does>

CREATE TABLE IF NOT EXISTS table_name (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    -- columns...
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_table_user ON table_name(user_id);
```

## Best Practices
- Always include `user_id` for user-scoped data
- Add `created_at` and `updated_at` timestamps
- Create indexes for frequently queried columns
- Use foreign keys with appropriate ON DELETE actions
- Migrations must be idempotent (safe to run multiple times)
