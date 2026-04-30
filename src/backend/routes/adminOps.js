export async function adminUptimeProbeRouter(ctx) {
    if (!ctx.user?.is_admin) return { status: 403, data: { error: 'Admin required' } };
    if (ctx.method !== 'POST') return { status: 405, data: { error: 'Method not allowed' } };
    const { runUptimeProbesCycle } = await import('../workers/uptimeProbeWorker.js');
    const start = Date.now();
    await runUptimeProbesCycle();
    return { status: 200, data: { ok: true, durationMs: Date.now() - start } };
}

export async function adminAffiliateApplicationsRouter(ctx) {
    if (!ctx.user?.is_admin) return { status: 403, data: { error: 'Admin required' } };
    const { query: dbQuery } = await import('../db/database.js');
    const VALID_STATUS = ['pending', 'approved', 'rejected'];
    // GET /api/admin/affiliate-applications[?status=pending]
    if (ctx.method === 'GET' && (ctx.path === '/' || ctx.path === '')) {
        const statusFilter = ctx.query?.status;
        const rows =
            statusFilter && VALID_STATUS.includes(statusFilter)
                ? await dbQuery.all('SELECT * FROM affiliate_applications WHERE status = $1 ORDER BY created_at DESC', [
                      statusFilter,
                  ])
                : await dbQuery.all('SELECT * FROM affiliate_applications ORDER BY created_at DESC', []);
        return { status: 200, data: { applications: rows } };
    }
    // PATCH /api/admin/affiliate-applications/:id
    if (ctx.method === 'PATCH' && ctx.path && ctx.path !== '/') {
        const id = ctx.path.replace(/^\//, '');
        const { status } = ctx.body || {};
        if (!VALID_STATUS.includes(status)) {
            return { status: 400, data: { error: 'status must be pending, approved, or rejected' } };
        }
        const result = await dbQuery.run('UPDATE affiliate_applications SET status = $1 WHERE id = $2', [status, id]);
        if (!result?.changes) return { status: 404, data: { error: 'Application not found' } };
        return { status: 200, data: { ok: true } };
    }
    return { status: 405, data: { error: 'Method not allowed' } };
}
