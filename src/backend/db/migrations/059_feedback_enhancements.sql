-- Feedback Enhancements Migration
-- Adds voting, anonymous submissions, screenshots, threaded responses, and roadmap linking

-- Feedback votes table (up/down voting system)
CREATE TABLE IF NOT EXISTS feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feedback_id, user_id),
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id);

-- Feedback responses table (threaded conversation)
CREATE TABLE IF NOT EXISTS feedback_responses (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback ON feedback_responses(feedback_id);

-- Add new columns to feedback_submissions
ALTER TABLE feedback_submissions ADD COLUMN votes_up INTEGER DEFAULT 0;
ALTER TABLE feedback_submissions ADD COLUMN votes_down INTEGER DEFAULT 0;
ALTER TABLE feedback_submissions ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE feedback_submissions ADD COLUMN is_anonymous INTEGER DEFAULT 0;
ALTER TABLE feedback_submissions ADD COLUMN screenshot_data TEXT;
ALTER TABLE feedback_submissions ADD COLUMN screenshot_mime TEXT;
ALTER TABLE feedback_submissions ADD COLUMN roadmap_feature_id TEXT;

-- Migrate existing admin_response data to feedback_responses table
-- (only if admin_response is not null/empty)
INSERT INTO feedback_responses (id, feedback_id, user_id, message, is_admin, created_at)
SELECT
    ('migrated_' || id),
    id,
    user_id,
    admin_response,
    1,
    updated_at
FROM feedback_submissions
WHERE admin_response IS NOT NULL AND admin_response != '';

-- DOWN: DROP INDEX IF EXISTS idx_feedback_votes_feedback;
-- DOWN: DROP INDEX IF EXISTS idx_feedback_votes_user;
-- DOWN: DROP INDEX IF EXISTS idx_feedback_responses_feedback;
-- DOWN: DROP TABLE IF EXISTS feedback_responses;
-- DOWN: DROP TABLE IF EXISTS feedback_votes;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS votes_up;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS votes_down;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS view_count;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS is_anonymous;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS screenshot_data;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS screenshot_mime;
-- DOWN: ALTER TABLE feedback_submissions DROP COLUMN IF EXISTS roadmap_feature_id;
-- DOWN: -- (includes data migration — manual data rollback required)
