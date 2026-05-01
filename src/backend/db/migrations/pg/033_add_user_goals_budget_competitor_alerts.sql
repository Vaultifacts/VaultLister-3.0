-- Migration 033: add goals_json, budget_json, and competitor_alerts_json columns to users
-- These columns store user-level financial goals, budget settings, and competitor alert
-- preferences as JSON text.

ALTER TABLE users ADD COLUMN IF NOT EXISTS goals_json TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS budget_json TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS competitor_alerts_json TEXT;
