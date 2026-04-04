-- Fix teams.owner_user_id and team_invitations.invited_by: add FOREIGN KEY referencing users(id)
-- SQLite requires table recreation to add FK constraints to existing tables

-- Fix teams.owner_user_id
CREATE TABLE IF NOT EXISTS teams_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    max_members INTEGER DEFAULT 3,
    settings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO teams_new SELECT * FROM teams;
DROP TABLE IF EXISTS teams;
ALTER TABLE teams_new RENAME TO teams;

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at DESC);

-- Fix team_invitations.invited_by
CREATE TABLE IF NOT EXISTS team_invitations_new (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT NOT NULL,
    message TEXT,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO team_invitations_new SELECT * FROM team_invitations;
DROP TABLE IF EXISTS team_invitations;
ALTER TABLE team_invitations_new RENAME TO team_invitations;

CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- DOWN: DROP INDEX IF EXISTS idx_teams_owner;
-- DOWN: DROP INDEX IF EXISTS idx_teams_created;
-- DOWN: DROP INDEX IF EXISTS idx_team_invitations_team;
-- DOWN: DROP INDEX IF EXISTS idx_team_invitations_email;
-- DOWN: DROP INDEX IF EXISTS idx_team_invitations_token;
-- DOWN: DROP INDEX IF EXISTS idx_team_invitations_status;
-- DOWN: DROP TABLE IF EXISTS team_invitations_new;
-- DOWN: DROP TABLE IF EXISTS teams_new;
-- DOWN: -- (includes data migration — manual data rollback required)
