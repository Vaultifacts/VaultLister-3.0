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
        setInterval(() => this.cleanup(), 86400000);
        logger.info('[AuditLog] Service initialized');
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

        query.run(`
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
            sql += " AND action LIKE ? ESCAPE '\\'";
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

        return query.all(sql, params) || [];
    },

    // Get user activity timeline
    async getUserActivity(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return query.all(`
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

        return query.all(`
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
        report.summary.byCategory = query.all(`
            SELECT
                category,
                COUNT(*) as count
            FROM audit_logs
            WHERE created_at BETWEEN ? AND ?
            GROUP BY category
        `, [startDate, endDate]) || [];

        // Summary by severity
        report.summary.bySeverity = query.all(`
            SELECT
                severity,
                COUNT(*) as count
            FROM audit_logs
            WHERE created_at BETWEEN ? AND ?
            GROUP BY severity
        `, [startDate, endDate]) || [];

        // Authentication events
        report.details.authentication = {
            totalLogins: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE category = 'authentication' AND action = 'login_success'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate])?.count || 0,
            failedLogins: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE category = 'authentication' AND action = 'login_failed'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate])?.count || 0,
            passwordResets: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE action LIKE '%password_reset%'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate])?.count || 0
        };

        // Security events
        report.details.security = {
            mfaEnrollments: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE action LIKE '%mfa_enabled%'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate])?.count || 0,
            suspiciousActivity: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE severity IN ('warning', 'critical')
                AND category = 'security'
                AND created_at BETWEEN ? AND ?
            `, [startDate, endDate])?.count || 0
        };

        // Data access patterns
        report.details.dataAccess = query.all(`
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
        report.details.adminActions = query.all(`
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

        return query.all(`
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
        const result = query.run(`
            DELETE FROM audit_logs
            WHERE created_at < ?
            AND severity NOT IN ('critical')
            AND category != 'security'
        `, [cutoffDate.toISOString()]);

        // Delete critical/security logs older than 2 years
        const criticalResult = query.run(`
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

    // Admin-only endpoints
    const isAdmin = user.subscription_tier === 'enterprise' || user.is_admin;
    if (!isAdmin) {
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
            totalEvents: query.get(`
                SELECT COUNT(*) as count FROM audit_logs
                WHERE created_at >= ?
            `, [startDate.toISOString()])?.count || 0,

            byCategory: query.all(`
                SELECT category, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY category
            `, [startDate.toISOString()]) || [],

            bySeverity: query.all(`
                SELECT severity, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY severity
            `, [startDate.toISOString()]) || [],

            topActions: query.all(`
                SELECT action, COUNT(*) as count
                FROM audit_logs
                WHERE created_at >= ?
                GROUP BY action
                ORDER BY count DESC
                LIMIT 10
            `, [startDate.toISOString()]) || [],

            uniqueUsers: query.get(`
                SELECT COUNT(DISTINCT user_id) as count
                FROM audit_logs
                WHERE created_at >= ?
            `, [startDate.toISOString()])?.count || 0
        };

        return { status: 200, data: stats };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Database migration
export const migration = `
-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at DESC);
`;

// Export constants for use in other modules
export { CATEGORIES, SEVERITY };
export { auditLog };
export default auditLog;
