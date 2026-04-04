-- Chatbot Migration
-- Adds tables for AI-powered help chatbot with Grok API integration

-- Chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT, -- Auto-generated from first message
    context TEXT DEFAULT '{}', -- JSON: page user was on, recent actions
    is_resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON: suggested actions, links, code snippets
    helpful_rating INTEGER, -- 1-5 stars, null if not rated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Predefined responses for mock mode
CREATE TABLE IF NOT EXISTS chat_canned_responses (
    id TEXT PRIMARY KEY,
    trigger_keywords TEXT NOT NULL, -- JSON array of keywords
    category TEXT, -- 'getting_started', 'cross_list', 'automation', etc.
    response_template TEXT NOT NULL,
    quick_actions TEXT DEFAULT '[]', -- JSON array of {label, action, route}
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- DOWN: DROP INDEX IF EXISTS idx_chat_conversations_user;
-- DOWN: DROP INDEX IF EXISTS idx_chat_messages_conversation;
-- DOWN: DROP INDEX IF EXISTS idx_chat_messages_created;
-- DOWN: DROP TABLE IF EXISTS chat_canned_responses;
-- DOWN: DROP TABLE IF EXISTS chat_messages;
-- DOWN: DROP TABLE IF EXISTS chat_conversations;
