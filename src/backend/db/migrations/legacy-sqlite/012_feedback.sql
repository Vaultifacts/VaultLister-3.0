-- Add Feedback Submissions Table
-- Tracks user feedback and feature suggestions

CREATE TABLE IF NOT EXISTS feedback_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('feature', 'improvement', 'bug', 'general')),
    category TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'planned', 'completed', 'declined')),
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_submissions(type);

-- DOWN: DROP INDEX IF EXISTS idx_feedback_user;
-- DOWN: DROP INDEX IF EXISTS idx_feedback_status;
-- DOWN: DROP INDEX IF EXISTS idx_feedback_type;
-- DOWN: DROP TABLE IF EXISTS feedback_submissions;
