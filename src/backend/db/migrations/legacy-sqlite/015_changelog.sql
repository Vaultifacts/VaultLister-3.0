-- Add Changelog Table
-- Tracks version history and release notes

CREATE TABLE IF NOT EXISTS changelog (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    changes TEXT NOT NULL, -- JSON array of change items
    highlights TEXT, -- Notable features/improvements
    breaking_changes TEXT, -- Any breaking changes
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Changelog change items table (for structured storage)
CREATE TABLE IF NOT EXISTS changelog_items (
    id TEXT PRIMARY KEY,
    changelog_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('feature', 'improvement', 'fix', 'breaking', 'security')),
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changelog_id) REFERENCES changelog(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_changelog_version ON changelog(version);
CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_items_changelog ON changelog_items(changelog_id);

-- DOWN: DROP INDEX IF EXISTS idx_changelog_version;
-- DOWN: DROP INDEX IF EXISTS idx_changelog_date;
-- DOWN: DROP INDEX IF EXISTS idx_changelog_items_changelog;
-- DOWN: DROP TABLE IF EXISTS changelog_items;
-- DOWN: DROP TABLE IF EXISTS changelog;
