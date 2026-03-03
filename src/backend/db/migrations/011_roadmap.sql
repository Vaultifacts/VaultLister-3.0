-- Add Roadmap Feature Tables
-- Tracks product roadmap features and user voting

-- Roadmap features table
CREATE TABLE IF NOT EXISTS roadmap_features (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed')),
    category TEXT,
    eta TEXT,
    votes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Roadmap votes table (tracks which users voted for which features)
CREATE TABLE IF NOT EXISTS roadmap_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES roadmap_features(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feature_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_roadmap_features_status ON roadmap_features(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_votes_user ON roadmap_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_votes_feature ON roadmap_votes(feature_id);
