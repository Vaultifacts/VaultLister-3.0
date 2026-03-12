-- Fix: FTS5 delete trigger (inventory_ad) was missing rowid, causing deleted
-- inventory rows to remain in the FTS5 index permanently. The update trigger
-- (inventory_au) had the same issue for its delete step.

DROP TRIGGER IF EXISTS inventory_ad;
CREATE TRIGGER IF NOT EXISTS inventory_ad AFTER DELETE ON inventory BEGIN
    INSERT INTO inventory_fts(inventory_fts, rowid, id, title, description, brand, tags)
    VALUES ('delete', old.rowid, old.id, old.title, old.description, old.brand, old.tags);
END;

DROP TRIGGER IF EXISTS inventory_au;
CREATE TRIGGER IF NOT EXISTS inventory_au AFTER UPDATE ON inventory BEGIN
    INSERT INTO inventory_fts(inventory_fts, rowid, id, title, description, brand, tags)
    VALUES ('delete', old.rowid, old.id, old.title, old.description, old.brand, old.tags);
    INSERT INTO inventory_fts(id, title, description, brand, tags)
    VALUES (new.id, new.title, new.description, new.brand, new.tags);
END;

-- Rebuild FTS5 index to clean up stale entries from deleted inventory rows
INSERT INTO inventory_fts(inventory_fts) VALUES('rebuild');
