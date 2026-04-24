import { featureFlags } from '../services/featureFlags.js';

export async function featureFlagsRouter(ctx) {
    const { method, path, user } = ctx;

    // GET /api/feature-flags - Get flags for current user
    if (method === 'GET' && (path === '/' || path === '')) {
        const flags = await featureFlags.getFlagsForUser(user);
        return { status: 200, data: { flags } };
    }

    // GET /api/feature-flags/all - Admin: get all flags
    if (method === 'GET' && path === '/all') {
        if (!user || !user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }
        return { status: 200, data: { flags: featureFlags.getAllFlags() } };
    }

    // PUT /api/feature-flags/:name - Admin: update a flag
    if (method === 'PUT' && path.startsWith('/')) {
        if (!user || !user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }
        const flagName = path.slice(1);
        if (!flagName) {
            return { status: 400, data: { error: 'Flag name required' } };
        }
        const { enabled, rolloutPercentage } = ctx.body || {};
        if (typeof enabled !== 'boolean') {
            return { status: 400, data: { error: 'enabled (boolean) is required' } };
        }
        const update = { enabled };
        if (rolloutPercentage !== undefined) {
            update.rolloutPercentage = rolloutPercentage;
        }
        featureFlags.setFlag(flagName, update);
        return { status: 200, data: { success: true, flag: flagName, enabled } };
    }

    return { status: 404, data: { error: 'Not found' } };
}
