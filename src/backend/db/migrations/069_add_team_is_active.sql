-- Migration: 069_add_team_is_active
-- Description: Add is_active flag to teams table for suspension support
-- Created: 2026-02-16

ALTER TABLE teams ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);

-- DOWN: DROP INDEX IF EXISTS idx_teams_active;
-- DOWN: ALTER TABLE teams DROP COLUMN IF EXISTS is_active;
