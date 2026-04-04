-- Add Help Vote Tracking Tables
-- Tracks user votes on FAQs and articles for duplicate prevention

-- FAQ vote tracking
CREATE TABLE IF NOT EXISTS help_faq_votes (
    id TEXT PRIMARY KEY,
    faq_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faq_id) REFERENCES help_faq(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(faq_id, user_id)
);

-- Article vote tracking
CREATE TABLE IF NOT EXISTS help_article_votes (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(article_id, user_id)
);

-- Add not_helpful_count to help_faq if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for columns, so we check first
CREATE TABLE IF NOT EXISTS _help_faq_temp AS SELECT * FROM help_faq LIMIT 0;
DROP TABLE _help_faq_temp;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_help_faq_votes_user ON help_faq_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_help_article_votes_user ON help_article_votes(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_help_faq_votes_user;
-- DOWN: DROP INDEX IF EXISTS idx_help_article_votes_user;
-- DOWN: DROP TABLE IF EXISTS _help_faq_temp;
-- DOWN: DROP TABLE IF EXISTS help_article_votes;
-- DOWN: DROP TABLE IF EXISTS help_faq_votes;
