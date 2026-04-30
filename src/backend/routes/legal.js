import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

// Columns to strip from data exports (mirrors gdpr.js REDACTED_COLUMNS)
const REDACTED_COLUMNS = new Set([
    'password_hash',
    'mfa_secret',
    'mfa_backup_codes',
    'oauth_token',
    'oauth_refresh_token',
    'oauth_token_expires_at',
    'secret',
    'phone_verification_code',
    'token',
    'code',
]);

function redactRow(row) {
    const cleaned = { ...row };
    for (const col of REDACTED_COLUMNS) {
        if (col in cleaned) delete cleaned[col];
    }
    return cleaned;
}

// Defense-in-depth: whitelist for table names in data audit
const ALLOWED_AUDIT_TABLES = new Set([
    'inventory',
    'listings',
    'orders',
    'offers',
    'sales',
    'checklists',
    'automation_rules',
    'calendar_events',
    'image_bank',
    'suppliers',
    'feedback_submissions',
    'financial_transactions',
]);

export async function legalRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    try {
        // Privacy/GDPR endpoints
        if (method === 'GET' && path === '/privacy/data-export') {
            return await handleDataExport(user);
        }

        if (method === 'GET' && path === '/privacy/cookie-consent') {
            return await getCookieConsent(user);
        }

        if (method === 'PUT' && path === '/privacy/cookie-consent') {
            return await updateCookieConsent(user, body);
        }

        if (method === 'GET' && path === '/privacy/data-audit') {
            return await getDataAudit(user);
        }

        // Terms of Service endpoints
        if (method === 'GET' && path === '/tos/current') {
            return await getCurrentTos();
        }

        if (method === 'GET' && path === '/tos/history') {
            return await getTosHistory();
        }

        if (method === 'POST' && path === '/tos/accept') {
            return await acceptTos(user, body);
        }

        if (method === 'GET' && path === '/tos/acceptance-status') {
            return await getTosAcceptanceStatus(user);
        }

        return { status: 404, data: { error: 'Not found' } };
    } catch (error) {
        logger.error('[Legal] Legal router error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

// Privacy/GDPR handlers
async function handleDataExport(user) {
    try {
        const userId = user.id;

        // Gather all user data from various tables
        const [
            userInfo,
            inventory,
            listings,
            orders,
            offers,
            sales,
            checklists,
            automations,
            calendar,
            analytics,
            images,
            suppliers,
            settings,
            feedback,
            transactions,
        ] = await Promise.all([
            await query.all('SELECT id, email, name, created_at FROM users WHERE id = ?', [userId]),
            await query.all('SELECT * FROM inventory WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM listings WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM orders WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM offers WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM sales WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM checklists WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM automations WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM calendar_events WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM analytics WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM image_bank WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM suppliers WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM user_settings WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM feedback WHERE user_id = ? LIMIT 10000', [userId]),
            await query.all('SELECT * FROM transactions WHERE user_id = ? LIMIT 10000', [userId]),
        ]);

        const exportData = {
            exportDate: new Date().toISOString(),
            user: userInfo[0] || {},
            inventory: (inventory || []).map(redactRow),
            listings: (listings || []).map(redactRow),
            orders: (orders || []).map(redactRow),
            offers: (offers || []).map(redactRow),
            sales: (sales || []).map(redactRow),
            checklists: (checklists || []).map(redactRow),
            automations: (automations || []).map(redactRow),
            calendar: (calendar || []).map(redactRow),
            analytics: (analytics || []).map(redactRow),
            images: (images || []).map(redactRow),
            suppliers: (suppliers || []).map(redactRow),
            settings: (settings || []).map(redactRow),
            feedback: (feedback || []).map(redactRow),
            transactions: (transactions || []).map(redactRow),
        };

        return {
            status: 200,
            data: exportData,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="vaultlister-data-export-${userId}-${Date.now()}.json"`,
            },
        };
    } catch (error) {
        logger.error('[Legal] Data export error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to export data' } };
    }
}

async function getCookieConsent(user) {
    try {
        const consent = await query.get(
            'SELECT * FROM cookie_consent WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
            [user.id],
        );

        if (!consent) {
            // Return default consent (only functional cookies)
            return {
                status: 200,
                data: {
                    analytics: false,
                    marketing: false,
                    functional: true,
                    updated_at: null,
                },
            };
        }

        return {
            status: 200,
            data: {
                analytics: Boolean(consent.analytics),
                marketing: Boolean(consent.marketing),
                functional: Boolean(consent.functional),
                updated_at: consent.updated_at,
            },
        };
    } catch (error) {
        logger.error('[Legal] Get cookie consent error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to get cookie consent' } };
    }
}

async function updateCookieConsent(user, body) {
    try {
        const { analytics, marketing, functional } = body;

        // Validate input
        if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean' || typeof functional !== 'boolean') {
            return { status: 400, data: { error: 'Invalid consent values' } };
        }

        const consentId = nanoid();
        const now = new Date().toISOString();

        // Insert new consent record
        await query.run(
            `INSERT INTO cookie_consent (id, user_id, analytics, marketing, functional, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [consentId, user.id, analytics ? 1 : 0, marketing ? 1 : 0, functional ? 1 : 0, now],
        );

        return {
            status: 200,
            data: {
                success: true,
                analytics,
                marketing,
                functional,
                updated_at: now,
            },
        };
    } catch (error) {
        logger.error('[Legal] Update cookie consent error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to update cookie consent' } };
    }
}

async function getDataAudit(user) {
    try {
        const userId = user.id;

        // Count records in each table
        const getCount = async (table) => {
            if (!ALLOWED_AUDIT_TABLES.has(table)) {
                logger.warn('Blocked audit query for disallowed table', { table });
                return 0;
            }
            try {
                return (
                    Number(
                        (await query.get(`SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`, [userId]))?.count,
                    ) || 0
                );
            } catch {
                return 0;
            }
        };

        const audit = {
            userId: userId,
            auditDate: new Date().toISOString(),
            dataCounts: {
                inventory: getCount('inventory'),
                listings: getCount('listings'),
                orders: getCount('orders'),
                offers: getCount('offers'),
                sales: getCount('sales'),
                checklists: getCount('checklists'),
                automations: getCount('automation_rules'),
                calendar: getCount('calendar_events'),
                images: getCount('image_bank'),
                suppliers: getCount('suppliers'),
                feedback: getCount('feedback_submissions'),
                transactions: getCount('financial_transactions'),
            },
        };

        return { status: 200, data: audit };
    } catch (error) {
        logger.error('[Legal] Data audit error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to generate data audit' } };
    }
}

// Terms of Service handlers
async function getCurrentTos() {
    try {
        const currentTos = await query.get(
            'SELECT * FROM tos_versions ORDER BY effective_date DESC, created_at DESC LIMIT 1',
        );

        if (!currentTos) {
            return { status: 404, data: { error: 'No Terms of Service found' } };
        }

        return { status: 200, data: currentTos };
    } catch (error) {
        logger.error('[Legal] Get current ToS error', null, { detail: error.message });
        return { status: 500, data: { error: 'Failed to get current ToS' } };
    }
}

async function getTosHistory() {
    try {
        const history = await query.all(
            'SELECT id, version, title, summary_of_changes, effective_date, created_at FROM tos_versions ORDER BY effective_date DESC, created_at DESC LIMIT 100',
        );

        return { status: 200, data: history };
    } catch (error) {
        logger.error('[Legal] Get ToS history error', null, { detail: error.message });
        return { status: 500, data: { error: 'Failed to get ToS history' } };
    }
}

async function acceptTos(user, body) {
    try {
        const { tosVersionId, ipAddress, userAgent } = body;

        if (!tosVersionId) {
            return { status: 400, data: { error: 'ToS version ID is required' } };
        }

        // Verify the ToS version exists
        const tosVersion = await query.get('SELECT id FROM tos_versions WHERE id = ?', [tosVersionId]);
        if (!tosVersion) {
            return { status: 404, data: { error: 'ToS version not found' } };
        }

        // Check if already accepted
        const existing = await query.get('SELECT id FROM tos_acceptances WHERE user_id = ? AND tos_version_id = ?', [
            user.id,
            tosVersionId,
        ]);

        if (existing) {
            return {
                status: 200,
                data: {
                    success: true,
                    message: 'ToS already accepted',
                    acceptanceId: existing.id,
                },
            };
        }

        // Record acceptance
        const acceptanceId = nanoid();
        await query.run(
            `INSERT INTO tos_acceptances (id, user_id, tos_version_id, accepted_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [acceptanceId, user.id, tosVersionId, new Date().toISOString(), ipAddress || null, userAgent || null],
        );

        return {
            status: 200,
            data: {
                success: true,
                acceptanceId,
                tosVersionId,
                acceptedAt: new Date().toISOString(),
            },
        };
    } catch (error) {
        logger.error('[Legal] Accept ToS error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to accept ToS' } };
    }
}

async function getTosAcceptanceStatus(user) {
    try {
        // Get current ToS version
        const currentTos = await query.get(
            'SELECT id, version FROM tos_versions ORDER BY effective_date DESC, created_at DESC LIMIT 1',
        );

        if (!currentTos) {
            return {
                status: 200,
                data: {
                    hasAccepted: true,
                    message: 'No ToS version available',
                },
            };
        }

        // Check if user has accepted current version
        const acceptance = await query.get(
            'SELECT id, accepted_at FROM tos_acceptances WHERE user_id = ? AND tos_version_id = ?',
            [user.id, currentTos.id],
        );

        return {
            status: 200,
            data: {
                hasAccepted: acceptance !== null,
                currentTosId: currentTos.id,
                currentTosVersion: currentTos.version,
                acceptedAt: acceptance ? acceptance.accepted_at : null,
            },
        };
    } catch (error) {
        logger.error('[Legal] Get ToS acceptance status error', user?.id, { detail: error.message });
        return { status: 500, data: { error: 'Failed to get ToS acceptance status' } };
    }
}
