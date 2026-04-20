// Admin incidents management for the status page (audit finding #38).
// Admin-only. Allows non-devs to create, update, and resolve platform_incidents
// without SSHing into prod and running raw SQL.

import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { SUPPORTED_PLATFORM_IDS } from '../../shared/supportedPlatforms.js';
import { notifyIncidentSubscribers } from './incidentSubscriptions.js';

const ALLOWED_STATUS = ['investigating', 'identified', 'monitoring', 'resolved'];
const ALLOWED_SEVERITY = ['minor', 'major', 'critical'];
const ALLOWED_KIND = ['market', 'vl'];
const VALID_PLATFORM_IDS = new Set([...SUPPORTED_PLATFORM_IDS, '_self']);
const POSTMORTEM_URL_RE = /^(https?:\/\/|\/)/;

function validateIncidentInput(body, isUpdate = false) {
    const errors = [];
    if (!isUpdate || body.platform_id !== undefined) {
        if (!body.platform_id || !VALID_PLATFORM_IDS.has(body.platform_id)) {
            errors.push('platform_id must be one of: ' + [...VALID_PLATFORM_IDS].join(', '));
        }
    }
    if (!isUpdate || body.kind !== undefined) {
        if (!ALLOWED_KIND.includes(body.kind)) errors.push('kind must be market or vl');
    }
    if (!isUpdate || body.title !== undefined) {
        if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
            errors.push('title is required');
        } else if (body.title.length > 200) {
            errors.push('title too long (max 200 chars)');
        }
    }
    if (body.status !== undefined && !ALLOWED_STATUS.includes(body.status)) {
        errors.push('status must be one of: ' + ALLOWED_STATUS.join(', '));
    }
    if (body.severity !== undefined && !ALLOWED_SEVERITY.includes(body.severity)) {
        errors.push('severity must be one of: ' + ALLOWED_SEVERITY.join(', '));
    }
    if (body.postmortem_url !== undefined && body.postmortem_url !== null && body.postmortem_url !== '') {
        if (!POSTMORTEM_URL_RE.test(String(body.postmortem_url))) {
            errors.push('postmortem_url must start with http://, https://, or /');
        }
        if (String(body.postmortem_url).length > 1000) {
            errors.push('postmortem_url too long (max 1000 chars)');
        }
    }
    if (body.body !== undefined && body.body !== null && String(body.body).length > 10000) {
        errors.push('body too long (max 10000 chars)');
    }
    return errors;
}

export async function adminIncidentsRouter(ctx) {
    const { method, path, body, user } = ctx;

    if (!user) return { status: 401, data: { error: 'Auth required' } };
    if (!user.is_admin) return { status: 403, data: { error: 'Admin access required' } };

    // GET /api/admin/incidents — list all incidents (open + resolved), most recent first
    if (method === 'GET' && (path === '' || path === '/')) {
        const rows = await query.all(
            `SELECT id, platform_id, kind, title, body, status, severity, postmortem_url,
                    started_at, resolved_at, created_at, updated_at
             FROM platform_incidents
             ORDER BY started_at DESC
             LIMIT 200`,
            []
        );
        return { status: 200, data: { incidents: rows } };
    }

    // POST /api/admin/incidents — create new
    if (method === 'POST' && (path === '' || path === '/')) {
        const errors = validateIncidentInput(body || {});
        if (errors.length) return { status: 400, data: { error: 'Validation failed', details: errors } };

        const result = await query.get(
            `INSERT INTO platform_incidents
                (platform_id, kind, title, body, status, severity, postmortem_url, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
             RETURNING id, started_at`,
            [
                body.platform_id,
                body.kind,
                body.title.trim(),
                body.body || null,
                body.status || 'investigating',
                body.severity || 'minor',
                body.postmortem_url || null,
                body.started_at || null
            ]
        );
        logger.info(`[AdminIncidents] Incident #${result.id} created by ${user.email} for ${body.platform_id}/${body.kind}`);
        // Fire-and-forget subscriber notification — don't block route response
        notifyIncidentSubscribers(
            { id: result.id, platform_id: body.platform_id, kind: body.kind, title: body.title.trim(), status: body.status || 'investigating' },
            'created'
        ).catch(err => logger.warn(`[AdminIncidents] Subscriber notify (create) failed: ${err.message}`));
        return { status: 201, data: { id: result.id, startedAt: result.started_at } };
    }

    // PATCH /api/admin/incidents/:id — update (status, severity, postmortem_url, body, title)
    const patchMatch = path.match(/^\/(\d+)$/);
    if (method === 'PATCH' && patchMatch) {
        const id = Number(patchMatch[1]);
        const errors = validateIncidentInput(body || {}, true);
        if (errors.length) return { status: 400, data: { error: 'Validation failed', details: errors } };

        const existing = await query.get('SELECT id FROM platform_incidents WHERE id = ?', [id]);
        if (!existing) return { status: 404, data: { error: 'Incident not found' } };

        const fields = [];
        const values = [];
        if (body.title !== undefined)          { fields.push('title = ?');          values.push(String(body.title).trim()); }
        if (body.body !== undefined)           { fields.push('body = ?');           values.push(body.body); }
        if (body.status !== undefined)         { fields.push('status = ?');         values.push(body.status); }
        if (body.severity !== undefined)       { fields.push('severity = ?');       values.push(body.severity); }
        if (body.postmortem_url !== undefined) { fields.push('postmortem_url = ?'); values.push(body.postmortem_url || null); }
        if (body.status === 'resolved')        { fields.push('resolved_at = NOW()'); }
        else if (body.status !== undefined && body.status !== 'resolved') { fields.push('resolved_at = NULL'); }

        if (!fields.length) return { status: 400, data: { error: 'No fields to update' } };

        values.push(id);
        await query.run(
            `UPDATE platform_incidents SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        logger.info(`[AdminIncidents] Incident #${id} updated by ${user.email}`);
        return { status: 200, data: { id, updated: fields.length } };
    }

    // POST /api/admin/incidents/:id/resolve — convenience endpoint
    const resolveMatch = path.match(/^\/(\d+)\/resolve$/);
    if (method === 'POST' && resolveMatch) {
        const id = Number(resolveMatch[1]);
        const result = await query.run(
            `UPDATE platform_incidents SET status = 'resolved', resolved_at = NOW()
             WHERE id = ? AND resolved_at IS NULL`,
            [id]
        );
        if (!result.changes) return { status: 404, data: { error: 'Incident not found or already resolved' } };
        logger.info(`[AdminIncidents] Incident #${id} resolved by ${user.email}`);
        const row = await query.get('SELECT id, platform_id, kind, title FROM platform_incidents WHERE id = ?', [id]);
        if (row) {
            notifyIncidentSubscribers({ ...row, status: 'resolved' }, 'resolved')
                .catch(err => logger.warn(`[AdminIncidents] Subscriber notify (resolve) failed: ${err.message}`));
        }
        return { status: 200, data: { id, resolved: true } };
    }

    return { status: 404, data: { error: 'Not found' } };
}
