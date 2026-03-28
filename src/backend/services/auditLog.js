// Audit Logging Service
// Track admin actions, user activity, and compliance reporting

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Audit event categories
const CATEGORIES = {
    AUTH: 'authentication',
    USER: 'user_management',
    DATA: 'data_access',
    ADMIN: 'admin_action',
    SYSTEM: 'system',
    SECURITY: 'security',
    FINANCIAL: 'financial',
    INVENTORY: 'inventory',
    LISTING: 'listing',
    SALE: 'sale'
};

// Event severity levels
const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
    'password', 'password_hash', 'token', 'secret', 'api_key',
    'credit_card', 'ssn', 'bank_account', 'refresh_token'
];

// Redact sensitive data from objects
function redactSensitive(data) {
    if (!data || typeof data !== 'object') return data;

    const redacted = Array.isArray(data) ? [...data] : { ...data };

    for (const key of Object.keys(redacted)) {
        if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object') {
            redacted[key] = redactSensitive(redacted[key]);
        }
    }

    return redacted;
}

// Audit Log Service
const auditLog = {
    // Initialize service
    init() {
        // Start cleanup job (runs daily)
        this.cleanupInterval = setInterval(() => this.cleanup(), 86400000);
        logger.info('[AuditLog] Service initialized');
    },

    // Stop background jobs (called during graceful shutdown)
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    },

    // Log an event
    async log(event) {
        const {
            userId,
            action,
            category = CATEGORIES.SYSTEM,
            severity = SEVERITY.INFO,
            resourceType,
            resourceId,
            details,
            ipAddress,
            userAgent,
            sessionId,
            metadata = {}
        } = event;

        const id = uuidv4();
        const timestamp = new Date().toISOString();

        // Redact sensitive data
        const safeDetails = redactSensitive(details);
        const safeMetadata = redactSensitive(metadata);

        await query.run(`
            INSERT INTO audit_logs (
                id, user_id, action, category, severity,
                resource_type, resource_id, details, metadata,
                ip_address, user_agent, session_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            userId,
            action,
            category,
            severity,
            resourceType,
            resourceId,
            JSON.stringify(safeDetails),
            JSON.stringify(safeMetadata),
            ipAddress,
            userAgent,
            sessionId,
            timestamp
        ]);

        // For critical events, trigger alerts
        if (severity === SEVERITY.CRITICAL) {
            this.alertCritical(event);
        }

        return id;
    },

    // Convenience methods for common events
    async logAuth(userId, action, details, ctx = {}) {
        return this.log({
            userId,
            action,
            category: CATEGORIES.AUTH,
            severity: action.includes('failed') ? SEVERITY.WARNING : SEVERITY.INFO,
            details,
            ...ctx
        });
    },

    async logAdmin(userId, action, details, ctx = {}) {
        return this.log({
            userId,
            action,
            category: CATEGORIES.ADMIN,
            severity: SEVERITY.WARNING,
            details,
            ...ctx
        });
    },

    async logSecurity(userId, action, details, ctx = {}) {
        return this.log({
            userId,
            action,
            category: CATEGORIES.SECURITY,
            severity: SEVERITY.WARNING,
            details,
            ...ctx
        });
    },

    async logDataAccess(userId, action, resourceType, resourceId, details, ctx = {}) {
        return this.log({
            userId,
            action,
            category: CATEGORIES.DATA,
            resourceType,
            resourceId,
            details,
            ...ctx
        });
    },

    async logFinancial(userId, action, details, ctx = {}) {
        return this.log({
            userId,
            action,
            category: CATEGORIES.FINANCIAL,
            severity: SEVERITY.INFO,
            details,
            ...ctx
        });
    },

    // Alert for critical events
    alertCritical(event) {
        logger.error('[AuditLog] CRITICAL AUDIT', null, {
            action: event.action,
            userId: event.userId,
            timestamp: new Date().toISOString()
        });
        // In production: send to monitoring service, email admins, etc.
    },

    // Query audit logs
    async query(filters = {}) {
        const {
            userId,
            category,
            severity,
            action,
            resourceType,
            resourceId,
            startDate,
            endDate,
            limit = 100,
            offset = 0
        } = filters;

        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (userId) {
            sql += ' AND user_id = ?';
            params.push(userId);
        }
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        if (severity) {
            sql += ' AND severity = ?';
            params.push(severity);
        }
        if (action) {
            sql += " AND action ILIKE ? ESCAPE '\\'";
            params.push(`%${action.replace(/[%_\\]/g, '\\$&')}%`);
        }
        if (resourceType) {
            sql += ' AND resource_type = ?';
            params.push(resourceType);
        }
        if (resourceId) {
            sql += ' AND resource_id = ?';
            params.push(resourceId);
        }
        if (startDate) {
            sql += ' AND created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND created_at <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await query.all(sql, params) || [];
    },

    // Get user activity timeline
    async getUserActivity(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await query.all(`
            SELECT
                action,
                category,
                resource_type,
                created_at,
                ip_address
            FROM audit_logs
            WHERE user_id = ?
            AND created_at >= ?
            ORDER BY created_at DESC
            LIMIT 500
        `, [userId, startDate.toISOString()]) || [];
    },

    // Get admin activity
    async getAdminActivity(days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await query.all(`
            SELECT
                al.*,
                u.email as user_email,
                u.username
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.category = 'admin_action'
            AND al.created_at >= ?
            ORDER BY al.created_at DESC
        `, [startDate.toISOString()]) || [];
    },

    // Generate compliance report
    async generateComplianceReport(startDate, endDate) {
        const report = {
            period: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString(),
            summary: {},
            details: {}
        };

        // Summary by category
        report.summary.byCategory = await query.all(`
            SELECT
                category,
                COUNT(*) as count
            FROM audit_logs
            WHERE created_at BETWEEN ? AND ?
            GROUP BY category
        `, [startDate, endDate]) || [];

        // Summary by severity
        report.summary.bySeverity = await query.all(`
            SELECT
                severity,
                COUNT(*) as count
            FROM audit_logs
            WHERE created_at BETWEEN ? AND ?
            GROUP BY severity
        `, [startDate, endDate]) || [];

        // Authentication events
        report.details.authentication = {
            totalLogins: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE category = 'authentication' AND action = 'login_success'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate]))?.count) || 0,
            failedLogins: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE category = 'authentication' AND action = 'login_failed'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate]))?.count) || 0,
            passwordResets: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE action ILIKE '%password_reset%'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate]))?.count) || 0
        };

        // Security events
        report.details.security = {
            mfaEnrollments: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE action ILIKE '%mfa_enabled%'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate]))?.count) || 0,
            suspiciousActivity: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE severity IN ('warning', 'critical')
                AND category = 'security'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate]))?.count) || 0
        };

        // Data access patterns
        report.details.dataAccess = await query.all(`
            SELECT
                action,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users
            FROM audit_logs
            WHERE category = 'data_access'
            AND created_at BETWEEN ? AND ?
            GROUP BY action
            ORDER BY count DESC
            LIMIT 20
        `, [startDate, endDate]) || [];

        // Admin actions
        report.details.adminActions = await query.all(`
            SELECT
                al.action,
                al.details,
                al.created_at,
                u.email as admin_email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.category = 'admin_action'
            AND al.created_at BETWEEN ? AND ?
            ORDER BY al.created_at DESC
        `, [startDate, endDate]) || [];

        return report;
    },

    // Get security alerts
    async getSecurityAlerts(hours = 24) {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);

        return await query.all(`
            SELECT
                al.*,
                u.email as user_email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.severity IN ('warning', 'critical')
            AND al.created_at >= ?
            ORDER BY al.created_at DESC
        `, [startDate.toISOString()]) || [];
    },

    // Cleanup old logs (retention policy)
    async cleanup(retentionDays = 90, criticalRetentionDays = 730) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const criticalCutoffDate = new Date();
        criticalCutoffDate.setDate(criticalCutoffDate.getDate() - criticalRetentionDays);

        // Delete standard logs older than retentionDays
        const result = await query.run(`
            DELETE FROM audit_logs
            WHERE created_at < ?
            AND severity NOT IN ('critical')
            AND category != 'security'
        `, [cutoffDate.toISOString()]);

        // Delete critical/security logs older than 2 years
        const criticalResult = await query.run(`
            DELETE FROM audit_logs
            WHERE created_at < ?
            AND (severity = 'critical' OR category = 'security')
        `, [criticalCutoffDate.toISOString()]);

        logger.info(`[AuditLog] Cleaned up ${result.changes} standard + ${criticalResult.changes} critical/security logs`);
    }
};

// Router for audit log management
export async function auditLogRouter(ctx) {
    const { method, path, user, query: params } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/audit/my-activity - User's own activity
    if (method === 'GET' && path === '/my-activity') {
        const days = parseInt(params.days) || 30;
        const activity = await auditLog.getUserActivity(user.id, days);
        return { status: 200, data: { activity } };
    }

    // Admin-only endpoints (SECURITY: only is_admin flag grants access, never subscription_tier)
    if (!user.is_admin) {
        return { status: 403, data: { error: 'Admin access required' } };
    }

    // GET /api/audit/logs - Query audit logs
    if (method === 'GET' && path === '/logs') {
        const logs = await auditLog.query({
            userId: params.userId,
            category: params.category,
            severity: params.severity,
            action: params.action,
            resourceType: params.resourceType,
            startDate: params.startDate,
            endDate: params.endDate,
            limit: parseInt(params.limit) || 100,
            offset: parseInt(params.offset) || 0
        });
        return { status: 200, data: { logs } };
    }

    // GET /api/audit/admin-activity - Admin activity log
    if (method === 'GET' && path === '/admin-activity') {
        const days = parseInt(params.days) || 7;
        const activity = await auditLog.getAdminActivity(days);
        return { status: 200, data: { activity } };
    }

    // GET /api/audit/security-alerts - Security alerts
    if (method === 'GET' && path === '/security-alerts') {
        const hours = parseInt(params.hours) || 24;
        const alerts = await auditLog.getSecurityAlerts(hours);
        return { status: 200, data: { alerts } };
    }

    // GET /api/audit/compliance-report - Generate compliance report
    if (method === 'GET' && path === '/compliance-report') {
        const endDate = params.endDate || new Date().toISOString();
        const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const report = await auditLog.generateComplianceReport(startDate, endDate);
        return { status: 200, data: report };
    }

    // GET /api/audit/user/:userId - Get specific user's activity
    if (method === 'GET' && path.startsWith('/user/')) {
        const targetUserId = path.split('/')[2];
        const days = parseInt(params.days) || 30;
        const activity = await auditLog.getUserActivity(targetUserId, days);

        // Log this admin data access
        await auditLog.logAdmin(user.id, 'view_user_audit_log', {
            targetUserId,
            days
        });

        return { status: 200, data: { activity } };
    }

    // GET /api/audit/stats - Audit statistics
    if (method === 'GET' && path === '/stats') {
        const days = parseInt(params.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const stats = {
            totalEvents: Number((await query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE created_at >= ?
            `, [startDate.toISOString()]))?.count) || 0,

            byCategory: await query.all(`
                SELECT category, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY category
            `, [startDate.toISOString()]) || [],

            bySeverity: await query.all(`
                SELECT severity, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY severity
            `, [startDate.toISOString()]) || [],

            topActions: await query.all(`
                SELECT action, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            `, [startDate.toISOString()]) || [],

            uniqueUsers: Number((await query.get(`
                SELECT COUNT(DISTINCT user_id) as count
                FROM audit_logs
                WHERE created_at >= ?
            `, [startDate.toISOString()]))?.count) || 0
        };

        return { status: 200, data: stats };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Table created by pg-schema.sql (managed by migration system)
export const migration = '';

// Export constants for use in other modules
export { CATEGORIES, SEVERITY };
export { auditLog };
export default auditLog;
