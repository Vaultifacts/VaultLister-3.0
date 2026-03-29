-- Help & Support Migration
-- Adds tables for video tutorials, FAQ, knowledge base, and support tickets

-- Video tutorials
CREATE TABLE IF NOT EXISTS help_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL, -- YouTube embed or local file
    category TEXT, -- 'getting_started', 'cross_listing', 'automation', etc.
    duration INTEGER, -- Seconds
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0, -- Order in category
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FAQ items
CREATE TABLE IF NOT EXISTS help_faq (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    position INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- Knowledge base articles
CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL, -- Markdown or HTML
    category TEXT,
    tags TEXT DEFAULT '[]',
    author_id TEXT,
    is_published INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
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

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('contact', 'bug', 'feature_request')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    -- Attachments
    screenshots TEXT DEFAULT '[]', -- JSON array of image URLs

    -- Metadata
    page_context TEXT, -- Page user was on when submitting
    browser_info TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ticket replies
CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT, -- NULL if from support staff
    is_staff_reply INTEGER DEFAULT 0,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_help_videos_category ON help_videos(category, position);
CREATE INDEX IF NOT EXISTS idx_help_faq_category ON help_faq(category, position);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_published ON help_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket ON support_ticket_replies(ticket_id);

-- FTS for knowledge base
CREATE VIRTUAL TABLE IF NOT EXISTS help_articles_fts USING fts5(
    id,
    title,
    content,
    tags,
    content='help_articles',
    content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER IF NOT EXISTS help_articles_ai AFTER INSERT ON help_articles BEGIN
    INSERT INTO help_articles_fts(rowid, id, title, content, tags)
    VALUES (new.rowid, new.id, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS help_articles_au AFTER UPDATE ON help_articles BEGIN
    DELETE FROM help_articles_fts WHERE rowid = old.rowid;
    INSERT INTO help_articles_fts(rowid, id, title, content, tags)
    VALUES (new.rowid, new.id, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS help_articles_ad AFTER DELETE ON help_articles BEGIN
    DELETE FROM help_articles_fts WHERE rowid = old.rowid;
END;

-- DOWN: DROP TRIGGER IF EXISTS help_articles_ai;
-- DOWN: DROP TRIGGER IF EXISTS help_articles_au;
-- DOWN: DROP TRIGGER IF EXISTS help_articles_ad;
-- DOWN: DROP INDEX IF EXISTS idx_help_videos_category;
-- DOWN: DROP INDEX IF EXISTS idx_help_faq_category;
-- DOWN: DROP INDEX IF EXISTS idx_help_articles_category;
-- DOWN: DROP INDEX IF EXISTS idx_help_articles_published;
-- DOWN: DROP INDEX IF EXISTS idx_support_tickets_user;
-- DOWN: DROP INDEX IF EXISTS idx_support_tickets_status;
-- DOWN: DROP INDEX IF EXISTS idx_support_ticket_replies_ticket;
-- DOWN: DROP TABLE IF EXISTS help_articles_fts;
-- DOWN: DROP TABLE IF EXISTS support_ticket_replies;
-- DOWN: DROP TABLE IF EXISTS support_tickets;
-- DOWN: DROP TABLE IF EXISTS help_article_votes;
-- DOWN: DROP TABLE IF EXISTS help_articles;
-- DOWN: DROP TABLE IF EXISTS help_faq_votes;
-- DOWN: DROP TABLE IF EXISTS help_faq;
-- DOWN: DROP TABLE IF EXISTS help_videos;
