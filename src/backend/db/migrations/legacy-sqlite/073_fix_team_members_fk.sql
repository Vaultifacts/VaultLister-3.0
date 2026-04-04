-- Fix team_members: add FOREIGN KEY on user_id referencing users(id)
-- SQLite requires table recreation to add FK constraints

CREATE TABLE IF NOT EXISTS team_members_new (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by TEXT,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
    permissions TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

INSERT OR IGNORE INTO team_members_new
    SELECT * FROM team_members;

DROP TABLE IF EXISTS team_members;

ALTER TABLE team_members_new RENAME TO team_members;

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- DOWN: DROP INDEX IF EXISTS idx_team_members_user;
-- DOWN: DROP INDEX IF EXISTS idx_team_members_team;
-- DOWN: DROP TABLE IF EXISTS team_members_new;
-- DOWN: -- (includes data migration — manual data rollback required)
