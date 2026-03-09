// Chatbot Routes
// Handles chatbot conversations using Grok API with mock mode fallback

import crypto from 'crypto';
import { query } from '../db/database.js';
import { getGrokResponse, getChatbotMode } from '../services/grokService.js';
import { logger } from '../shared/logger.js';

/**
 * Chatbot router
 */
export async function chatbotRouter(ctx) {
    const { method, path, body, user } = ctx;

    // POST /api/chatbot/conversations - Start new conversation
    if (method === 'POST' && path === '/conversations') {
        if (body.title && body.title.length > 200) {
            return { status: 400, data: { error: 'Title must be 200 characters or less' } };
        }

        try {
            const conversationId = `conv_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            const now = new Date().toISOString();

            // Create conversation
            query.run(
                `INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [conversationId, user.id, body.title || 'New Chat', now, now]
            );

            // Add system welcome message
            const welcomeMessageId = `msg_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            const welcomeMessage = `Hi! 👋 I'm Vault Buddy, your AI assistant built into VaultLister. I can help you with:

• Inventory management & organization
• Cross-listing to multiple platforms
• Setting up automations
• Understanding analytics & sales data
• Using Image Bank & Templates
• AI-powered listing generation

What can I help you with today?`;
            query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at)
                 VALUES (?, ?, ?, 'assistant', ?, ?)`,
                [
                    welcomeMessageId,
                    conversationId,
                    user.id,
                    welcomeMessage,
                    now
                ]
            );

            return {
                status: 201,
                data: {
                    success: true,
                    conversation: {
                        id: conversationId,
                        title: body.title || 'New Chat',
                        created_at: new Date().toISOString()
                    }
                }
            };
        } catch (error) {
            logger.error('[Chatbot] Error creating conversation', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to create conversation' }
            };
        }
    }

    // GET /api/chatbot/conversations - List all conversations
    if (method === 'GET' && path === '/conversations') {
        try {
            const conversations = query.all(
                `SELECT
                    c.id,
                    c.title,
                    c.created_at,
                    c.updated_at,
                    (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count,
                    (SELECT content FROM chat_messages
                     WHERE conversation_id = c.id
                     ORDER BY created_at DESC LIMIT 1) as last_message
                 FROM chat_conversations c
                 WHERE c.user_id = ?
                 ORDER BY c.updated_at DESC`,
                [user.id]
            );

            return {
                status: 200,
                data: { conversations }
            };
        } catch (error) {
            logger.error('[Chatbot] Error fetching conversations', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch conversations' }
            };
        }
    }

    // GET /api/chatbot/conversations/:id - Get single conversation with messages
    if (method === 'GET' && path.startsWith('/conversations/')) {
        const conversationId = path.split('/')[2];

        try {
            // Get conversation
            const conversation = query.get(
                `SELECT id, title, created_at, updated_at
                 FROM chat_conversations
                 WHERE id = ? AND user_id = ?`,
                [conversationId, user.id]
            );

            if (!conversation) {
                return {
                    status: 404,
                    data: { error: 'Conversation not found' }
                };
            }

            // Get messages
            const messages = query.all(
                `SELECT id, role, content, metadata, helpful_rating, created_at
                 FROM chat_messages
                 WHERE conversation_id = ?
                 ORDER BY created_at ASC`,
                [conversationId]
            );

            // Parse metadata JSON
            messages.forEach(msg => {
                try {
                    msg.metadata = msg.metadata ? JSON.parse(msg.metadata) : {};
                } catch (e) {
                    msg.metadata = {};
                }
            });

            return {
                status: 200,
                data: {
                    conversation,
                    messages
                }
            };
        } catch (error) {
            logger.error('[Chatbot] Error fetching conversation', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch conversation' }
            };
        }
    }

    // POST /api/chatbot/message - Send message and get response
    if (method === 'POST' && path === '/message') {
        const { conversation_id, message } = body;

        if (!conversation_id || !message) {
            return {
                status: 400,
                data: { error: 'conversation_id and message are required' }
            };
        }

        if (message.length > 4000) {
            return { status: 400, data: { error: 'Message must be 4,000 characters or less' } };
        }

        try {
            // Verify conversation belongs to user
            const conversation = query.get(
                `SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?`,
                [conversation_id, user.id]
            );

            if (!conversation) {
                return {
                    status: 404,
                    data: { error: 'Conversation not found' }
                };
            }

            // Save user message
            const userMessageId = `msg_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            const messageTimestamp = new Date().toISOString();
            query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at)
                 VALUES (?, ?, ?, 'user', ?, ?)`,
                [userMessageId, conversation_id, user.id, message, messageTimestamp]
            );

            // Get conversation history (last 10 messages for context)
            const historyMessages = query.all(
                `SELECT role, content FROM chat_messages
                 WHERE conversation_id = ?
                 ORDER BY created_at DESC
                 LIMIT 10`,
                [conversation_id]
            ).reverse();

            // Get response from Grok (or mock)
            const grokResponse = await getGrokResponse(
                historyMessages.map(m => ({ role: m.role, content: m.content })),
                { userId: user.id }
            );

            // Save assistant message
            const assistantMessageId = `msg_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            const metadata = {
                source: grokResponse.source,
                category: grokResponse.category,
                quickActions: grokResponse.quickActions || []
            };

            const responseTimestamp = new Date().toISOString();
            query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at)
                 VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
                [assistantMessageId, conversation_id, user.id, grokResponse.content, JSON.stringify(metadata), responseTimestamp]
            );

            // Update conversation timestamp
            query.run(
                `UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND user_id = ?`,
                [responseTimestamp, conversation_id, user.id]
            );

            return {
                status: 200,
                data: {
                    success: true,
                    message: {
                        id: assistantMessageId,
                        role: 'assistant',
                        content: grokResponse.content,
                        metadata,
                        created_at: new Date().toISOString()
                    },
                    chatbot_mode: getChatbotMode()
                }
            };
        } catch (error) {
            logger.error('[Chatbot] Error sending message', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to send message' }
            };
        }
    }

    // POST /api/chatbot/rate - Rate message helpfulness
    if (method === 'POST' && path === '/rate') {
        const { message_id, rating } = body;

        if (!message_id || rating === undefined) {
            return {
                status: 400,
                data: { error: 'message_id and rating are required' }
            };
        }

        if (rating < 1 || rating > 5) {
            return {
                status: 400,
                data: { error: 'rating must be between 1 and 5' }
            };
        }

        try {
            // Verify message belongs to user's conversation
            const message = query.get(
                `SELECT m.id
                 FROM chat_messages m
                 JOIN chat_conversations c ON m.conversation_id = c.id
                 WHERE m.id = ? AND c.user_id = ?`,
                [message_id, user.id]
            );

            if (!message) {
                return {
                    status: 404,
                    data: { error: 'Message not found' }
                };
            }

            // Update rating
            query.run(
                `UPDATE chat_messages SET helpful_rating = ? WHERE id = ? AND user_id = ?`,
                [rating, message_id, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Chatbot] Error rating message', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to rate message' }
            };
        }
    }

    // DELETE /api/chatbot/conversations/:id - Delete conversation
    if (method === 'DELETE' && path.startsWith('/conversations/')) {
        const conversationId = path.split('/')[2];

        try {
            // Verify ownership
            const conversation = query.get(
                `SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?`,
                [conversationId, user.id]
            );

            if (!conversation) {
                return {
                    status: 404,
                    data: { error: 'Conversation not found' }
                };
            }

            // Delete messages first (foreign key constraint)
            query.run(
                `DELETE FROM chat_messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = ?)`,
                [conversationId, user.id]
            );

            // Delete conversation
            query.run(
                `DELETE FROM chat_conversations WHERE id = ? AND user_id = ?`,
                [conversationId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Chatbot] Error deleting conversation', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to delete conversation' }
            };
        }
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}
