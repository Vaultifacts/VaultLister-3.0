// Email Marketing Service
// Welcome sequences, sale notifications, and weekly digests

import { v4 as uuidv4 } from 'uuid';
import { createHmac } from 'crypto';
import { query } from '../db/database.js';
import emailService from './email.js';
import { logger } from '../shared/logger.js';

// Email templates
const EMAIL_TEMPLATES = {
    welcome: {
        subject: 'Welcome to VaultLister! 🎉',
        template: 'welcome'
    },
    welcomeDay2: {
        subject: 'Get started with your first listing',
        template: 'welcome-day2'
    },
    welcomeDay7: {
        subject: 'Pro tips to boost your sales',
        template: 'welcome-day7'
    },
    saleNotification: {
        subject: '💰 You made a sale on {platform}!',
        template: 'sale-notification'
    },
    weeklyDigest: {
        subject: 'Your Weekly VaultLister Summary',
        template: 'weekly-digest'
    },
    priceDropAlert: {
        subject: '📉 Price drop alert: {itemTitle}',
        template: 'price-drop-alert'
    },
    inactivityReminder: {
        subject: "We miss you! Here's what you've been missing",
        template: 'inactivity-reminder'
    },
    offerReceived: {
        subject: 'New offer on {itemTitle}',
        template: 'offer-received'
    }
};

// Email marketing service
const emailMarketing = {
    // Initialize service
    init() {
        // Start scheduled jobs
        this.startScheduledJobs();
        logger.info('[EmailMarketing] Service initialized');
    },

    // Start scheduled jobs
    startScheduledJobs() {
        // Run welcome sequence check every hour
        this.welcomeInterval = setInterval(() => this.processWelcomeSequence(), 3600000);

        // Run weekly digest on Sundays at 9 AM (check every hour)
        this.digestInterval = setInterval(() => this.processWeeklyDigests(), 3600000);

        // Run inactivity check daily
        this.inactivityInterval = setInterval(() => this.processInactivityReminders(), 86400000);
    },

    // Stop scheduled jobs and release interval handles
    cleanup() {
        if (this.welcomeInterval) { clearInterval(this.welcomeInterval); this.welcomeInterval = null; }
        if (this.digestInterval) { clearInterval(this.digestInterval); this.digestInterval = null; }
        if (this.inactivityInterval) { clearInterval(this.inactivityInterval); this.inactivityInterval = null; }
        logger.info('[EmailMarketing] Scheduled jobs stopped');
    },

    // Send welcome email sequence
    async sendWelcomeEmail(user) {
        await this.queueEmail(user.id, 'welcome', {
            name: user.full_name || user.username,
            email: user.email
        });

        // Queue follow-up emails
        await this.queueEmail(user.id, 'welcomeDay2', {
            name: user.full_name || user.username,
            email: user.email
        }, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)); // 2 days

        await this.queueEmail(user.id, 'welcomeDay7', {
            name: user.full_name || user.username,
            email: user.email
        }, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days
    },

    // Send sale notification
    async sendSaleNotification(sale, user) {
        // Check if user has marketing consent
        if (!await this.hasConsent(user.id, 'marketing_emails')) return;

        const listing = query.get('SELECT * FROM listings WHERE id = ?', [sale.listing_id]);
        const inventory = listing?.inventory_id ?
            query.get('SELECT * FROM inventory WHERE id = ?', [listing.inventory_id]) : null;

        await this.sendEmail(user.id, 'saleNotification', {
            name: user.full_name || user.username,
            email: user.email,
            platform: sale.platform,
            itemTitle: inventory?.title || listing?.title || 'Your item',
            salePrice: sale.sale_price,
            profit: sale.net_profit,
            buyerUsername: sale.buyer_username
        });
    },

    // Generate and send weekly digest
    async sendWeeklyDigest(userId) {
        const user = query.get('SELECT id, email, username, full_name, display_name, avatar_url, subscription_tier, last_login_at FROM users WHERE id = ? AND is_active = 1', [userId]);
        if (!user || !await this.hasConsent(userId, 'marketing_emails')) return;

        // Get stats for the week
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const salesStats = query.get(`
            SELECT
                COUNT(*) as total_sales,
                SUM(sale_price) as total_revenue,
                SUM(net_profit) as total_profit
            FROM sales
            WHERE user_id = ? AND created_at > ?
        `, [userId, weekAgo]) || { total_sales: 0, total_revenue: 0, total_profit: 0 };

        const listingStats = query.get(`
            SELECT
                COUNT(*) as new_listings,
                SUM(views) as total_views,
                SUM(likes) as total_likes
            FROM listings
            WHERE user_id = ? AND created_at > ?
        `, [userId, weekAgo]) || { new_listings: 0, total_views: 0, total_likes: 0 };

        const inventoryStats = query.get(`
            SELECT COUNT(*) as active_items
            FROM inventory
            WHERE user_id = ? AND status = 'active'
        `, [userId]) || { active_items: 0 };

        // Top performing items
        const topItems = query.all(`
            SELECT l.title, l.views, l.likes, l.platform
            FROM listings l
            WHERE l.user_id = ? AND l.status = 'active'
            ORDER BY l.views DESC
            LIMIT 3
        `, [userId]) || [];

        await this.sendEmail(userId, 'weeklyDigest', {
            name: user.full_name || user.username,
            email: user.email,
            salesCount: salesStats.total_sales,
            totalRevenue: salesStats.total_revenue || 0,
            totalProfit: salesStats.total_profit || 0,
            newListings: listingStats.new_listings,
            totalViews: listingStats.total_views || 0,
            totalLikes: listingStats.total_likes || 0,
            activeItems: inventoryStats.active_items,
            topItems
        });
    },

    // Process welcome sequence
    async processWelcomeSequence() {
        const now = new Date().toISOString();

        const pendingEmails = query.all(`
            SELECT * FROM email_queue
            WHERE status = 'pending' AND scheduled_for <= ?
            LIMIT 50
        `, [now]);

        for (const email of pendingEmails || []) {
            try {
                await this.sendEmail(email.user_id, email.template_key, JSON.parse(email.data));
                query.run('UPDATE email_queue SET status = ?, sent_at = datetime("now") WHERE id = ?', ['sent', email.id]);
            } catch (error) {
                query.run('UPDATE email_queue SET status = ?, error = ? WHERE id = ?', ['failed', error.message, email.id]);
            }
        }
    },

    // Process weekly digests
    async processWeeklyDigests() {
        const now = new Date();
        // Only run on Sundays between 9-10 AM
        if (now.getDay() !== 0 || now.getHours() !== 9) return;

        const users = query.all(`
            SELECT u.id FROM users u
            JOIN user_consents uc ON u.id = uc.user_id
            WHERE u.is_active = 1
            AND uc.consent_type = 'marketing_emails'
            AND uc.granted = 1
        `);

        for (const user of users || []) {
            await this.sendWeeklyDigest(user.id);
        }
    },

    // Process inactivity reminders
    async processInactivityReminders() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const inactiveUsers = query.all(`
            SELECT id, email, username, full_name, last_login_at FROM users
            WHERE is_active = 1
            AND last_login_at < ?
            AND id NOT IN (
                SELECT user_id FROM email_queue
                WHERE template_key = 'inactivityReminder'
                AND created_at > datetime('now', '-30 days')
            )
            LIMIT 20
        `, [thirtyDaysAgo]);

        for (const user of inactiveUsers || []) {
            if (await this.hasConsent(user.id, 'marketing_emails')) {
                await this.sendEmail(user.id, 'inactivityReminder', {
                    name: user.full_name || user.username,
                    email: user.email
                });
            }
        }
    },

    // Queue an email for later
    async queueEmail(userId, templateKey, data, scheduledFor = new Date()) {
        query.run(`
            INSERT INTO email_queue (id, user_id, template_key, data, scheduled_for, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `, [uuidv4(), userId, templateKey, JSON.stringify(data), scheduledFor.toISOString()]);
    },

    // Send an email immediately
    async sendEmail(userId, templateKey, data) {
        const template = EMAIL_TEMPLATES[templateKey];
        if (!template) {
            logger.warn(`[EmailMarketing] Unknown email template: ${templateKey}`);
            return;
        }

        // Replace placeholders in subject (use replaceAll to avoid regex replacement pattern issues with $)
        let subject = template.subject;
        for (const [key, value] of Object.entries(data)) {
            // Strip newlines from values to prevent email header injection
            subject = subject.replaceAll(`{${key}}`, String(value).replace(/[\r\n]/g, ' '));
        }

        await emailService.send({
            to: data.email,
            subject,
            template: template.template,
            data
        });

        // Log the email
        query.run(`
            INSERT INTO email_log (id, user_id, template_key, subject, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `, [uuidv4(), userId, templateKey, subject]);
    },

    // Check if user has consent
    async hasConsent(userId, consentType) {
        const consent = query.get(`
            SELECT granted FROM user_consents
            WHERE user_id = ? AND consent_type = ?
        `, [userId, consentType]);

        return consent?.granted === 1;
    },

    // Unsubscribe user
    async unsubscribe(userId, email, token) {
        // Verify token using HMAC — throws if no secret is configured
        const secret = process.env.JWT_SECRET || process.env.UNSUBSCRIBE_SECRET;
        if (!secret) throw new Error('No secret configured for unsubscribe token verification');
        const hash = createHmac('sha256', secret)
            .update(`${userId}:${email}`)
            .digest('hex');

        if (token !== hash.substring(0, 32)) {
            throw new Error('Invalid unsubscribe token');
        }

        query.run(`
            UPDATE user_consents SET granted = 0, updated_at = datetime('now')
            WHERE user_id = ? AND consent_type = 'marketing_emails'
        `, [userId]);

        return true;
    },

    // Generate unsubscribe link
    generateUnsubscribeLink(userId, email) {
        const secret = process.env.JWT_SECRET || process.env.UNSUBSCRIBE_SECRET;
        if (!secret) throw new Error('No secret configured for unsubscribe token generation');
        const hash = createHmac('sha256', secret)
            .update(`${userId}:${email}`)
            .digest('hex');

        const token = hash.substring(0, 32);
        return `/api/email-marketing/unsubscribe?userId=${userId}&email=${encodeURIComponent(email)}&token=${token}`;
    }
};

// Router
export async function emailMarketingRouter(ctx) {
    const { method, path, query: params, user } = ctx;

    // GET /api/email-marketing/unsubscribe - Unsubscribe
    if (method === 'GET' && path === '/unsubscribe') {
        try {
            await emailMarketing.unsubscribe(params.userId, params.email, params.token);
            return {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
                data: `<!DOCTYPE html>
                    <html>
                    <head><title>Unsubscribed</title></head>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1>Successfully Unsubscribed</h1>
                        <p>You will no longer receive marketing emails from VaultLister.</p>
                        <p><a href="/">Return to VaultLister</a></p>
                    </body>
                    </html>`
            };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // Admin endpoints
    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/email-marketing/stats - Get email stats (admin)
    if (method === 'GET' && path === '/stats') {
        if (user.subscription_tier !== 'enterprise') {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        const stats = query.get(`
            SELECT
                COUNT(*) as total_sent,
                COUNT(CASE WHEN template_key LIKE 'welcome%' THEN 1 END) as welcome_emails,
                COUNT(CASE WHEN template_key = 'weeklyDigest' THEN 1 END) as digest_emails,
                COUNT(CASE WHEN template_key = 'saleNotification' THEN 1 END) as sale_emails
            FROM email_log
            WHERE created_at > datetime('now', '-30 days')
        `);

        const queueStats = query.get(`
            SELECT
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM email_queue
        `);

        return {
            status: 200,
            data: { stats, queueStats }
        };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Database migration
export const migration = `
-- Email queue
CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    data TEXT,
    scheduled_for TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);

-- Email log
CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    subject TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, created_at DESC);
`;

export { emailMarketing };
export default emailMarketing;
