// Chat Widget Component (Vanilla JS)
// Floating help chatbot powered by Grok API with mock mode

const ChatWidget = {
    // State
    isOpen: false,
    activeConversationId: null,
    messages: [],
    isTyping: false,
    isStreaming: false,

    // Initialize chat widget
    init() {
        // Widget starts closed
        this.isOpen = false;
        this.activeConversationId = null;
        this.messages = [];
        this.isTyping = false;
        // Do not clear vaultlister_chat_conv here — toggle() restores it on open
    },

    // Toggle chat open/closed
    toggle() {
        this.isOpen = !this.isOpen;
        this.render();

        if (this.isOpen && !this.activeConversationId) {
            const savedId = localStorage.getItem('vaultlister_chat_conv');
            if (savedId) {
                this.activeConversationId = savedId;
                this.loadConversation(savedId).catch(() => {
                    localStorage.removeItem('vaultlister_chat_conv');
                    this.activeConversationId = null;
                    this.startNewConversation();
                });
            } else {
                this.startNewConversation();
            }
        }
    },

    // Start new conversation
    async startNewConversation() {
        try {
            const result = await api.post('/chatbot/conversations', {});

            this.activeConversationId = result.conversation.id;
            localStorage.setItem('vaultlister_chat_conv', this.activeConversationId);

            // Load conversation messages
            await this.loadConversation(this.activeConversationId);
        } catch (error) {
            console.error('Failed to start conversation:', error);
            toast.error('Failed to start chat');
        }
    },

    // Load conversation
    async loadConversation(conversationId) {
        try {
            const result = await api.get(`/chatbot/conversations/${conversationId}`);
            this.messages = result.messages || [];
            this.render();

            // Scroll to bottom
            setTimeout(() => {
                const container = document.querySelector('.chat-messages');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 100);
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    },

    // Send message
    async sendMessage(message) {
        if (!message.trim() || this.isStreaming) return;
        this.isStreaming = true;

        // Add user message to UI immediately
        this.messages.push({
            role: 'user',
            content: message,
            created_at: new Date().toISOString()
        });
        this.render();

        // Add streaming placeholder — render once to create the element
        this.messages.push({
            id: '_streaming',
            role: 'assistant',
            content: '',
            _streaming: true,
            created_at: new Date().toISOString()
        });
        this.render();
        const chatContainer = document.querySelector('.chat-messages');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

        let accumulated = '';

        try {
            await api.ensureCSRFToken();
            await api.stream('/chatbot/message', {
                conversation_id: this.activeConversationId,
                message
            }, {
                onChunk: (text) => {
                    accumulated += text;
                    const widgetEl = document.getElementById('chat-widget-container');
                    const bubble = widgetEl?.querySelector('[data-streaming="true"]');
                    if (bubble) {
                        bubble.textContent += text;
                        const c = document.querySelector('.chat-messages');
                        if (c) c.scrollTop = c.scrollHeight;
                    }
                },
                onDone: (event) => {
                    this.isStreaming = false;
                    // Replace placeholder with final message object, re-render once
                    const idx = this.messages.findIndex(m => m._streaming);
                    if (idx !== -1) {
                        this.messages[idx] = {
                            id: event.messageId,
                            role: 'assistant',
                            content: accumulated,
                            metadata: { quickActions: event.quickActions || [] },
                            created_at: new Date().toISOString()
                        };
                    }
                    this.render();
                    setTimeout(() => {
                        const c = document.querySelector('.chat-messages');
                        if (c) c.scrollTop = c.scrollHeight;
                    }, 50);
                },
                onError: (err) => {
                    this.isStreaming = false;
                    console.error('[ChatWidget] Stream error:', err);
                    const idx = this.messages.findIndex(m => m._streaming);
                    if (idx !== -1) {
                        this.messages[idx] = {
                            id: '_error_' + Date.now(),
                            role: 'assistant',
                            content: 'Sorry, something went wrong. Please try again.',
                            created_at: new Date().toISOString()
                        };
                    }
                    this.render();
                }
            });
        } catch (error) {
            this.isStreaming = false;
            console.error('Failed to send message:', error);
            const idx = this.messages.findIndex(m => m._streaming);
            if (idx !== -1) this.messages.splice(idx, 1);
            toast.error('Failed to send message');
            this.render();
        }
    },

    // Execute quick action
    executeQuickAction(action) {
        if (action.route) {
            // Navigate to route
            router.navigate(action.route);
            // Close chat
            this.isOpen = false;
            this.render();
        } else if (action.action) {
            // Dispatch action by parsing — no code evaluation
            const routeMatch = action.action.match(/^router\.navigate\(['"]([^'"<>]+)['"]\)$/);  // nosemgrep: javascript.browser.security.eval-detected.eval-detected
            const hashMatch = action.action.match(/^window\.location\.hash\s*=\s*['"]([^'"<>]+)['"]$/);  // nosemgrep: javascript.browser.security.eval-detected.eval-detected
            if (routeMatch) {
                router.navigate(routeMatch[1]);
                this.isOpen = false;
                this.render();
            } else if (hashMatch) {
                window.location.hash = hashMatch[1];
                this.isOpen = false;
                this.render();
            } else {
                console.warn('[ChatWidget] Unsupported quick action type — ignored');
            }
        }
    },

    // Rate message
    async rateMessage(messageId, rating) {
        try {
            await api.post('/chatbot/rate', {
                message_id: messageId,
                rating: rating
            });

            // Update message in UI
            const message = this.messages.find(m => m.id === messageId);
            if (message) {
                message.helpful_rating = rating;
                this.render();
            }

            toast.success('Thank you for your feedback!');
        } catch (error) {
            console.error('Failed to rate message:', error);
        }
    },

    // Render widget
    render() {
        const container = document.getElementById('chat-widget-container');
        if (!container) return;

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        container.innerHTML = sanitizeHTML(`
            <!-- Floating Button -->
            <button class="chat-widget-button ${this.isOpen ? 'active' : ''}"
                    onclick="ChatWidget.toggle()"
                    title="Help Chat">
                ${this.isOpen ? '✕' : '💬'}
            </button>

            <!-- Chat Modal -->
            ${this.isOpen ? `
                <div class="chat-widget-modal">
                    <!-- Header -->
                    <div class="chat-widget-header">
                        <div class="chat-widget-header-title">
                            <span class="chat-widget-avatar">🤖</span>
                            <div>
                                <h3>VaultLister Assistant</h3>
                                <p class="text-xs text-gray-500">Always here to help</p>
                            </div>
                        </div>
                        <button aria-label="Close chat" class="chat-widget-close" onclick="ChatWidget.toggle()"><span aria-hidden="true">✕</span></button>
                    </div>

                    <!-- Messages -->
                    <div class="chat-messages">
                        ${this.messages.map(msg => this.renderMessage(msg)).join('')}

                        ${this.isTyping ? `
                            <div class="chat-message assistant">
                                <div class="chat-message-avatar">🤖</div>
                                <div class="chat-message-bubble">
                                    <div class="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Input -->
                    <div class="chat-widget-input">
                        <textarea
                            id="chat-input"
                            placeholder="Type your question..."
                            rows="1"
                            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();ChatWidget.handleSend();}"
                         aria-label="Chat Input"></textarea>
                        <button class="chat-send-btn" onclick="ChatWidget.handleSend()">
                            ➤
                        </button>
                    </div>
                </div>
            ` : ''}
        `);
    },

    // Render single message
    renderMessage(msg) {
        const isUser = msg.role === 'user';
        const metadata = msg.metadata || {};
        const quickActions = metadata.quickActions || [];

        return `
            <div class="chat-message ${isUser ? 'user' : 'assistant'}">
                ${!isUser ? '<div class="chat-message-avatar">🤖</div>' : ''}
                <div class="chat-message-content">
                    <div class="chat-message-bubble"${msg._streaming ? ' data-streaming="true"' : ''}>
                        ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                    </div>

                    ${!isUser && quickActions.length > 0 ? `
                        <div class="chat-quick-actions">
                            ${quickActions.map(action => `
                                <button class="chat-quick-action-btn"
                                        onclick='ChatWidget.executeQuickAction(${JSON.stringify(action).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')})'>
                                    ${escapeHtml(action.label)}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${!isUser && msg.id ? `
                        <div class="chat-message-actions">
                            ${msg.helpful_rating ? `
                                <span class="text-xs text-success">✓ Rated ${msg.helpful_rating}/5</span>
                            ` : `
                                <button class="chat-rate-btn" onclick="ChatWidget.rateMessage('${msg.id}', 5)" title="Helpful">
                                    👍
                                </button>
                                <button class="chat-rate-btn" onclick="ChatWidget.rateMessage('${msg.id}', 1)" title="Not helpful">
                                    👎
                                </button>
                            `}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Handle send button click
    handleSend() {
        const input = document.getElementById('chat-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        this.sendMessage(message);
        input.value = '';
        input.style.height = 'auto';
    }
};

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ChatWidget.init());
    } else {
        ChatWidget.init();
    }
}
