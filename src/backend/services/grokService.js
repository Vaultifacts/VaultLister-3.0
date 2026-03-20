// Vault Buddy AI Service
// Priority: Claude (Anthropic) → Grok (X.AI) → Mock (canned responses)

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Vault Buddy system prompt (used by both Claude and Grok)
const VAULTLISTER_SYSTEM_PROMPT = `You are Vault Buddy, the AI assistant built into VaultLister — a multi-channel reselling platform.

You help users with:
- Managing inventory and listings
- Cross-listing to platforms (Poshmark, eBay, Mercari, Depop, Grailed, Facebook, Whatnot)
- Automating repetitive tasks (closet sharing, follow-back, offer rules)
- Understanding analytics and sales performance
- Using features: Image Bank, Templates, AI listing generation, barcode scanner

Platform availability:
- LIVE (fully supported): Poshmark, eBay, Etsy
- COMING SOON (not yet available): Mercari, Depop, Grailed, Facebook Marketplace, Whatnot, Shopify
- When a user asks about a coming-soon platform, acknowledge it's on the roadmap but not yet active

Guidelines:
- Be concise, friendly, and actionable
- Reference the user's actual data when available (inventory count, recent sales, top platforms, connected accounts)
- When asked "what platforms am I selling on?" — use the connected platforms from user context, not generic examples
- Provide specific navigation hints (e.g., "Go to Inventory → Cross-List")
- Keep responses under 200 words unless a detailed explanation is clearly needed
- Never fabricate inventory data — only reference what's provided in the user context`;

// Canned responses for mock mode (pattern matching)
const CANNED_RESPONSES = {
    // Greeting patterns
    greeting: {
        patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'],
        responses: [
            "Hi there! 👋 I'm here to help you with VaultLister. What can I assist you with today?",
            "Hello! Welcome to VaultLister support. How can I help you manage your reselling business?",
            "Hey! Ready to help you maximize your sales. What would you like to know?"
        ],
        quickActions: [
            { label: "How to add items", route: "inventory" },
            { label: "Cross-list tutorial", route: "help" }
        ]
    },

    // Cross-listing help
    crosslist: {
        patterns: ['cross-list', 'crosslist', 'list to multiple', 'how to list', 'post to platforms'],
        responses: [
            "To cross-list items:\n\n1. Go to Inventory page\n2. Select items using checkboxes\n3. Click 'Cross-List Selected'\n4. Choose platforms and customize\n5. Submit!\n\nYou can use Quick mode (same listing) or Advanced mode (platform-specific).",
            "Cross-listing is easy! Select your items in Inventory, click the Cross-List button, pick your platforms (Poshmark, eBay, etc.), and submit. Use Advanced mode to optimize for each platform!"
        ],
        quickActions: [
            { label: "Go to Inventory", route: "inventory" },
            { label: "View Listings", route: "listings" }
        ]
    },

    // Image Bank
    imageBank: {
        patterns: ['image bank', 'images', 'photos', 'picture storage', 'photo editor'],
        responses: [
            "Image Bank centralizes all your product photos!\n\n📸 Upload images once\n🗂️ Organize in folders\n✏️ Edit with built-in editor\n🔄 Reuse across listings\n\nGo to Image Bank in the sidebar to get started!",
            "The Image Bank stores all your photos in one place. You can organize them, edit them (crop, rotate, enhance), and use them in any listing without re-uploading!"
        ],
        quickActions: [
            { label: "Open Image Bank", route: "image-bank" },
            { label: "Add Item", action: "modals.addItem()" }
        ]
    },

    // Templates
    templates: {
        patterns: ['template', 'reuse listing', 'save listing format', 'preset'],
        responses: [
            "Listing Templates save you time!\n\n✅ Save title/description patterns\n✅ Set default pricing\n✅ Reuse across similar items\n\nCreate a template once, use it hundreds of times. Perfect for consistent categories like vintage tees or designer bags!",
            "Templates are game-changers for efficiency. Create one for each product category (shoes, tops, etc.) with your preferred title format, description, and pricing strategy. Apply with one click when adding items!"
        ],
        quickActions: [
            { label: "View Templates", route: "templates" },
            { label: "Create Template", action: "modals.createTemplate()" }
        ]
    },

    // AI Generation
    aiGenerate: {
        patterns: ['ai generate', 'ai listing', 'automatic listing', 'ai description', 'generate from photo'],
        responses: [
            "AI Listing Generator uses Claude Vision to analyze your photos and create:\n\n🏷️ SEO-optimized titles\n📝 Persuasive descriptions\n🎨 Accurate attributes (brand, color, size)\n💰 Suggested pricing\n\nClick 'AI Generate' when adding an item!",
            "The AI Generator is magic! Upload a photo, and it creates a complete listing in seconds. It detects brand, style, condition, and writes compelling descriptions. Saves 2-3 minutes per item!"
        ],
        quickActions: [
            { label: "Try AI Generator", action: "modals.addItem(); setTimeout(() => modals.aiGenerateWizard(), 500)" }
        ]
    },

    // Automations
    automation: {
        patterns: ['automate', 'automation', 'bot', 'poshmark share', 'auto share', 'schedule'],
        responses: [
            "Automations run tasks automatically!\n\n⏰ Schedule sharing on Poshmark\n👥 Auto-follow users\n💌 Send offers to likers\n\nGo to Automations to set up rules. Toggle them on/off anytime!",
            "Set up automations to share your closet, follow users, and send offers while you sleep! Each platform has specific automation rules you can customize."
        ],
        quickActions: [
            { label: "View Automations", route: "automations" },
            { label: "Connect Platforms", route: "shops" }
        ]
    },

    // Analytics
    analytics: {
        patterns: ['analytics', 'stats', 'sales data', 'revenue', 'profit', 'performance'],
        responses: [
            "Analytics show your business performance:\n\n📈 Revenue & profit trends\n📊 Platform comparisons\n🏆 Top-selling items\n💰 Gross margin tracking\n\nView by timeframe (7 days, 30 days, 90 days, etc.).",
            "Check Analytics for insights! See which platforms perform best, which items sell most, and track your profit margins over time. Use this data to optimize your inventory!"
        ],
        quickActions: [
            { label: "View Analytics", route: "analytics" },
            { label: "View Sales", route: "sales" }
        ]
    },

    // Inventory management
    inventory: {
        patterns: ['inventory', 'add item', 'manage items', 'product', 'stock'],
        responses: [
            "Manage your inventory easily!\n\n➕ Add items with photos & details\n✏️ Edit anytime\n🗂️ Filter and search\n📦 Track quantity & stock levels\n\nClick 'Add Item' to get started!",
            "Your Inventory is the heart of VaultLister. Add items with up to 24 photos, track quantities, set prices, and manage everything in one place. Use filters to find items quickly!"
        ],
        quickActions: [
            { label: "View Inventory", route: "inventory" },
            { label: "Add Item", action: "modals.addItem()" }
        ]
    },

    // Platform connections
    platforms: {
        patterns: ['connect platform', 'link account', 'poshmark account', 'ebay account', 'platform setup'],
        responses: [
            "Connect your selling platforms:\n\n1. Go to My Shops\n2. Click 'Connect' on a platform\n3. Use OAuth (secure) or enter credentials\n4. Start cross-listing!\n\nSupported: Poshmark, eBay, Mercari, Depop, Grailed, Facebook.",
            "Connect platforms in My Shops to enable cross-listing and automations. OAuth is the most secure method - just click Connect and authorize!"
        ],
        quickActions: [
            { label: "My Shops", route: "shops" }
        ]
    },

    // Pricing help
    pricing: {
        patterns: ['pricing', 'how much', 'price item', 'what price', 'suggested price'],
        responses: [
            "Pricing tips:\n\n💡 Use AI Generator for price suggestions\n📊 Check sold comps on your platform\n💰 Factor in fees (Poshmark 20%, eBay 13%, etc.)\n🎯 Price 10-15% higher for negotiation room\n\nTemplates can auto-calculate markup from cost!",
            "Smart pricing is key! Research sold listings for similar items, account for platform fees, and leave room for offers. VaultLister's AI can suggest prices based on photo analysis!"
        ],
        quickActions: [
            { label: "Try AI Pricing", action: "modals.addItem(); setTimeout(() => modals.aiGenerateWizard(), 500)" }
        ]
    },

    // Help/support
    help: {
        patterns: ['help', 'support', 'how do i', 'tutorial', 'guide', 'stuck', 'confused'],
        responses: [
            "I'm here to help! 🙋\n\nTell me what you need assistance with:\n- Adding or managing items\n- Cross-listing\n- Automations\n- Analytics\n- Image Bank\n- Templates\n\nOr visit Tutorials for video guides!",
            "Need help? I can guide you through any feature! Just ask about what you want to do, and I'll provide step-by-step instructions."
        ],
        quickActions: [
            { label: "Video Tutorials", route: "tutorials" },
            { label: "Report Bug", route: "report-bug" }
        ]
    },

    // Default fallback
    default: {
        patterns: [],
        responses: [
            "I'm not sure about that, but I'm here to help with VaultLister features!\n\nI can assist with:\n✅ Inventory management\n✅ Cross-listing\n✅ Automations\n✅ Analytics & sales tracking\n✅ Image Bank & editing\n✅ Templates\n\nWhat would you like to know?",
            "Hmm, I don't have specific info on that. Could you rephrase, or ask about:\n\n- Adding items\n- Cross-listing to platforms\n- Setting up automations\n- Using Image Bank\n- Creating templates\n- Viewing analytics"
        ],
        quickActions: [
            { label: "View Inventory", route: "inventory" },
            { label: "Video Tutorials", route: "tutorials" }
        ]
    }
};

/**
 * Fetch a brief inventory/sales summary for the user to inject into Claude context.
 */
function getUserStats(userId) {
    try {
        const inv = query.get(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold
             FROM inventory WHERE user_id = ? AND deleted_at IS NULL`,
            [userId]
        );
        const sales = query.get(
            `SELECT COUNT(*) as count, ROUND(COALESCE(SUM(net_profit), 0), 2) as profit
             FROM sales WHERE user_id = ? AND created_at > datetime('now', '-30 days')`,
            [userId]
        );
        const platformCounts = query.all(
            `SELECT platform, COUNT(*) as c FROM listings
             WHERE user_id = ? AND deleted_at IS NULL AND status != 'ended'
             GROUP BY platform ORDER BY c DESC LIMIT 5`,
            [userId]
        );
        const connectedShops = query.all(
            `SELECT platform, platform_username FROM shops
             WHERE user_id = ? AND is_connected = 1
             ORDER BY platform`,
            [userId]
        );
        const lines = [];
        if (inv?.total) {
            lines.push(`Inventory: ${inv.total} items total (${inv.active || 0} active, ${inv.sold || 0} sold)`);
        }
        if (sales?.count) lines.push(`Last 30 days: ${sales.count} sales, $${sales.profit} profit`);
        if (connectedShops.length > 0) {
            const shopList = connectedShops.map(s => s.platform_username ? `${s.platform} (@${s.platform_username})` : s.platform).join(', ');
            lines.push(`Connected platforms: ${shopList}`);
        }
        if (platformCounts.length > 0) {
            const topPlatform = platformCounts[0];
            lines.push(`Top platform by listings: ${topPlatform.platform} (${topPlatform.c} listings)`);
            if (platformCounts.length > 1) {
                const others = platformCounts.slice(1).map(p => `${p.platform}: ${p.c}`).join(', ');
                lines.push(`Other active platforms: ${others}`);
            }
        }
        return lines.length ? lines.join(' | ') : null;
    } catch {
        return null;
    }
}

/**
 * Call Claude (Anthropic) and return a normalised response object.
 */
async function getClaudeResponse(messages, userContext) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let systemPrompt = VAULTLISTER_SYSTEM_PROMPT;
    if (userContext.userId) {
        const stats = getUserStats(userContext.userId);
        if (stats) systemPrompt += `\n\n[USER CONTEXT]\n${stats}`;
    }

    const claudeMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
    }));

    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            system: systemPrompt,
            messages: claudeMessages
        });
        const content = response.content[0].text;
        return {
            content,
            quickActions: extractQuickActions(content),
            source: 'claude'
        };
    } catch (error) {
        logger.error('[VaultBuddy] Claude API error, falling back to mock', null, { detail: error.message });
        return getMockResponse(messages[messages.length - 1].content, userContext);
    }
}

/**
 * Get response from the best available AI provider.
 * Priority: Claude (Anthropic) → Grok (X.AI) → Mock (canned responses)
 */
export async function getGrokResponse(messages, userContext = {}) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const grokKey = process.env.XAI_API_KEY;
    const mode = process.env.CHATBOT_MODE || 'auto';

    // Claude — primary (auto mode or explicit)
    if (anthropicKey && mode !== 'grok' && mode !== 'mock') {
        return getClaudeResponse(messages, userContext);
    }

    // Grok — secondary (explicit or fallback when no Anthropic key)
    if (grokKey && mode !== 'mock') {
        try {
            let response;
            try {
                response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${grokKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'grok-beta',
                        messages: [
                            { role: 'system', content: VAULTLISTER_SYSTEM_PROMPT },
                            ...messages
                        ],
                        temperature: 0.7,
                        max_tokens: 500
                    }),
                    signal: AbortSignal.timeout(60000)
                });
            } catch (fetchError) {
                if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
                    logger.error('[VaultBuddy] Grok API timed out, falling back to mock', null, { detail: fetchError.message });
                    return getMockResponse(messages[messages.length - 1].content, userContext);
                }
                throw fetchError;
            }

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.choices[0].message.content,
                quickActions: extractQuickActions(data.choices[0].message.content),
                source: 'grok-api'
            };
        } catch (error) {
            logger.error('[VaultBuddy] Grok API error, falling back to mock', null, { detail: error.message });
        }
    }

    // Mock — last resort
    return getMockResponse(messages[messages.length - 1].content, userContext);
}

/**
 * Mock response generator (pattern matching)
 */
function getMockResponse(userMessage, userContext = {}) {
    const messageLower = userMessage.toLowerCase();

    // Find matching pattern
    for (const [category, config] of Object.entries(CANNED_RESPONSES)) {
        if (category === 'default') continue;

        for (const pattern of config.patterns) {
            if (messageLower.includes(pattern)) {
                // Random response from array
                const response = config.responses[crypto.getRandomValues(new Uint32Array(1))[0] % config.responses.length];

                return {
                    content: response,
                    quickActions: config.quickActions || [],
                    source: 'mock',
                    category,
                    _source: 'mock',
                    _warning: 'AI service not configured. Set ANTHROPIC_API_KEY in .env for real responses.'
                };
            }
        }
    }

    // Default response
    const defaultResponse = CANNED_RESPONSES.default.responses[0];
    return {
        content: defaultResponse,
        quickActions: CANNED_RESPONSES.default.quickActions || [],
        source: 'mock',
        category: 'default',
        _source: 'mock',
        _warning: 'AI service not configured. Set ANTHROPIC_API_KEY in .env for real responses.'
    };
}

/**
 * Extract quick action suggestions from Grok response
 * (Looks for markdown links or specific patterns)
 */
function extractQuickActions(content) {
    const actions = [];

    // Look for common action patterns in response
    if (content.includes('Inventory') || content.includes('inventory')) {
        actions.push({ label: "View Inventory", route: "inventory" });
    }
    if (content.includes('Cross-list') || content.includes('cross-list')) {
        actions.push({ label: "Cross-List Items", route: "inventory" });
    }
    if (content.includes('Analytics') || content.includes('analytics')) {
        actions.push({ label: "View Analytics", route: "analytics" });
    }
    if (content.includes('Template') || content.includes('template')) {
        actions.push({ label: "View Templates", route: "templates" });
    }

    return actions.slice(0, 3); // Max 3 quick actions
}

/**
 * Return the active AI provider name for display in the UI.
 */
export function getChatbotMode() {
    const mode = process.env.CHATBOT_MODE || 'auto';
    if (process.env.ANTHROPIC_API_KEY && mode !== 'grok' && mode !== 'mock') return 'claude';
    if (process.env.XAI_API_KEY && mode !== 'mock') return 'grok';
    return 'mock';
}

/**
 * @deprecated Use getChatbotMode() instead.
 */
export function isGrokConfigured() {
    return !!(process.env.XAI_API_KEY && process.env.CHATBOT_MODE === 'api');
}

export default {
    getGrokResponse,
    getChatbotMode,
    isGrokConfigured
};
