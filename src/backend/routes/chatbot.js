// Chatbot Routes
// Handles chatbot conversations using Claude (primary) → Grok (fallback) → Mock

import crypto from 'crypto';
import { query } from '../db/database.js';
import { getGrokResponse, getChatbotMode, streamResponse } from '../services/grokService.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';


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
            await query.run(
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
            await query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at)
                 VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
                [
                    welcomeMessageId,
                    conversationId,
                    user.id,
                    welcomeMessage,
                    '{"is_welcome":true}',
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
            const conversations = await query.all(
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
                 ORDER BY c.updated_at DESC
                 LIMIT 500`,
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
    if (method === 'GET' && path.match(/^\/conversations\/[\w-]+$/)) {
        const conversationId = path.split('/')[2];

        try {
            // Get conversation
            const conversation = await query.get(
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
            const messages = await query.all(
                `SELECT id, role, content, metadata, helpful_rating, created_at
                 FROM chat_messages
                 WHERE conversation_id = ?
                 ORDER BY created_at ASC
                 LIMIT 500`,
                [conversationId]
            );

            // Parse metadata JSON
            messages.forEach(msg => {
                msg.metadata = safeJsonParse(msg.metadata, {});
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
            const conversation = await query.get(
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
            await query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, created_at)
                 VALUES (?, ?, ?, 'user', ?, ?)`,
                [userMessageId, conversation_id, user.id, message, messageTimestamp]
            );

            // Auto-generate title from first user message if still default
            const conv = await query.get(
                `SELECT title, (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = ? AND role = 'user') as user_msg_count
                 FROM chat_conversations WHERE id = ?`,
                [conversation_id, conversation_id]
            );
            if (conv?.title === 'New Chat' && conv?.user_msg_count <= 1) {
                const autoTitle = message.slice(0, 60).trim() + (message.length > 60 ? '…' : '');
                await query.run(
                    `UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?`,
                    [autoTitle, new Date().toISOString(), conversation_id]
                );
            }

            // Get conversation history (last 20 messages for context)
            const historyMessages = (await query.all(
                `SELECT role, content FROM chat_messages
                 WHERE conversation_id = ? AND NOT (metadata @> '{"is_welcome":true}'::jsonb)
                 ORDER BY created_at DESC
                 LIMIT 20`,
                [conversation_id]
            )).reverse();

            // --- Streaming branch ---
            if (body.stream) {
                const encoder = new TextEncoder();
                const readable = new ReadableStream({
                    async start(controller) {
                        let fullContent = '';
                        let closed = false;
                        const safeClose = () => { if (!closed) { closed = true; controller.close(); } };
                        try {
                            for await (const chunk of streamResponse(
                                historyMessages.map(m => ({ role: m.role, content: m.content })),
                                { userId: user.id }
                            )) {
                                if (chunk.type === 'delta') {
                                    fullContent += chunk.content;
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                                } else if (chunk.type === 'done') {
                                    const assistantMessageId = `msg_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
                                    const metadata = { source: chunk.source, quickActions: chunk.quickActions || [] };
                                    // Send done frame BEFORE DB writes — client gets content even if DB fails
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', messageId: assistantMessageId, quickActions: chunk.quickActions || [] })}\n\n`));
                                    safeClose();
                                    const ts = new Date().toISOString();
                                    try {
                                        await query.run(
                                            `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
                                            [assistantMessageId, conversation_id, user.id, fullContent, JSON.stringify(metadata), ts]
                                        );
                                        await query.run(
                                            `UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND user_id = ?`,
                                            [ts, conversation_id, user.id]
                                        );
                                    } catch (dbErr) {
                                        logger.error('[Chatbot] DB write failed after stream done', user?.id, { detail: dbErr?.message });
                                    }
                                } else if (chunk.type === 'error') {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: chunk.error || 'Stream failed' })}\n\n`));
                                    safeClose();
                                }
                            }
                        } catch (err) {
                            logger.error('[Chatbot] Stream error', user?.id, { detail: err?.message });
                            if (!closed) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`));
                            }
                            safeClose();
                        }
                    }
                });
                return {
                    isStream: true,
                    body: readable,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no',
                    }
                };
            }
            // --- End streaming branch ---

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
            await query.run(
                `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at)
                 VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
                [assistantMessageId, conversation_id, user.id, grokResponse.content, JSON.stringify(metadata), responseTimestamp]
            );

            // Update conversation timestamp
            await query.run(
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
            const message = await query.get(
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
            await query.run(
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

    // PATCH /api/chatbot/conversations/:id - Rename conversation
    if (method === 'PATCH' && path.match(/^\/conversations\/[\w-]+$/)) {
        const conversationId = path.split('/')[2];
        const { title } = body;

        if (!title || title.trim().length === 0) {
            return { status: 400, data: { error: 'title is required' } };
        }
        if (title.length > 200) {
            return { status: 400, data: { error: 'Title must be 200 characters or less' } };
        }

        try {
            const conversation = await query.get(
                `SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?`,
                [conversationId, user.id]
            );
            if (!conversation) {
                return { status: 404, data: { error: 'Conversation not found' } };
            }
            await query.run(
                `UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
                [title.trim(), new Date().toISOString(), conversationId, user.id]
            );
            return { status: 200, data: { success: true, title: title.trim() } };
        } catch (error) {
            logger.error('[Chatbot] Error renaming conversation', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to rename conversation' } };
        }
    }

    // DELETE /api/chatbot/conversations/:id - Delete conversation
    if (method === 'DELETE' && path.match(/^\/conversations\/[\w-]+$/)) {
        const conversationId = path.split('/')[2];

        try {
            // Verify ownership
            const conversation = await query.get(
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
            await query.run(
                `DELETE FROM chat_messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = ?)`,
                [conversationId, user.id]
            );

            // Delete conversation
            await query.run(
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
