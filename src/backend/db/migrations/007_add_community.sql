-- Community Migration
-- Adds tables for community features: forum, success stories, tips, leaderboard

-- Community posts (forum, success stories, tips)
CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Post type and categorization
    type TEXT NOT NULL CHECK (type IN ('discussion', 'success', 'tip')),
    category TEXT, -- 'General', 'Tips', 'Questions', 'Poshmark', 'eBay', etc.

    -- Content
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    images TEXT DEFAULT '[]', -- JSON array of image URLs

    -- For success stories
    sold_item_title TEXT,
    sale_price REAL,
    cost_price REAL,
    profit REAL,
    platform TEXT,

    -- Engagement
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,

    -- Moderation
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    flagged_count INTEGER DEFAULT 0,

    -- Tags
    tags TEXT DEFAULT '[]', -- JSON array

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Replies to posts
CREATE TABLE IF NOT EXISTS community_replies (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_reply_id TEXT, -- For nested replies (1 level deep)
    body TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES community_replies(id) ON DELETE CASCADE
);

-- Reactions (upvote, congratulate, helpful, etc.)
CREATE TABLE IF NOT EXISTS community_reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('upvote', 'downvote', 'congratulate', 'helpful')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id, reaction_type)
);

-- Flags/reports
CREATE TABLE IF NOT EXISTS community_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id)
);

-- User badges/achievements
CREATE TABLE IF NOT EXISTS community_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_type TEXT NOT NULL, -- 'first_post', 'helpful_10', 'top_seller', etc.
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_type)
);

-- User community stats (for leaderboard)
CREATE TABLE IF NOT EXISTS community_stats (
    user_id TEXT PRIMARY KEY,
    posts_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    upvotes_received INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    total_sales_shared REAL DEFAULT 0,
    total_profit_shared REAL DEFAULT 0,
    badge_count INTEGER DEFAULT 0,
    last_active_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_type ON community_posts(type);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_activity ON community_posts(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_upvotes ON community_posts(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_stats_upvotes ON community_stats(upvotes_received DESC);
CREATE INDEX IF NOT EXISTS idx_community_stats_profit ON community_stats(total_profit_shared DESC);

-- Full-text search for posts
CREATE VIRTUAL TABLE IF NOT EXISTS community_posts_fts USING fts5(
    id,
    title,
    body,
    tags,
    content='community_posts',
    content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER IF NOT EXISTS community_posts_ai AFTER INSERT ON community_posts BEGIN
    INSERT INTO community_posts_fts(rowid, id, title, body, tags)
    VALUES (new.rowid, new.id, new.title, new.body, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS community_posts_au AFTER UPDATE ON community_posts BEGIN
    DELETE FROM community_posts_fts WHERE rowid = old.rowid;
    INSERT INTO community_posts_fts(rowid, id, title, body, tags)
    VALUES (new.rowid, new.id, new.title, new.body, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS community_posts_ad AFTER DELETE ON community_posts BEGIN
    DELETE FROM community_posts_fts WHERE rowid = old.rowid;
END;

-- Triggers for stats updates
CREATE TRIGGER IF NOT EXISTS community_post_created AFTER INSERT ON community_posts BEGIN
    INSERT INTO community_stats (user_id, posts_count, last_active_at)
    VALUES (new.user_id, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
        posts_count = posts_count + 1,
        last_active_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS community_reply_created AFTER INSERT ON community_replies BEGIN
    UPDATE community_posts SET reply_count = reply_count + 1, last_activity_at = CURRENT_TIMESTAMP WHERE id = new.post_id;
    INSERT INTO community_stats (user_id, replies_count, last_active_at)
    VALUES (new.user_id, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
        replies_count = replies_count + 1,
        last_active_at = CURRENT_TIMESTAMP;
END;
