-- Migration: 037_teams
-- Description: Add team collaboration features
-- Created: 2026-01-29

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    max_members INTEGER DEFAULT 3,
    settings TEXT, -- JSON settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members with roles
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by TEXT,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
    permissions TEXT, -- JSON override permissions
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Team invitations
CREATE TABLE IF NOT EXISTS team_invitations (
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
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Team activity log for audit
CREATE TABLE IF NOT EXISTS team_activity_log (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT, -- JSON details
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Barcode lookups table (for barcode scanner feature)
CREATE TABLE IF NOT EXISTS barcode_lookups (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    title TEXT,
    brand TEXT,
    category TEXT,
    description TEXT,
    image_url TEXT,
    source TEXT, -- 'openfoodfacts', 'upcitemdb', 'user', 'local'
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at DESC);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Indexes for team_invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- Indexes for team_activity_log
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity_log(created_at DESC);

-- Indexes for barcode_lookups
CREATE INDEX IF NOT EXISTS idx_barcode_lookups_barcode ON barcode_lookups(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_lookups_brand ON barcode_lookups(brand);
